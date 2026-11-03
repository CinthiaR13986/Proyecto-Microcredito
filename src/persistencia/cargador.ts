/**
 * cargador.ts — E2 · Carga canónica del paquete de datos (PostgreSQL).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Pool } from 'pg';

export interface ResultadoCarga {
  verificado: boolean;
  sha256: string;
  clientes: number;
  creditos: number;
  pagos: number;
  pagosAplicados: number;
  yaEstabaCargado: boolean;
}

export const SQL_PAGOS_APLICADOS = `
  select distinct on (clave_idempotencia)
         clave_idempotencia, id_credito, fecha::text as fecha, monto_centavos, canal
  from pagos
  order by clave_idempotencia, seq
`;

function leerFilas(ruta: string): string[][] {
  const texto = readFileSync(ruta, 'utf8');
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lineas.slice(1).map((l) => l.split(','));
}

export async function cargarPaquete(db: Pool, dataDir: string): Promise<ResultadoCarga> {
  // ── 1) Huella SHA-256 ────────────────────────────────────────
  const eventos = readFileSync(join(dataDir, 'eventos.jsonl'));
  const sha = createHash('sha256').update(eventos).digest('hex');
  const esperado =
    readFileSync(join(dataDir, 'eventos.sha256'), 'utf8').trim().split(/\s+/)[0] ?? '';
  if (sha !== esperado) {
    throw new Error(
      `Huella SHA-256 NO coincide (esperada ${esperado}, obtenida ${sha}). Carga detenida.`,
    );
  }

  // ── 2) Idempotencia del cargador ─────────────────────────────
  const previa = await db.query<{
    sha256_eventos: string; clientes: number; creditos: number;
    pagos: number; pagos_aplicados: number;
  }>('select sha256_eventos, clientes, creditos, pagos, pagos_aplicados from carga_meta where id = 1');
  if (previa.rows.length === 1) {
    const p = previa.rows[0]!;
    if (p.sha256_eventos !== sha) {
      throw new Error('Ya existe una carga con otra huella. Ejecute npm run db:reset para empezar de cero.');
    }
    return {
      verificado: true, sha256: sha, clientes: p.clientes, creditos: p.creditos,
      pagos: p.pagos, pagosAplicados: p.pagos_aplicados, yaEstabaCargado: true,
    };
  }

  // ── 3) Carga masiva en una sola transacción ──────────────────
  const politicas = JSON.parse(readFileSync(join(dataDir, 'politicas.json'), 'utf8'));
  const desdeEscalonada: string =
    politicas.politicas_mora['POL-2026-10'].vigencia_otorgamiento.desde;

  const asesores = leerFilas(join(dataDir, 'asesores.csv'));
  const clientes = leerFilas(join(dataDir, 'clientes.csv'));
  const creditos = leerFilas(join(dataDir, 'creditos.csv'));
  const pagos = leerFilas(join(dataDir, 'pagos.csv'));
  const pagosAplicados = new Set(pagos.map((p) => p[0])).size;

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const a of asesores) {
      await client.query(
        'insert into asesores (id_asesor, nombre_completo) values ($1,$2) on conflict do nothing',
        [a[0], a[1]],
      );
    }
    for (const c of clientes) {
      await client.query(
        'insert into clientes (id_cliente, nombre_completo, dpi, telefono, municipio, fecha_alta) values ($1,$2,$3,$4,$5,$6) on conflict do nothing',
        c,
      );
    }
    for (const cr of creditos) {
      const politica = cr[3]! < desdeEscalonada ? 'POL-2024-01' : 'POL-2026-10';
      await client.query(
        `insert into creditos (id_credito, id_cliente, id_asesor, fecha, capital_centavos, plazo_meses, tna_bps, reestructurado, politica_mora)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict do nothing`,
        [cr[0], cr[1], cr[2], cr[3], cr[4], cr[5], cr[6], cr[7] === 'true', politica],
      );
    }
    for (const p of pagos) {
      await client.query(
        'insert into pagos (clave_idempotencia, id_credito, fecha, monto_centavos, canal) values ($1,$2,$3,$4,$5)',
        p,
      );
    }
    for (const [codigo, datos] of Object.entries(politicas.politicas_mora)) {
      await client.query(
        'insert into politicas (codigo, datos) values ($1,$2) on conflict do nothing',
        [codigo, JSON.stringify(datos)],
      );
    }
    await client.query(
      'insert into politicas (codigo, datos) values ($1,$2) on conflict do nothing',
      ['_REGLAS', JSON.stringify({
        gasto_gestion_cobro: politicas.gasto_gestion_cobro,
        regla_incobrable_dias: politicas.regla_incobrable_dias,
        regla_riesgo_dias: politicas.regla_riesgo_dias,
        base_conteo: politicas.base_conteo,
      })],
    );
    await client.query(
      'insert into carga_meta (id, sha256_eventos, clientes, creditos, pagos, pagos_aplicados) values (1,$1,$2,$3,$4,$5)',
      [sha, clientes.length, creditos.length, pagos.length, pagosAplicados],
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  return {
    verificado: true, sha256: sha, clientes: clientes.length, creditos: creditos.length,
    pagos: pagos.length, pagosAplicados, yaEstabaCargado: false,
  };
}