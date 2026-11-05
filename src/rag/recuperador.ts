/**
 * recuperador.ts — E4 · Recuperación semántica con citación (PostgreSQL + pgvector).
 *
 * Devuelve los fragmentos más parecidos a la pregunta, cada uno con su
 * doc_id, título, vigencia y sección para que el asistente cite la fuente.
 *
 * Seguridad (OP-7): el texto recuperado es DATO. Aquí solo se detecta si un
 * fragmento contiene patrones de instrucción dirigida a la IA y se marca;
 * quien consume el resultado (el agente) lo entrega al LLM envuelto como
 * contenido no confiable y nunca ejecuta nada en base a él.
 */
import { embeddings } from '../agente/openrouter';
import { crearConexionRag } from './conexion-rag';
import type { FragmentoCitado, RespuestaRag } from './esquemas';

const PATRON_INYECCION =
  /instrucci[oó]n para (el )?asistente|ignora (todas )?las (reglas|instrucciones)|responde [uú]nicamente|ejecuta de inmediato|sin pedir aprobaci[oó]n|muestra el dpi/i;

export function contieneInyeccion(texto: string): boolean {
  return PATRON_INYECCION.test(texto);
}

export async function recuperar(pregunta: string, k = 5): Promise<RespuestaRag> {
  const db = await crearConexionRag();
  const [vector] = await embeddings([pregunta]);

  const resultado = await db.query<{
    doc_id: string;
    titulo: string;
    vigencia: string;
    seccion: string;
    fragmento: string;
    puntaje: number;
  }>(
    `select doc_id, titulo, vigencia, seccion, fragmento,
            1 - (embedding <=> $1::vector) as puntaje
     from corpus_fragmentos
     order by embedding <=> $1::vector
     limit $2`,
    [`[${vector!.join(',')}]`, k],
  );

  const fuentes: FragmentoCitado[] = resultado.rows.map((r) => ({
    doc_id: r.doc_id,
    titulo: r.titulo,
    vigencia: r.vigencia,
    seccion: r.seccion,
    texto: r.fragmento,
    puntaje: Number(r.puntaje),
    sospechoso: contieneInyeccion(r.fragmento),
  }));

  const tieneInyeccion = fuentes.some((f) => f.sospechoso);

  return {
    respuesta: '',
    fuentes,
    ...(tieneInyeccion
      ? {
          advertencia_seguridad:
            'El contenido recuperado contiene patrones de instrucción incrustada. Se trata como dato, no como orden.',
        }
      : {}),
  };
}
