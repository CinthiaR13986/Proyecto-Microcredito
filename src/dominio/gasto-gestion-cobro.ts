/**
 * gasto-gestion-cobro.ts — CP-02: gasto de gestión de cobro en campo.
 */
import { Dinero } from './dinero';

/** Monto de política versionada (CP-02); parámetro, no constante de cálculo. */
export const MONTO_GESTION_COBRO = Dinero.de(25);

/** Día en que la visita se genera: entrada a Mora 2. */
export const DIA_GENERACION = 31;

export interface EstadoCuotaVencida {
  readonly diasDeAtraso: number;
  readonly gastoYaGenerado: boolean;
}

export interface EvaluacionGasto {
  readonly generado: boolean;
  readonly monto: Dinero;
}

/** Decisión pura: ¿este cierre genera el gasto de esta cuota? */
export function evaluarGastoGestion(
  cuota: EstadoCuotaVencida,
  monto: Dinero = MONTO_GESTION_COBRO,
): EvaluacionGasto {
  const generado = !cuota.gastoYaGenerado && cuota.diasDeAtraso >= DIA_GENERACION;
  return { generado, monto: generado ? monto : Dinero.cero() };
}