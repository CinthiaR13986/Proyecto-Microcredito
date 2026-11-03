/**
 * ingesta.ts — E4 · Ingesta del corpus al almacén vectorial (PostgreSQL + pgvector).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { OllamaEmbeddings } from '@langchain/ollama';
import { crearConexionRag } from './conexion-rag';

interface MetadataDoc {
  doc_id: string;
  titulo: string;
  vigencia: string;
}

function parsearMetadata(contenido: string): MetadataDoc {
  const lineas = contenido.split('\n');
  const meta: Record<string, string> = {};
  for (const linea of lineas.slice(0, 10)) {
    const match = linea.match(/^(\w+):\s*(.+)$/);
    if (match) meta[match[1]] = match[2].trim();
  }
  return {
    doc_id: meta['doc_id'] ?? 'SIN-ID',
    titulo: meta['titulo'] ?? 'Sin título',
    vigencia: meta['vigencia'] ?? 'vigente',
  };
}

function fragmentar(texto: string, tamano = 500, solapamiento = 100): string[] {
  const limpio = texto
    .split('\n')
    .filter((l) => !l.match(/^\w+:\s*.+$/))
    .join('\n')
    .trim();
  const fragmentos: string[] = [];
  let inicio = 0;
  while (inicio < limpio.length) {
    const fin = Math.min(inicio + tamano, limpio.length);
    fragmentos.push(limpio.slice(inicio, fin));
    if (fin === limpio.length) break;
    inicio = fin - solapamiento;
  }
  return fragmentos;
}

export async function ingerirCorpus(rutaCorpus: string): Promise<number> {
  const db = await crearConexionRag();
  await db.query('delete from corpus_fragmentos');

  const embeddings = new OllamaEmbeddings({ model: 'nomic-embed-text' });
  const archivos = readdirSync(rutaCorpus).filter((f) => f.endsWith('.md'));
  let totalFragmentos = 0;

  for (const archivo of archivos) {
    const contenido = readFileSync(join(rutaCorpus, archivo), 'utf8');
    const meta = parsearMetadata(contenido);
    const fragmentos = fragmentar(contenido);

    for (const frag of fragmentos) {
      const vector = await embeddings.embedQuery(frag);
      await db.query(
        `insert into corpus_fragmentos (doc_id, titulo, vigencia, fragmento, embedding)
         values ($1, $2, $3, $4, $5::vector)`,
        [meta.doc_id, meta.titulo, meta.vigencia, frag, `[${vector.join(',')}]`],
      );
      totalFragmentos++;
    }
  }

  return totalFragmentos;
}