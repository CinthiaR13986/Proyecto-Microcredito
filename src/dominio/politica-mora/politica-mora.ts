/**
 * politica-mora.ts — Puerto de política moratoria (CP-01 / CP-03).
 */
import type { Dinero } from '../dinero';

export interface PoliticaMora {
  /** Código de versión de política (ej. POL-2026-10). */
  readonly codigo: string;
  /** Fecha ISO desde la que rige. */
  readonly vigenciaDesde: string;
  readonly descripcion: string;
  /**
   * Interés moratorio de UNA cuota vencida, sobre SU capital en mora
   * (anatocismo prohibido). Redondeo: una sola vez, al final (7.3).
   */
  interesMoratorio(capitalEnMora: Dinero, diasDeAtraso: number): Dinero;
}