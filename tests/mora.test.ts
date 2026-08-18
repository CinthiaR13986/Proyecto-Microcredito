import { describe, it, expect } from 'vitest';
import { Dinero } from '../src/dominio/dinero';
import {
  calcularInteresMoratorio,
  calcularMoratorioTotal,
  clasificarTramo,
  POLITICA_REFERENCIA,
} from '../src/dominio/calculadora-mora';

describe('Interés moratorio (sección 6.5)', () => {
  it('reproduce el ejemplo obligatorio: Q7.26', () => {
    const capitalEnMora = Dinero.de(725.76); // amortización de la cuota 2
    const interes = calcularInteresMoratorio(capitalEnMora, 15, POLITICA_REFERENCIA);
    expect(interes.aNumero()).toBe(7.26);
  });

  it('la base de conteo cambia el resultado: A/365 da Q7.16', () => {
    const interes = calcularInteresMoratorio(Dinero.de(725.76), 15, {
      tnaMoratoria: 0.24,
      base: 'ACTUAL_365',
    });
    expect(interes.aNumero()).toBe(7.16);
  });

  it('sin atraso no hay moratorio: 0 días = Q0.00', () => {
    const interes = calcularInteresMoratorio(Dinero.de(725.76), 0, POLITICA_REFERENCIA);
    expect(interes.esCero()).toBe(true);
  });

  it('dos cuotas vencidas = dos cálculos propios, no uno sobre la suma', () => {
    const total = calcularMoratorioTotal(
      [
        { capitalEnMora: Dinero.de(725.76), diasDeAtraso: 15 }, // Q7.26
        { capitalEnMora: Dinero.de(747.53), diasDeAtraso: 5 }, // Q2.49
      ],
      POLITICA_REFERENCIA,
    );
    expect(total.aNumero()).toBe(9.75);
  });

  it('rechaza días de atraso negativos', () => {
    expect(() => calcularInteresMoratorio(Dinero.de(100), -3, POLITICA_REFERENCIA)).toThrow();
  });
});

describe('Tramos de mora: clasificación derivada y reversible (6.5 / 6.7)', () => {
  it('clasifica correctamente en las fronteras de cada tramo', () => {
    expect(clasificarTramo(0)).toBe('AL_DIA');
    expect(clasificarTramo(1)).toBe('MORA_1');
    expect(clasificarTramo(30)).toBe('MORA_1');
    expect(clasificarTramo(31)).toBe('MORA_2');
    expect(clasificarTramo(60)).toBe('MORA_2');
    expect(clasificarTramo(61)).toBe('MORA_3');
    expect(clasificarTramo(90)).toBe('MORA_3');
    expect(clasificarTramo(91)).toBe('VENCIDO');
    expect(clasificarTramo(120)).toBe('VENCIDO');
    expect(clasificarTramo(121)).toBe('INCOBRABLE');
    expect(clasificarTramo(210)).toBe('INCOBRABLE');
  });

  it('es reversible: baja de tramo cuando el pago reduce el atraso', () => {
    expect(clasificarTramo(45)).toBe('MORA_2');  // cliente en Mora 2
    expect(clasificarTramo(10)).toBe('MORA_1');  // paga y su atraso baja a 10 días
    expect(clasificarTramo(0)).toBe('AL_DIA');   // paga todo lo vencido
  });
});