import { describe, it, expect } from 'vitest';
import { Dinero } from '../src/dominio/dinero';
import {
  calcularCarteraEnRiesgo,
  estaEnRiesgo,
  type CreditoCartera,
} from '../src/dominio/cartera';

const cred = (
  id: string,
  saldo: number,
  dias: number,
  reestructurado = false,
  incobrable = false,
): CreditoCartera => ({
  id,
  saldoCapital: Dinero.de(saldo),
  diasDeAtraso: dias,
  reestructurado,
  incobrable,
});

/** Cartera del caso de referencia obligatorio (6.8.1). */
const carteraReferencia = (): CreditoCartera[] => [
  cred('C-001', 620000, 0),
  cred('C-002', 124000, 8),
  cred('C-003', 24000, 45),
  cred('C-004', 18000, 75),
  cred('C-005', 8000, 100),
  cred('C-006', 6000, 0, true),
  cred('C-007', 15000, 210, false, true),
];

describe('Cartera en riesgo (sección 6.8.1)', () => {
  it('reproduce el caso obligatorio: 7.00 %', () => {
    const r = calcularCarteraEnRiesgo(carteraReferencia());
    expect(r.carteraActiva.aNumero()).toBe(800000);
    expect(r.montoEnRiesgo.aNumero()).toBe(56000);
    expect(r.porcentaje).toBe(7);
  });

  it('C-002 (8 días) NO entra; C-006 reestructurado al día SÍ entra', () => {
    const cartera = carteraReferencia();
    expect(estaEnRiesgo(cartera[1]!)).toBe(false);
    expect(estaEnRiesgo(cartera[5]!)).toBe(true);
  });

  it('frontera exacta: 30 días NO entra, 31 días SÍ entra', () => {
    expect(estaEnRiesgo(cred('X', 1000, 30))).toBe(false);
    expect(estaEnRiesgo(cred('X', 1000, 31))).toBe(true);
  });

  it('el incobrable sale de la base: C-007 no cuenta en nada', () => {
    const r = calcularCarteraEnRiesgo(carteraReferencia());
    expect(r.totalIncobrables.aNumero()).toBe(15000);
    expect(r.carteraActiva.aNumero()).toBe(800000); // 815,000 − 15,000
  });

  it('la trampa del 6.06 %: incobrable "mejora" el indicador sin cobrar', () => {
    const conC005Incobrable = carteraReferencia().map((c) =>
      c.id === 'C-005' ? { ...c, incobrable: true } : c,
    );
    const r = calcularCarteraEnRiesgo(conC005Incobrable);
    expect(r.montoEnRiesgo.aNumero()).toBe(48000);
    expect(r.carteraActiva.aNumero()).toBe(792000);
    expect(r.porcentaje).toBe(6.06);
    // Por eso el cierre reporta ambos números juntos:
    expect(r.totalIncobrables.aNumero()).toBe(23000); // 15,000 + 8,000
  });

  it('invariante 6.10: cartera vacía da 0 % sin dividir por cero', () => {
    const r = calcularCarteraEnRiesgo([]);
    expect(r.porcentaje).toBe(0);
    expect(r.carteraActiva.esCero()).toBe(true);
  });
});