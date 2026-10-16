/**
 * consultas.ts — Acceso a datos para la capa de servicios (E1).
 * Solo SQL de lectura; las reglas viven en el núcleo, no aquí.
 */
import type { PGlite } from '@electric-sql/pglite';
import { SQL_PAGOS_APLICADOS } from './cargador';
import type { FilaCredito, FilaPago, ReglasGasto } from '../servicios/reconstructor';

export async function listarCreditos(db: PGlite): Promise<FilaCredito[]> {
  const r = await db.query<FilaCredito>(
    `select id_credito, id_cliente, id_asesor, fecha::text as fecha,
            capital_centavos, plazo_meses, tna_bps, reestructurado, politica_mora
     from creditos order by id_credito`,
  );
  return r.rows;
}

/** Pagos con efecto real (primera aparición de cada clave), en orden cronológico. */
export async function listarPagosAplicados(db: PGlite): Promise<FilaPago[]> {
  const r = await db.query<FilaPago>(
    `select * from (${SQL_PAGOS_APLICADOS}) p order by p.fecha, p.clave_idempotencia`,
  );
  return r.rows;
}

export async function nombresClientes(db: PGlite): Promise<Record<string, string>> {
  const r = await db.query<{ id_cliente: string; nombre_completo: string }>(
    'select id_cliente, nombre_completo from clientes',
  );
  const out: Record<string, string> = {};
  for (const fila of r.rows) out[fila.id_cliente] = fila.nombre_completo;
  return out;
}

interface ReglasCrudas {
  gasto_gestion_cobro: { monto_centavos: number; dia_generacion: number; aplica_a_politicas: string[] };
}

export async function reglasDeGasto(db: PGlite): Promise<ReglasGasto> {
  const r = await db.query<{ datos: unknown }>(
    "select datos from politicas where codigo = '_REGLAS'",
  );
  const d = r.rows[0]!.datos as ReglasCrudas;
  return {
    montoCentavos: d.gasto_gestion_cobro.monto_centavos,
    diaGeneracion: d.gasto_gestion_cobro.dia_generacion,
    aplicaAPoliticas: d.gasto_gestion_cobro.aplica_a_politicas,
  };
}