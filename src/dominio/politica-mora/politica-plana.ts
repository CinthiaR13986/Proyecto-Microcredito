/**
 * politica-plana.ts — POL-2024-01: 24% TNA plano, base Actual/360 (la del P1).
 *
 * Reutiliza SIN MODIFICAR la función del Proyecto 1 (calculadora-mora.ts):
 * esa es la evidencia de que el motor no se reescribió (OCP).
 * Rige para créditos otorgados antes del 2026-10-01 (CP-03).
 */
import { Dinero } from '../dinero';
import { calcularInteresMoratorio } from '../calculadora-mora';
import type { PoliticaMora } from './politica-mora';

const DIAS_MAXIMO_DEVENGO = 120; // desde 121 es incobrable y no devenga (P1 6.7)

export const POLITICA_PLANA: PoliticaMora = {
  codigo: 'POL-2024-01',
  vigenciaDesde: '2024-01-01',
  descripcion: 'Tasa moratoria plana 24% TNA, base Actual/360 (Proyecto 1)',
  interesMoratorio(capitalEnMora, diasDeAtraso) {
    const dias = Math.min(Math.max(diasDeAtraso, 0), DIAS_MAXIMO_DEVENGO);
    const mora = calcularInteresMoratorio(capitalEnMora, dias, {
      tnaMoratoria: 0.24,
      base: 'ACTUAL_360',
    });
    return Dinero.menor(mora, capitalEnMora); // tope: nunca excede su capital
  },
};