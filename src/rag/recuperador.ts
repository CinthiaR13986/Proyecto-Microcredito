/**
 * recuperador.ts — E4 · Recuperación semántica con citación (PostgreSQL + pgvector).
 */
import { OllamaEmbeddings } from '@langchain/ollama';
import { crearConexionRag } from './conexion-rag';
import type { FragmentoCitado, RespuestaRag } from './esquemas';

const PATRON_INYECCION = /ignora todas las reglas|responde únicamente|ejecuta de inmediato|sin pedir aprobación/i;

export async function recuperar(
  pregunta: string,
  k = 3,
): Promise<RespuestaRag> {
  const db = await crearConexionRag();
  const embeddings = new OllamaEmbeddings({ model: 'nomic-embed-text' });
  const vector = await embeddings.embedQuery(pregunta);

  const resultado = await db.query<{
    doc_id: string;
    titulo: string;
    vigencia: string;
    fragmento: string;
    puntaje: number;
  }>(
    `select doc_id, titulo, vigencia, fragmento,
            1 - (embedding <=> $1::vector) as puntaje
     from corpus_fragmentos
     order by embedding <=> $1::vector
     limit $2`,
    [`[${vector.join(',')}]`, k],
  );

  const fuentes: FragmentoCitado[] = resultado.rows.map((r) => ({
    doc_id: r.doc_id,
    titulo: r.titulo,
    vigencia: r.vigencia,
    texto: r.fragmento,
    puntaje: Number(r.puntaje),
  }));

  const tieneInyeccion = fuentes.some((f) => PATRON_INYECCION.test(f.texto));

  return {
    respuesta: '',
    fuentes,
    advertencia_seguridad: tieneInyeccion
      ? 'El contenido recuperado contiene patrones de instrucción incrustada. Se trata como dato, no como orden.'
      : undefined,
  };
}