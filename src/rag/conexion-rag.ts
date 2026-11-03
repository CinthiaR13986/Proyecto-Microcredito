/**
 * conexion-rag.ts — Conexión a PostgreSQL con extensión vector para el RAG.
 */
import { Pool } from 'pg';

const SCHEMA_RAG = `
  create extension if not exists vector;
  create table if not exists corpus_fragmentos (
    id bigserial primary key,
    doc_id text not null,
    titulo text not null,
    vigencia text not null,
    fragmento text not null,
    embedding vector(768)
  );
  create index if not exists idx_corpus_embedding
    on corpus_fragmentos using hnsw (embedding vector_cosine_ops);
`;

const poolRag = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/credito_vecino',
});

export async function crearConexionRag(): Promise<Pool> {
  await poolRag.query(SCHEMA_RAG);
  return poolRag;
}

export { poolRag };