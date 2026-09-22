/**
 * politica-retroactiva.ts — POLÍTICA NO ADOPTADA.
 * Aplica la tasa del TRAMO ACTUAL a TODOS los días (prohibido como regla
 * del sistema, 7.3). Existe únicamente para la prueba de sustituibilidad
 * de Liskov (E6): las tres políticas pasan la misma batería de contrato.
 */
import Decimal from 'decimal.js';
import { Dinero } from '../dinero';
import { clasificarTramo } from '../calculadora-mora';
import { TNA_POR_TRAMO } from './politica-escalonada';
import type { PoliticaMora } from './politica-mora';

const BASE = 360;
const DIAS_MAXIMO_DEVENGO = 120;

export const POLITICA_RETROACTIVA: PoliticaMora = {
  codigo: 'POL-RETRO-PRUEBA',
  vigenciaDesde: '2026-10-01',
  descripcion: 'NO ADOPTADA: tasa del tramo actual sobre todos los días (solo pruebas)',
  interesMoratorio(capitalEnMora, diasDeAtraso) {
    const dias = Math.min(Math.max(diasDeAtraso, 0), DIAS_MAXIMO_DEVENGO);
    if (dias === 0) return Dinero.cero();
    const tna = TNA_POR_TRAMO[clasificarTramo(dias)] ?? '0.36';
    const capital = new Decimal(capitalEnMora.aNumero());
    const mora = capital.times(new Decimal(tna).dividedBy(BASE)).times(dias);
    const redondeado = Dinero.de(
      mora.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
    );
    return Dinero.menor(redondeado, capitalEnMora);
  },
};