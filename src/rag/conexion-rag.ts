/**
 * conexion-rag.ts — Conexión a PostgreSQL con extensión vector para el RAG.
 *
 * Misma base que los datos del sistema (DATABASE_URL): una sola base guarda
 * la cartera y los vectores del corpus (enunciado, sección 4).
 *
 * Si la columna embedding existe con otra dimensión (p. ej. 768 de un modelo
 * anterior), se recrea la tabla: los vectores de modelos distintos no son
 * comparables entre sí y hay que re-ingerir el corpus.
 */
import '../config';
import { Pool } from 'pg';
import { DIMENSION_EMBEDDINGS } from '../agente/openrouter';

const poolRag = new Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/credito_vecino',
});

let listo: Promise<void> | null = null;

async function prepararEsquema(): Promise<void> {
  await poolRag.query('create extension if not exists vector');
  const actual = await poolRag.query<{ dim: number }>(
    `select atttypmod as dim from pg_attribute
     where attrelid = to_regclass('corpus_fragmentos') and attname = 'embedding'`,
  );
  if (actual.rows[0] && Number(actual.rows[0].dim) !== DIMENSION_EMBEDDINGS) {
    await poolRag.query('drop table corpus_fragmentos');
  }
  await poolRag.query(`
    create table if not exists corpus_fragmentos (
      id bigserial primary key,
      doc_id text not null,
      titulo text not null,
      vigencia text not null,
      seccion text not null default '',
      fragmento text not null,
      embedding vector(${DIMENSION_EMBEDDINGS})
    );
    alter table corpus_fragmentos add column if not exists seccion text not null default '';
    create index if not exists idx_corpus_embedding
      on corpus_fragmentos using hnsw (embedding vector_cosine_ops);
  `);
}

export async function crearConexionRag(): Promise<Pool> {
  listo ??= prepararEsquema();
  await listo;
  return poolRag;
}

export { poolRag };
