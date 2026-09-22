/**
 * cartera.ts — Calidad de la cartera (P1 6.8 + CP-04.3 del P2).
 *
 * CP-04.3: el núcleo expone el DESGLOSE por tramo de la cartera en riesgo
 * (oráculo 7.8) y la cartera en mora (≥1 día), para que el tablero gerencial
 * los CONSUMA y no los recalcule en la interfaz.
 *
 * Reglas P1 vigentes: se suma el saldo de capital COMPLETO de créditos con
 * >30 días o reestructurados; la base excluye incobrables; el porcentaje
 * nunca se reporta solo (se acompaña de lo dado por incobrable).
 */
import { Dinero } from './dinero';
import { clasificarTramo } from './calculadora-mora';

export interface CreditoCartera {
  readonly id: string;
  readonly saldoCapital: Dinero;
  readonly diasDeAtraso: number;
  readonly reestructurado: boolean;
  readonly incobrable: boolean;
}

/** Cubetas del desglose obligatorio (oráculo 7.8). */
export type TramoRiesgo =
  | 'MORA_1'
  | 'MORA_2'
  | 'MORA_3'
  | 'VENCIDO'
  | 'REESTRUCTURADO_AL_DIA';

export interface LineaTramoCartera {
  readonly tramo: TramoRiesgo;
  readonly creditos: number;
  readonly saldoCapital: Dinero;
  readonly porcentaje: number;
}

export interface ResultadoCartera {
  readonly carteraActiva: Dinero;
  readonly montoEnRiesgo: Dinero;
  readonly porcentaje: number;
  readonly totalIncobrables: Dinero;
  /** CP-04.3: todo crédito con ≥1 día de atraso (distinto de "en riesgo"). */
  readonly carteraEnMora: Dinero;
  readonly porcentajeEnMora: number;
  /** CP-04.3: desglose por tramo; la suma de porcentajes = porcentaje total. */
  readonly desglose: readonly LineaTramoCartera[];
}

/** Regla 6.8: >30 días de atraso o reestructurado; incobrables fuera. */
export const estaEnRiesgo = (c: CreditoCartera): boolean =>
  !c.incobrable && (c.diasDeAtraso > 30 || c.reestructurado);

/**
 * Porcentaje redondeado a 2 decimales de una parte sobre una base monetaria.
 * La base se convierte a número plano (base.aNumero()): dividirEntre espera
 * number | string, nunca un Dinero (su toString lleva la "Q" decorativa).
 */
const porcentajeDe = (parte: Dinero, base: Dinero): number =>
  base.esCero()
    ? 0
    : parte
        .dividirEntre(base.aNumero())
        .multiplicarPor(100)
        .redondeado()
        .aNumero();

const BUCKETS: readonly TramoRiesgo[] = [
  'MORA_1',
  'MORA_2',
  'MORA_3',
  'VENCIDO',
  'REESTRUCTURADO_AL_DIA',
];

/** Cubeta de un crédito que YA está en riesgo. */
function tramoDeRiesgo(c: CreditoCartera): TramoRiesgo {
  if (c.diasDeAtraso === 0) return 'REESTRUCTURADO_AL_DIA'; // solo si es reestructurado
  switch (clasificarTramo(c.diasDeAtraso)) {
    case 'MORA_1':
      return 'MORA_1';
    case 'MORA_2':
      return 'MORA_2';
    case 'MORA_3':
      return 'MORA_3';
    default:
      return 'VENCIDO';
  }
}

export function calcularCarteraEnRiesgo(
  cartera: readonly CreditoCartera[],
): ResultadoCartera {
  const activos = cartera.filter((c) => !c.incobrable);
  const carteraActiva = activos.reduce(
    (acc, c) => acc.sumar(c.saldoCapital),
    Dinero.cero(),
  );
  const enRiesgo = activos.filter(estaEnRiesgo);
  const montoEnRiesgo = enRiesgo.reduce(
    (acc, c) => acc.sumar(c.saldoCapital),
    Dinero.cero(),
  );
  const totalIncobrables = cartera
    .filter((c) => c.incobrable)
    .reduce((acc, c) => acc.sumar(c.saldoCapital), Dinero.cero());
  const carteraEnMora = activos
    .filter((c) => c.diasDeAtraso >= 1)
    .reduce((acc, c) => acc.sumar(c.saldoCapital), Dinero.cero());

  const desglose: LineaTramoCartera[] = BUCKETS.map((tramo) => {
    const delTramo = enRiesgo.filter((c) => tramoDeRiesgo(c) === tramo);
    const saldo = delTramo.reduce(
      (acc, c) => acc.sumar(c.saldoCapital),
      Dinero.cero(),
    );
    return {
      tramo,
      creditos: delTramo.length,
      saldoCapital: saldo,
      porcentaje: porcentajeDe(saldo, carteraActiva),
    };
  });

  return {
    carteraActiva,
    montoEnRiesgo,
    porcentaje: porcentajeDe(montoEnRiesgo, carteraActiva),
    totalIncobrables,
    carteraEnMora,
    porcentajeEnMora: porcentajeDe(carteraEnMora, carteraActiva),
    desglose,
  };
}