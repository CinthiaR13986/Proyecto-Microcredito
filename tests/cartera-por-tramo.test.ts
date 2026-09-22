import { describe, it, expect } from 'vitest';
import { Dinero } from '../src/dominio/dinero';
import { calcularCarteraEnRiesgo, type CreditoCartera } from '../src/dominio/cartera';

/** Misma cartera de siete créditos del P1 6.8.1. */
const cartera = (): CreditoCartera[] => [
  { id: 'C-001', saldoCapital: Dinero.de(620000), diasDeAtraso: 0, reestructurado: false, incobrable: false },
  { id: 'C-002', saldoCapital: Dinero.de(124000), diasDeAtraso: 8, reestructurado: false, incobrable: false },
  { id: 'C-003', saldoCapital: Dinero.de(24000), diasDeAtraso: 45, reestructurado: false, incobrable: false },
  { id: 'C-004', saldoCapital: Dinero.de(18000), diasDeAtraso: 75, reestructurado: false, incobrable: false },
  { id: 'C-005', saldoCapital: Dinero.de(8000), diasDeAtraso: 100, reestructurado: false, incobrable: false },
  { id: 'C-006', saldoCapital: Dinero.de(6000), diasDeAtraso: 0, reestructurado: true, incobrable: false },
  { id: 'C-007', saldoCapital: Dinero.de(15000), diasDeAtraso: 210, reestructurado: false, incobrable: true },
];

describe('CP-04.3 · desglose de cartera en riesgo por tramo (oráculo 7.8)', () => {
  it('reproduce el desglose obligatorio tramo por tramo', () => {
    const r = calcularCarteraEnRiesgo(cartera());
    const porTramo = Object.fromEntries(r.desglose.map((l) => [l.tramo, l]));
    expect(porTramo.MORA_1!.creditos).toBe(0);
    expect(porTramo.MORA_1!.porcentaje).toBe(0);
    expect(porTramo.MORA_2!.creditos).toBe(1);
    expect(porTramo.MORA_2!.saldoCapital.aNumero()).toBe(24000);
    expect(porTramo.MORA_2!.porcentaje).toBe(3);
    expect(porTramo.MORA_3!.porcentaje).toBe(2.25);
    expect(porTramo.VENCIDO!.porcentaje).toBe(1);
    expect(porTramo.REESTRUCTURADO_AL_DIA!.porcentaje).toBe(0.75);
  });

  it('la suma de porcentajes por tramo = total 7.00 sin error de redondeo', () => {
    const r = calcularCarteraEnRiesgo(cartera());
    const suma = r.desglose.reduce((acc, l) => acc + l.porcentaje, 0);
    expect(suma.toFixed(2)).toBe(r.porcentaje.toFixed(2));
    expect(r.porcentaje.toFixed(2)).toBe('7.00');
  });

  it('cartera en mora (≥1 día) = Q174,000 = 21.75%, distinta de la en riesgo', () => {
    const r = calcularCarteraEnRiesgo(cartera());
    expect(r.carteraEnMora.aNumero()).toBe(174000);
    expect(r.porcentajeEnMora.toFixed(2)).toBe('21.75');
    expect(r.montoEnRiesgo.aNumero()).toBe(56000);
  });

  it('los totales del P1 siguen intactos y el incobrable queda excluido', () => {
    const r = calcularCarteraEnRiesgo(cartera());
    expect(r.carteraActiva.aNumero()).toBe(800000);
    expect(r.totalIncobrables.aNumero()).toBe(15000);
  });
});