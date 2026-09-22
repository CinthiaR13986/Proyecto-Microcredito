/**
 * devengo.ts — CP-04.2: suspensión de devengo CUANTIFICADA (P1 6.5).
 *
 * A partir del día 91 el crédito deja de devengar interés corriente como
 * ingreso: lo no reconocido se acumula en interesEnSuspenso (cuenta de
 * orden, NUNCA ingreso). Al regularizar, el devengo se reactiva y lo
 * acumulado se reconoce en el período de la regularización.
 *
 * Verificable: entre un corte al día 90 y otro al día 100, el ingreso por
 * interés corriente NO aumenta y el interés en suspenso SÍ.
 */
import { Dinero } from './dinero';

/** Día límite de devengo de interés corriente (P1 6.5). */
export const DIA_SUSPENSION_DEVENGO = 90;

export interface Devengo {
  /** Ingreso reconocido del período. */
  readonly reconocido: Dinero;
  /** Cuenta de orden: nunca ingreso hasta regularizar. */
  readonly enSuspenso: Dinero;
}

/** Devengo diario proporcional a la tasa mensual (mes de 30 días). */
export function devengoDiario(saldoCapital: Dinero, tasaMensual: number | string): Dinero {
  return saldoCapital.multiplicarPor(tasaMensual).dividirEntre(30);
}

/** Devengo de interés corriente de un crédito, según sus días de atraso. */
export function devengarInteresCorriente(
  saldoCapital: Dinero,
  tasaMensual: number | string,
  diasDeAtraso: number,
): Devengo {
  const dias = Math.max(0, diasDeAtraso);
  const diario = devengoDiario(saldoCapital, tasaMensual);
  const diasReconocidos = Math.min(dias, DIA_SUSPENSION_DEVENGO);
  const diasEnSuspenso = Math.max(0, dias - DIA_SUSPENSION_DEVENGO);
  return {
    reconocido: diario.multiplicarPor(diasReconocidos).redondeado(),
    enSuspenso: diario.multiplicarPor(diasEnSuspenso).redondeado(),
  };
}

/** Al regularizar: lo acumulado en suspenso se reconoce en el período. */
export function reconocerSuspenso(acumulado: Dinero): { ingresoDelPeriodo: Dinero } {
  return { ingresoDelPeriodo: acumulado };
}