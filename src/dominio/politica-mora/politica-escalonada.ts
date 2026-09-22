/**
 * politica-escalonada.ts — POL-2026-10 (Acta 09-2026, vigente 2026-10-01).
 *
 * Regla 7.3: TRAMOS RECORRIDOS, no tramo actual. Cada día se cobra a la
 * tasa del tramo al que ese día pertenece:
 *   dias_en_tramo(d, ini, fin) = max(0, min(d, fin) − ini + 1)
 * Redondeo: UNA SOLA VEZ al final sobre el total de la cuota vencida.
 * Redondear por tramo está prohibido (daría 18.15 en vez de 18.14).
 * Tope (invariante): el moratorio nunca excede el capital en mora.
 * Desde el día 121 el crédito es incobrable y DEJA de devengar (7.4 M-4).
 */
import Decimal from 'decimal.js';
import { Dinero } from '../dinero';
import type { TramoMora } from '../calculadora-mora';
import type { PoliticaMora } from './politica-mora';

const BASE = 360;
const DIAS_MAXIMO_DEVENGO = 120;

interface TarifaTramo {
  readonly tramo: TramoMora;
  readonly ini: number;
  readonly fin: number;
  readonly tna: string;
}

/** Tabla CP-01: política institucional versionada, no constantes de cálculo. */
export const TARIFAS: readonly TarifaTramo[] = [
  { tramo: 'MORA_1', ini: 1, fin: 30, tna: '0.18' },
  { tramo: 'MORA_2', ini: 31, fin: 60, tna: '0.24' },
  { tramo: 'MORA_3', ini: 61, fin: 90, tna: '0.30' },
  { tramo: 'VENCIDO', ini: 91, fin: 120, tna: '0.36' },
];

export const TNA_POR_TRAMO: Record<TramoMora, string | null> = {
  AL_DIA: null,
  MORA_1: '0.18',
  MORA_2: '0.24',
  MORA_3: '0.30',
  VENCIDO: '0.36',
  INCOBRABLE: null,
};

/** Línea interna con precisión Decimal completa. */
interface LineaDecimal {
  readonly tramo: TramoMora;
  readonly tasaTna: string;
  readonly diasEnTramo: number;
  readonly monto: Decimal;
}

/** Una línea del desglose por tramos recorridos (la consumirá la pantalla de mora, E3). */
export interface LineaTramo {
  readonly tramo: TramoMora;
  readonly tasaTna: string;
  readonly diasEnTramo: number;
  /** Monto SIN redondear, con precisión completa (auditoría del redondeo único). */
  readonly montoSinRedondear: number;
}

function lineasDecimal(capitalEnMora: Dinero, diasDeAtraso: number): readonly LineaDecimal[] {
  const dias = Math.min(Math.max(diasDeAtraso, 0), DIAS_MAXIMO_DEVENGO);
  const capital = new Decimal(capitalEnMora.aNumero()); // importe monetario a 2 decimales
  const out: LineaDecimal[] = [];
  for (const t of TARIFAS) {
    const diasEnTramo = Math.max(0, Math.min(dias, t.fin) - t.ini + 1);
    if (diasEnTramo === 0) continue;
    const monto = capital.times(new Decimal(t.tna).dividedBy(BASE)).times(diasEnTramo);
    out.push({ tramo: t.tramo, tasaTna: t.tna, diasEnTramo, monto });
  }
  return out;
}

/** Desglose sin redondear: cuánto corresponde a cada tramo recorrido. */
export function tramosRecorridos(
  capitalEnMora: Dinero,
  diasDeAtraso: number,
): readonly LineaTramo[] {
  return lineasDecimal(capitalEnMora, diasDeAtraso).map((l) => ({
    tramo: l.tramo,
    tasaTna: l.tasaTna,
    diasEnTramo: l.diasEnTramo,
    montoSinRedondear: l.monto.toNumber(),
  }));
}

export const POLITICA_ESCALONADA: PoliticaMora = {
  codigo: 'POL-2026-10',
  vigenciaDesde: '2026-10-01',
  descripcion: 'Escalonada por tramos recorridos (Acta 09-2026), redondeo único al final',
  interesMoratorio(capitalEnMora, diasDeAtraso) {
    const total = lineasDecimal(capitalEnMora, diasDeAtraso).reduce(
      (acc, l) => acc.plus(l.monto),
      new Decimal(0),
    );
    const redondeado = Dinero.de(
      total.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2), // redondeo ÚNICO
    );
    return Dinero.menor(redondeado, capitalEnMora); // tope: nunca excede su capital
  },
};