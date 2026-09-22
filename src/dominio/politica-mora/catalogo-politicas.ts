/**
 * catalogo-politicas.ts — Resolución de política por fecha de otorgamiento (CP-03).
 */
import { POLITICA_ESCALONADA } from './politica-escalonada';
import { POLITICA_PLANA } from './politica-plana';
import type { PoliticaMora } from './politica-mora';

/** Vigencia dispuesta por el Comité en Acta 09-2026. */
export const VIGENCIA_ESCALONADA = '2026-10-01';

export function resolverPoliticaMora(fechaOtorgamiento: string): PoliticaMora {
  // Comparación lexicográfica de fechas ISO: segura y determinista.
  return fechaOtorgamiento < VIGENCIA_ESCALONADA ? POLITICA_PLANA : POLITICA_ESCALONADA;
}