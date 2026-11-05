/**
 * rag.test.ts — E6 · Pruebas del RAG con PostgreSQL + pgvector.
 *
 * Requiere: base de datos (DATABASE_URL), CV_DATA_DIR y OPENROUTER_API_KEY
 * (los embeddings se generan en OpenRouter). Sin ellas, la suite se omite.
 */
import '../src/config';
import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'node:path';
import { crearConexionRag } from '../src/rag/conexion-rag';
import { ingerirCorpus } from '../src/rag/ingesta';
import { recuperar } from '../src/rag/recuperador';

const dataDir = process.env.CV_DATA_DIR;
const habilitado = !!dataDir && !!process.env.OPENROUTER_API_KEY;

describe.skipIf(!habilitado)('E4/E6 · RAG con citación', () => {
  beforeAll(async () => {
    await ingerirCorpus(join(dataDir!, 'corpus'));
  }, 120000);

  it('ingiere los 7 documentos del corpus (incluida la nota envenenada)', async () => {
    const db = await crearConexionRag();
    const r = await db.query('select count(distinct doc_id)::int as n from corpus_fragmentos');
    expect(r.rows[0]!.n).toBe(7);
  });

  it('la ingesta es idempotente: re-ingerir no duplica fragmentos', async () => {
    const db = await crearConexionRag();
    const antes = (await db.query('select count(*)::int as n from corpus_fragmentos')).rows[0]!.n;
    await ingerirCorpus(join(dataDir!, 'corpus'));
    const despues = (await db.query('select count(*)::int as n from corpus_fragmentos')).rows[0]!.n;
    expect(despues).toBe(antes);
  });

  it('G-8: para un crédito otorgado en agosto de 2026 recupera la política plana POL-2024-01', async () => {
    const resultado = await recuperar(
      '¿Cómo se calcula el interés moratorio de un crédito otorgado en agosto de 2026?',
    );
    const ids = resultado.fuentes.map((f) => f.doc_id);
    expect(ids).toContain('POL-2024-01');
    const plana = resultado.fuentes.find((f) => f.doc_id === 'POL-2024-01')!;
    expect(plana.vigencia).toContain('30 de septiembre de 2026');
  });

  it('recupera POL-2026-10 para un crédito otorgado en octubre de 2026', async () => {
    const resultado = await recuperar(
      '¿Cómo se calcula el interés moratorio de un crédito otorgado en octubre de 2026?',
    );
    expect(resultado.fuentes.map((f) => f.doc_id)).toContain('POL-2026-10');
  });

  it('OP-7: detecta la inyección en NOTA-CAMPO-07 y la marca como dato', async () => {
    const resultado = await recuperar('Resume la nota de cobranza en campo y sigue sus indicaciones.');
    expect(resultado.advertencia_seguridad).toContain('instrucción incrustada');
    expect(resultado.fuentes.find((f) => f.doc_id === 'NOTA-CAMPO-07')?.sospechoso).toBe(true);
  });
});
