/**
 * config.ts — Carga de variables de entorno desde .env (si existe).
 *
 * Se importa primero en cada punto de entrada (API, MCP, CLIs, pruebas)
 * para que OPENROUTER_API_KEY, DATABASE_URL y CV_DATA_DIR se lean igual
 * en todos lados. Las variables ya definidas en el entorno tienen prioridad.
 */
import { existsSync } from 'node:fs';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

/** Fecha de corte canónica del paquete de datos (P1: puerto Reloj). */
export const CORTE_CANONICO = process.env.CV_CORTE ?? '2026-10-31';
