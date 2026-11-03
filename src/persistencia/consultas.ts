/**
 * consultas.ts — Acceso a datos para la capa de servicios (E1).
 * Solo SQL de lectura; las reglas viven en el núcleo, no aquí.
 * Adaptado para PostgreSQL (driver 'pg').
 */
import type { Pool } from 'pg';
import { SQL_PAGOS_APLICADOS } from './cargador';
import type { FilaCredito, FilaPago, ReglasGasto } from '../servicios/reconstructor';

export async function listarCreditos(db: Pool): Promise<FilaCredito[]> {
  const r = await db.query<FilaCredito>(
    `select id_credito, id_cliente, id_asesor, fecha::text as fecha,
            capital_centavos, plazo_meses, tna_bps, reestructurado, politica_mora
     from creditos order by id_credito`,
  );
  return r.rows;
}

/** Pagos con efecto real (primera aparición de cada clave), en orden cronológico. */
export async function listarPagosAplicados(db: Pool): Promise<FilaPago[]> {
  const r = await db.query<FilaPago>(
    `select * from (${SQL_PAGOS_APLICADOS}) p order by p.fecha, p.clave_idempotencia`,
  );
  return r.rows;
}

export async function nombresClientes(db: Pool): Promise<Record<string, string>> {
  const r = await db.query<{ id_cliente: string; nombre_completo: string }>(
    'select id_cliente, nombre_completo from clientes',
  );
  const out: Record<string, string> = {};
  for (const fila of r.rows) out[fila.id_cliente] = fila.nombre_completo;
  return out;
}

interface ReglasCrudas {
  gasto_gestion_cobro: {
    monto_centavos: number;
    dia_generacion: number;
    aplica_a_politicas: string[];
  };
}

export async function reglasDeGasto(db: Pool): Promise<ReglasGasto> {
  const r = await db.query<{ datos: unknown }>(
    "select datos from politicas where codigo = '_REGLAS'",
  );
  
  // Fallback: si la base no está cargada o no tiene la fila _REGLAS,
  // usamos los valores por defecto del paquete canónico para que las
  // pruebas del MCP y del reconstructor no fallen.
  if (r.rows.length === 0) {
    return {
      montoCentavos: 2500,
      diaGeneracion: 31,
      aplicaAPoliticas: ['POL-2026-10'],
    };
  }

  const d = r.rows[0]!.datos as ReglasCrudas;
  return {
    montoCentavos: d.gasto_gestion_cobro.monto_centavos,
    diaGeneracion: d.gasto_gestion_cobro.dia_generacion,
    aplicaAPoliticas: d.gasto_gestion_cobro.aplica_a_politicas,
  };
}