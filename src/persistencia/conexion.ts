/**
 * conexion.ts — PGlite embebido (sin servidor que instalar).
 * Si el equipo prefiere PostgreSQL de servidor, esta es la única pieza
 * que cambia: el cargador y la API dependen de esta interfaz, no del motor.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'schema.sql'),
  'utf8',
);

/** Crea (o abre) la base y aplica el esquema. Sin ruta → en memoria (pruebas). */
export async function crearConexion(rutaDatos?: string): Promise<PGlite> {
  const db = rutaDatos ? new PGlite(rutaDatos) : new PGlite();
  await db.exec(SCHEMA);
  return db;
}