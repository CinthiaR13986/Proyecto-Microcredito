import { describe, it, expect } from 'vitest';
import { Dinero } from '../src/dominio/dinero';
import { PlanAmortizacion, MetodoFrances } from '../src/dominio/plan-amortizacion';

/**
 * ORÁCULO OBLIGATORIO (sección 6.4.1):
 * P = Q10,000.00 · TNA 36 % nominal → i = 3 % mensual · n = 12 cuotas.
 * [saldoInicial, cuota, interes, amortizacion, saldoFinal]
 */
const TABLA_ESPERADA: Array<[number, number, number, number, number]> = [
  [10000.0, 1004.62, 300.0, 704.62, 9295.38],
  [9295.38, 1004.62, 278.86, 725.76, 8569.62],
  [8569.62, 1004.62, 257.09, 747.53, 7822.09],
  [7822.09, 1004.62, 234.66, 769.96, 7052.13],
  [7052.13, 1004.62, 211.56, 793.06, 6259.07],
  [6259.07, 1004.62, 187.77, 816.85, 5442.22],
  [5442.22, 1004.62, 163.27, 841.35, 4600.87],
  [4600.87, 1004.62, 138.03, 866.59, 3734.28],
  [3734.28, 1004.62, 112.03, 892.59, 2841.69],
  [2841.69, 1004.62, 85.25, 919.37, 1922.32],
  [1922.32, 1004.62, 57.67, 946.95, 975.37],
  [975.37, 1004.63, 29.26, 975.37, 0.0],
];

const planDeReferencia = () =>
  PlanAmortizacion.generar({
    capital: Dinero.de(10000),
    tasaMensual: 0.03,
    numeroCuotas: 12,
    metodo: MetodoFrances,
  });

describe('Plan de amortización francés (sección 6.4.1)', () => {
  it('reproduce la tabla de referencia celda por celda (12 filas)', () => {
    const filas = planDeReferencia().cuotas;
    expect(filas).toHaveLength(12);
    filas.forEach((f, idx) => {
      const [si, c, i, a, sf] = TABLA_ESPERADA[idx]!;
      expect(f.numero).toBe(idx + 1);
      expect(f.saldoInicial.aNumero()).toBe(si);
      expect(f.cuota.aNumero()).toBe(c);
      expect(f.interes.aNumero()).toBe(i);
      expect(f.amortizacion.aNumero()).toBe(a);
      expect(f.saldoFinal.aNumero()).toBe(sf);
    });
  });

  it('invariantes 6.10: Σ amortizaciones = P y saldo final = 0.00', () => {
    const p = planDeReferencia();
    expect(p.totalAmortizacion.aNumero()).toBe(10000);
    expect(p.saldoFinal.aNumero()).toBe(0);
  });

  it('totales de la tabla: pagado 12,055.45 e interés 2,055.45', () => {
    const p = planDeReferencia();
    expect(p.totalPagado.aNumero()).toBe(12055.45);
    expect(p.totalInteres.aNumero()).toBe(2055.45);
  });

  it('ningún saldo de capital es negativo (invariante 6.10)', () => {
    planDeReferencia().cuotas.forEach((f) => {
      expect(f.saldoFinal.esNegativo()).toBe(false);
    });
  });

  it('la última cuota absorbe el ajuste de cuadre (un centavo más)', () => {
    const filas = planDeReferencia().cuotas;
    const ultima = filas[filas.length - 1]!;
    const anterior = filas[filas.length - 2]!;
    expect(ultima.cuota.aNumero()).toBe(anterior.cuota.aNumero() + 0.01);
  });

  it('caso especial i = 0: cuota = P / n y el plan cuadra', () => {
    const p = PlanAmortizacion.generar({
      capital: Dinero.de(1200),
      tasaMensual: 0,
      numeroCuotas: 6,
    });
    expect(p.cuotas[0]!.cuota.aNumero()).toBe(200);
    expect(p.totalAmortizacion.aNumero()).toBe(1200);
    expect(p.saldoFinal.aNumero()).toBe(0);
  });
});