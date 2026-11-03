/**
 * conexion.ts — Conexión a PostgreSQL para el núcleo y el cargador canónico.
 * En pruebas, usa TEST_DATABASE_URL si está definida; si no, la normal.
 */
import { Pool } from 'pg';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'schema.sql'),
  'utf8',
);

const connectionString =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/credito_vecino';

const pool = new Pool({ connectionString });

export async function crearConexion(): Promise<Pool> {
  await pool.query(SCHEMA);
  return pool;
}

export { pool };