/**
 * cli.ts — Ejecuta la ingesta del corpus.
 * Uso: CV_DATA_DIR=datos npm run rag:ingerir
 */
import '../config';
import { ingerirCorpus } from './ingesta';
import { join } from 'node:path';

const dataDir = process.env.CV_DATA_DIR;
if (!dataDir) {
  console.error('Defina CV_DATA_DIR con la ruta del paquete de datos.');
  process.exit(1);
}

const rutaCorpus = join(dataDir, 'corpus');
const total = await ingerirCorpus(rutaCorpus);
console.log(`✔ Ingesta completa: ${total} fragmentos almacenados en pgvector.`);