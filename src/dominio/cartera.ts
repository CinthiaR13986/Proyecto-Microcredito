/**
 * cartera.ts — Calidad de cartera: cartera en riesgo (sección 6.8).
 *
 * Reglas de negocio (6.8 / 6.8.1):
 *  - En riesgo: saldo de capital COMPLETO de créditos con más de 30 días
 *    de atraso, MÁS los reestructurados (aunque estén al día).
 *  - Los incobrables NO entran: ya salieron de la cartera (baja contable).
 *  - porcentaje = montoEnRiesgo / carteraActiva, entre 0 % y 100 % (6.10).
 *  - El indicador nunca se reporta solo: se acompaña de lo dado por
 *    incobrable en el período (la "trampa" del 6.06 %).
 *
 * Diseño: estaEnRiesgo es una regla de clasificación componible
 * (patrón Specification), verificable por separado.
 */
import Decimal from 'decimal.js';
import { Dinero } from './dinero';

/** Vista mínima de un crédito para el indicador de cartera. */
export interface CreditoCartera {
  readonly id: string;
  readonly saldoCapital: Dinero;
  readonly diasDeAtraso: number;
  readonly reestructurado: boolean;
  readonly incobrable: boolean;
}

/**
 * Regla de riesgo (6.8): más de 30 días de atraso, o reestructurado.
 * Un incobrable nunca cuenta: ya salió de la cartera.
 */
export const estaEnRiesgo = (c: CreditoCartera): boolean =>
  !c.incobrable && (c.diasDeAtraso > 30 || c.reestructurado);

export interface ResultadoCartera {
  readonly carteraActiva: Dinero;
  readonly montoEnRiesgo: Dinero;
  /** Porcentaje 0–100 redondeado a 2 decimales (ej. 7.00). */
  readonly porcentaje: number;
  /** Lo dado por incobrable (se reporta junto, regla 6.8.1). */
  readonly totalIncobrables: Dinero;
}

/** Calcula el indicador de cartera en riesgo sobre una cartera dada. */
export function calcularCarteraEnRiesgo(
  creditos: readonly CreditoCartera[],
): ResultadoCartera {
  let activa = Dinero.cero();
  let riesgo = Dinero.cero();
  let incobrables = Dinero.cero();

  for (const c of creditos) {
    if (c.incobrable) {
      // Baja contable: fuera de la base activa (6.8).
      incobrables = incobrables.sumar(c.saldoCapital);
      continue;
    }
    activa = activa.sumar(c.saldoCapital);
    if (estaEnRiesgo(c)) {
      // Todo el saldo de capital, no solo la cuota vencida (6.8).
      riesgo = riesgo.sumar(c.saldoCapital);
    }
  }

  const porcentaje = activa.esCero()
    ? 0
    : new Decimal(riesgo.aNumero())
        .dividedBy(new Decimal(activa.aNumero()))
        .times(100)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();

  if (porcentaje < 0 || porcentaje > 100) {
    throw new Error('Cartera: porcentaje fuera de 0–100 (invariante 6.10)');
  }

  return { carteraActiva: activa, montoEnRiesgo: riesgo, porcentaje, totalIncobrables: incobrables };
}