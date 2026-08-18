/**
 * calculadora-mora.ts — Interés moratorio y tramos de mora.
 *
 * Reglas de negocio (sección 6.5):
 *  - Días de atraso: días calendario desde el vencimiento hasta el corte.
 *    Se RECIBEN como parámetro: el núcleo nunca lee la fecha del sistema
 *    (puerto Reloj, aceptación de E4).
 *  - El interés moratorio se calcula EXCLUSIVAMENTE sobre el capital en mora,
 *    NUNCA sobre intereses (prohibición de anatocismo, Código Civil,
 *    Decreto-Ley 106).
 *  - interes_moratorio = capital_en_mora × (TNA_moratoria / base) × días.
 *  - Redondeo a centavos POR CUOTA, no al final (6.2).
 *  - Tramos (clasificación derivada, reversible, 6.7):
 *    Mora 1 (1–30), Mora 2 (31–60), Mora 3 (61–90), Vencido (91–120),
 *    Incobrable (>120).
 *
 * Diseño: la política (TNA moratoria y base de conteo) es un PARÁMETRO
 * versionado, nunca una constante del cálculo (6.1 / 6.3).
 */
import { Dinero } from './dinero';

/** Base de conteo de días para el moratorio (sección 6.3). */
export type BaseConteo = 'ACTUAL_360' | 'ACTUAL_365' | '30_360';

const DIVISOR_BASE: Record<BaseConteo, number> = {
  ACTUAL_360: 360,
  ACTUAL_365: 365,
  '30_360': 360,
};

/** Política moratoria institucional: parámetro versionado, no constante. */
export interface PoliticaMoratoria {
  readonly tnaMoratoria: number | string; // ej. 0.24 = 24 % TNA moratoria
  readonly base: BaseConteo;
}

/** Política del caso de referencia (6.5): 24 % TNA moratoria, base Actual/360. */
export const POLITICA_REFERENCIA: PoliticaMoratoria = {
  tnaMoratoria: 0.24,
  base: 'ACTUAL_360',
};

/** Tramo de mora: clasificación DERIVADA, no es un estado (6.7). */
export type TramoMora =
  | 'AL_DIA'
  | 'MORA_1'
  | 'MORA_2'
  | 'MORA_3'
  | 'VENCIDO'
  | 'INCOBRABLE';

/**
 * Clasifica según días de atraso. Pura y bidireccional: la misma función
 * sirve cuando el tramo sube (pasa el tiempo sin pago) y cuando baja
 * (un pago reduce el atraso).
 */
export function clasificarTramo(diasDeAtraso: number): TramoMora {
  if (!Number.isInteger(diasDeAtraso) || diasDeAtraso < 0) {
    throw new Error('clasificarTramo: los días de atraso deben ser un entero >= 0');
  }
  if (diasDeAtraso === 0) return 'AL_DIA';
  if (diasDeAtraso <= 30) return 'MORA_1';
  if (diasDeAtraso <= 60) return 'MORA_2';
  if (diasDeAtraso <= 90) return 'MORA_3';
  if (diasDeAtraso <= 120) return 'VENCIDO';
  return 'INCOBRABLE';
}

/**
 * Interés moratorio de UNA cuota vencida (6.5).
 * Solo sobre el capital en mora: jamás incluye el interés de la cuota
 * (anatocismo prohibido).
 */
export function calcularInteresMoratorio(
  capitalEnMora: Dinero,
  diasDeAtraso: number,
  politica: PoliticaMoratoria,
): Dinero {
  if (!Number.isInteger(diasDeAtraso) || diasDeAtraso < 0) {
    throw new Error('calcularInteresMoratorio: días de atraso inválidos');
  }
  if (diasDeAtraso === 0) {
    return Dinero.cero(); // sin atraso no hay penalización
  }
  return capitalEnMora
    .multiplicarPor(politica.tnaMoratoria)
    .dividirEntre(DIVISOR_BASE[politica.base])
    .multiplicarPor(diasDeAtraso)
    .redondeado(); // redondeo por cuota (6.2)
}

/** Una cuota vencida, con su propio capital y sus propios días de atraso. */
export interface CuotaVencida {
  readonly capitalEnMora: Dinero;
  readonly diasDeAtraso: number;
}

/**
 * Moratorio con varias cuotas vencidas (6.5): cada cuota genera su propio
 * cálculo sobre su propio capital y sus propios días; NUNCA uno sobre la suma.
 */
export function calcularMoratorioTotal(
  cuotasVencidas: readonly CuotaVencida[],
  politica: PoliticaMoratoria,
): Dinero {
  return cuotasVencidas.reduce(
    (acc, c) =>
      acc.sumar(calcularInteresMoratorio(c.capitalEnMora, c.diasDeAtraso, politica)),
    Dinero.cero(),
  );
}