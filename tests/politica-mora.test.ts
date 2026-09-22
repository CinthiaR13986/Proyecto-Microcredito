import { describe, it, expect } from 'vitest';
import { Dinero } from '../src/dominio/dinero';
import {
  POLITICA_ESCALONADA,
  tramosRecorridos,
} from '../src/dominio/politica-mora/politica-escalonada';
import { POLITICA_PLANA } from '../src/dominio/politica-mora/politica-plana';
import { POLITICA_RETROACTIVA } from '../src/dominio/politica-mora/politica-retroactiva';
import { resolverPoliticaMora } from '../src/dominio/politica-mora/catalogo-politicas';
import { evaluarGastoGestion } from '../src/dominio/gasto-gestion-cobro';

/** Capital en mora e interés corriente del caso de referencia (cuota 2, P1). */
const CAPITAL = () => Dinero.de(725.76);
const CORRIENTE = () => Dinero.de(278.86);

describe('CP-01 · política escalonada — oráculos obligatorios (7.4)', () => {
  it('M-1: 15 días (solo Mora 1) → Q5.44', () => {
    expect(POLITICA_ESCALONADA.interesMoratorio(CAPITAL(), 15).aNumero()).toBe(5.44);
  });

  it('M-2: 45 días (Mora 1 completo + Mora 2 parcial) → Q18.14', () => {
    expect(POLITICA_ESCALONADA.interesMoratorio(CAPITAL(), 45).aNumero()).toBe(18.14);
  });

  it('M-3: 100 días (los cuatro tramos) → Q50.80', () => {
    expect(POLITICA_ESCALONADA.interesMoratorio(CAPITAL(), 100).aNumero()).toBe(50.8);
  });

  it('M-4: 120 días (frontera con incobrable) → Q65.32', () => {
    expect(POLITICA_ESCALONADA.interesMoratorio(CAPITAL(), 120).aNumero()).toBe(65.32);
  });

  it('trampa del redondeo por tramo: sin redondear suma 18.1440 (no 18.15)', () => {
    const lineas = tramosRecorridos(CAPITAL(), 45);
    const suma = lineas.reduce((acc, l) => acc + l.montoSinRedondear, 0);
    expect(suma.toFixed(4)).toBe('18.1440');
    expect(lineas).toHaveLength(2); // Mora 1 (30d) y Mora 2 (15d)
  });

  it('frontera obligatoria: moratorio(121) no supera moratorio(120)', () => {
    const m120 = POLITICA_ESCALONADA.interesMoratorio(CAPITAL(), 120).aNumero();
    const m121 = POLITICA_ESCALONADA.interesMoratorio(CAPITAL(), 121).aNumero();
    expect(m121).toBeLessThanOrEqual(m120);
  });

  it('tope (invariante): el moratorio nunca excede su capital en mora', () => {
    for (const d of [1, 30, 45, 90, 120, 121]) {
      expect(POLITICA_ESCALONADA.interesMoratorio(CAPITAL(), d).esMayorQue(CAPITAL())).toBe(false);
    }
  });

  it('equivalencia primer tramo: 1≤d≤30 idéntica a plana 18%', () => {
    for (let d = 1; d <= 30; d++) {
      const esc = POLITICA_ESCALONADA.interesMoratorio(CAPITAL(), d).aNumero();
      const plana18 = CAPITAL().multiplicarPor(0.0005).multiplicarPor(d).redondeado().aNumero();
      expect(esc).toBe(plana18);
    }
  });
});

describe('CP-03 · coexistencia de políticas por fecha de otorgamiento', () => {
  it('CV-2026-0100 (15-ago-2026) → plana: 45 días = Q21.77', () => {
    const p = resolverPoliticaMora('2026-08-15');
    expect(p.codigo).toBe('POL-2024-01');
    expect(p.interesMoratorio(CAPITAL(), 45).aNumero()).toBe(21.77);
  });

  it('CV-2026-0410 (10-oct-2026) → escalonada: 45 días = Q18.14', () => {
    const p = resolverPoliticaMora('2026-10-10');
    expect(p.codigo).toBe('POL-2026-10');
    expect(p.interesMoratorio(CAPITAL(), 45).aNumero()).toBe(18.14);
  });

  it('el P1 sigue vivo: plana a 15 días = Q7.26 (prueba original intacta)', () => {
    expect(POLITICA_PLANA.interesMoratorio(CAPITAL(), 15).aNumero()).toBe(7.26);
  });

  it('retroactiva (NO adoptada) a 100 días = Q72.58 (contraste)', () => {
    expect(POLITICA_RETROACTIVA.interesMoratorio(CAPITAL(), 100).aNumero()).toBe(72.58);
  });
});

describe('CP-02 · gasto de gestión de cobro Q25.00 (M-5)', () => {
  it('M-5: total adeudado cuota 2 a 45 días = Q1,047.76', () => {
    const gasto = evaluarGastoGestion({ diasDeAtraso: 45, gastoYaGenerado: false }).monto;
    const mora = POLITICA_ESCALONADA.interesMoratorio(CAPITAL(), 45);
    const total = gasto.sumar(mora).sumar(CORRIENTE()).sumar(CAPITAL());
    expect(total.aNumero()).toBe(1047.76);
  });

  it('a 15 días (Mora 1) NO hay gasto: total Q1,010.06', () => {
    const r = evaluarGastoGestion({ diasDeAtraso: 15, gastoYaGenerado: false });
    expect(r.generado).toBe(false);
    const total = r.monto
      .sumar(POLITICA_ESCALONADA.interesMoratorio(CAPITAL(), 15))
      .sumar(CORRIENTE())
      .sumar(CAPITAL());
    expect(total.aNumero()).toBe(1010.06);
  });

  it('idempotencia: cerrar el día 31 dos veces no duplica el gasto', () => {
    const cierre1 = evaluarGastoGestion({ diasDeAtraso: 31, gastoYaGenerado: false });
    expect(cierre1.generado).toBe(true);
    expect(cierre1.monto.aNumero()).toBe(25);
    const cierre2 = evaluarGastoGestion({ diasDeAtraso: 31, gastoYaGenerado: cierre1.generado });
    expect(cierre2.generado).toBe(false);
    expect(cierre2.monto.esCero()).toBe(true);
  });

  it('subir de Mora 2 a Mora 3 no genera un segundo gasto', () => {
    const r = evaluarGastoGestion({ diasDeAtraso: 75, gastoYaGenerado: true });
    expect(r.generado).toBe(false);
  });
});