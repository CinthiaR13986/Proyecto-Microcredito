/**
 * ingesta.ts — E4 · Ingesta del corpus al almacén vectorial (PostgreSQL + pgvector).
 *
 * Estrategia de fragmentación (documentada en el README):
 *   - Se lee el front-matter YAML (doc_id, titulo, vigencia) como metadato
 *     de cita: no se embebe como texto suelto.
 *   - Se fragmenta por sección Markdown (encabezados "#", "##"): cada sección
 *     de una política es una regla autocontenida (tasas, tramos, redondeo,
 *     ejemplo), así que la sección es la unidad natural de cita.
 *   - En los documentos de preguntas frecuentes, cada pregunta (¿...?) es un
 *     fragmento.
 *   - Una sección muy larga se parte en ventanas de ~1200 caracteres con
 *     solapamiento de 200 para no perder contexto en el corte.
 *   - Cada fragmento se embebe con un encabezado "doc_id · título · vigencia
 *     · sección": así la vigencia (clave para elegir POL-2024-01 vs
 *     POL-2026-10) influye en la similitud semántica.
 *
 * La ingesta es idempotente: borra los fragmentos previos y vuelve a cargar.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { embeddings } from '../agente/openrouter';
import { crearConexionRag } from './conexion-rag';

export interface MetadataDoc {
  doc_id: string;
  titulo: string;
  vigencia: string;
}

export interface Fragmento {
  seccion: string;
  texto: string;
}

const MAX_CARACTERES = 1200;
const SOLAPAMIENTO = 200;

export function parsearDocumento(contenido: string): { meta: MetadataDoc; cuerpo: string } {
  const normalizado = contenido.replace(/\r\n/g, '\n');
  const fm = normalizado.match(/^---\n([\s\S]*?)\n---\n?/);
  const meta: Record<string, string> = {};
  if (fm) {
    for (const linea of fm[1]!.split('\n')) {
      const m = linea.match(/^(\w+):\s*(.+)$/);
      if (m) meta[m[1]!] = m[2]!.trim();
    }
  }
  return {
    meta: {
      doc_id: meta['doc_id'] ?? 'SIN-ID',
      titulo: meta['titulo'] ?? 'Sin título',
      vigencia: meta['vigencia'] ?? 'vigente',
    },
    cuerpo: (fm ? normalizado.slice(fm[0].length) : normalizado).trim(),
  };
}

function ventanas(texto: string): string[] {
  if (texto.length <= MAX_CARACTERES) return [texto];
  const partes: string[] = [];
  let inicio = 0;
  while (inicio < texto.length) {
    const fin = Math.min(inicio + MAX_CARACTERES, texto.length);
    partes.push(texto.slice(inicio, fin));
    if (fin === texto.length) break;
    inicio = fin - SOLAPAMIENTO;
  }
  return partes;
}

export function fragmentar(cuerpo: string): Fragmento[] {
  const secciones: Fragmento[] = [];
  let titulo = '';
  let buffer: string[] = [];

  const volcar = () => {
    const texto = buffer.join('\n').trim();
    if (texto.length > 0) secciones.push({ seccion: titulo, texto });
    buffer = [];
  };

  for (const linea of cuerpo.split('\n')) {
    const enc = linea.match(/^#{1,3}\s+(.+)$/);
    if (enc) {
      volcar();
      titulo = enc[1]!.trim();
      buffer.push(linea);
    } else {
      buffer.push(linea);
    }
  }
  volcar();

  // Una sección que es solo un título (sin cuerpo) se une a la siguiente.
  for (let i = secciones.length - 2; i >= 0; i--) {
    if (secciones[i]!.texto.length < 80) {
      secciones[i + 1] = { seccion: secciones[i + 1]!.seccion, texto: `${secciones[i]!.texto}\n${secciones[i + 1]!.texto}` };
      secciones.splice(i, 1);
    }
  }

  const resultado: Fragmento[] = [];
  for (const s of secciones) {
    // Preguntas frecuentes: una pregunta por fragmento.
    const preguntas = s.texto.split(/\n(?=\*{0,2}¿)/).map((p) => p.trim()).filter((p) => p.length > 0);
    const bloques = preguntas.length > 1 ? preguntas : [s.texto];
    for (const b of bloques) {
      for (const v of ventanas(b)) resultado.push({ seccion: s.seccion, texto: v });
    }
  }
  return resultado;
}

export function encabezadoCita(meta: MetadataDoc, seccion: string): string {
  return `[${meta.doc_id} · ${meta.titulo} · vigencia: ${meta.vigencia}${seccion ? ` · sección: ${seccion}` : ''}]`;
}

export async function ingerirCorpus(rutaCorpus: string): Promise<number> {
  const db = await crearConexionRag();
  const archivos = readdirSync(rutaCorpus).filter((f) => f.endsWith('.md')).sort();

  const filas: { meta: MetadataDoc; frag: Fragmento; textoEmbebido: string }[] = [];
  for (const archivo of archivos) {
    const { meta, cuerpo } = parsearDocumento(readFileSync(join(rutaCorpus, archivo), 'utf8'));
    for (const frag of fragmentar(cuerpo)) {
      filas.push({ meta, frag, textoEmbebido: `${encabezadoCita(meta, frag.seccion)}\n${frag.texto}` });
    }
  }

  const vectores = await embeddings(filas.map((f) => f.textoEmbebido));

  const cliente = await db.connect();
  try {
    await cliente.query('begin');
    await cliente.query('delete from corpus_fragmentos');
    for (let i = 0; i < filas.length; i++) {
      const { meta, frag } = filas[i]!;
      await cliente.query(
        `insert into corpus_fragmentos (doc_id, titulo, vigencia, seccion, fragmento, embedding)
         values ($1, $2, $3, $4, $5, $6::vector)`,
        [meta.doc_id, meta.titulo, meta.vigencia, frag.seccion, frag.texto, `[${vectores[i]!.join(',')}]`],
      );
    }
    await cliente.query('commit');
  } catch (e) {
    await cliente.query('rollback');
    throw e;
  } finally {
    cliente.release();
  }
  return filas.length;
}
