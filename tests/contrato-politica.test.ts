import { describe, it, expect } from 'vitest';
import { Dinero } from '../src/dominio/dinero';
import type { PoliticaMora } from '../src/dominio/politica-mora/politica-mora';
import { POLITICA_PLANA } from '../src/dominio/politica-mora/politica-plana';
import { POLITICA_ESCALONADA } from '../src/dominio/politica-mora/politica-escalonada';
import { POLITICA_RETROACTIVA } from '../src/dominio/politica-mora/politica-retroactiva';

const CAPITAL = Dinero.de(725.76);
const DIAS = [1, 15, 30, 31, 45, 60, 61, 90, 91, 100, 120, 121, 200];

const baterias: Array<[string, PoliticaMora]> = [
  ['plana POL-2024-01', POLITICA_PLANA],
  ['escalonada POL-2026-10', POLITICA_ESCALONADA],
  ['retroactiva (no adoptada)', POLITICA_RETROACTIVA],
];

for (const [nombre, politica] of baterias) {
  describe(`Contrato de PoliticaMora (sustitución de Liskov) — ${nombre}`, () => {
    it('0 días de atraso → Q0.00', () => {
      expect(politica.interesMoratorio(CAPITAL, 0).esCero()).toBe(true);
    });

    it('monótono creciente: más días nunca dan menos mora', () => {
      for (let i = 1; i < DIAS.length; i++) {
        const antes = politica.interesMoratorio(CAPITAL, DIAS[i - 1]!).aNumero();
        const ahora = politica.interesMoratorio(CAPITAL, DIAS[i]!).aNumero();
        expect(ahora).toBeGreaterThanOrEqual(antes);
      }
    });

    it('tope: nunca excede el capital en mora', () => {
      for (const d of DIAS) {
        expect(politica.interesMoratorio(CAPITAL, d).esMayorQue(CAPITAL)).toBe(false);
      }
    });

    it('determinista y sin anatocismo: mismo capital y días → mismo resultado', () => {
      const a = politica.interesMoratorio(CAPITAL, 45);
      const b = politica.interesMoratorio(Dinero.de(725.76), 45);
      expect(a.esIgualA(b)).toBe(true);
    });
  });
}

describe('Relación entre políticas (invariante 7.9)', () => {
  it('escalonada ≤ retroactiva para todo atraso', () => {
    for (const d of DIAS) {
      expect(
        POLITICA_ESCALONADA.interesMoratorio(CAPITAL, d).esMayorQue(
          POLITICA_RETROACTIVA.interesMoratorio(CAPITAL, d),
        ),
      ).toBe(false);
    }
  });
});