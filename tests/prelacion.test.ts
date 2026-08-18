import { describe, it, expect } from 'vitest';
import { Dinero } from '../src/dominio/dinero';
import { aplicarPago, totalRubros, type Rubros } from '../src/dominio/prelacion-pago';

/** Deuda vencida del caso de referencia (6.6.1): cuota 2 con 15 días de atraso. */
const deudaReferencia = (): Rubros => ({
  gastos: Dinero.cero(),
  interesMoratorio: Dinero.de(7.26),
  interesCorriente: Dinero.de(278.86),
  capital: Dinero.de(725.76),
});

describe('Prelación de pagos (sección 6.6)', () => {
  it('Escenario A — pago exacto Q1,011.88 salda la cuota', () => {
    const r = aplicarPago(Dinero.de(1011.88), deudaReferencia());
    expect(r.aplicados.gastos.aNumero()).toBe(0);
    expect(r.aplicados.interesMoratorio.aNumero()).toBe(7.26);
    expect(r.aplicados.interesCorriente.aNumero()).toBe(278.86);
    expect(r.aplicados.capital.aNumero()).toBe(725.76);
    expect(r.excedente.aNumero()).toBe(0);
    expect(r.capitalPendiente.aNumero()).toBe(0);
    expect(r.cuotaSaldada).toBe(true);
  });

  it('Escenario B — pago parcial Q500: abono a capital 213.88, NO salda', () => {
    const r = aplicarPago(Dinero.de(500), deudaReferencia());
    expect(r.aplicados.interesMoratorio.aNumero()).toBe(7.26);
    expect(r.aplicados.interesCorriente.aNumero()).toBe(278.86);
    expect(r.aplicados.capital.aNumero()).toBe(213.88);
    expect(r.capitalPendiente.aNumero()).toBe(511.88);
    expect(r.cuotaSaldada).toBe(false);
    expect(r.excedente.aNumero()).toBe(0);
  });

  it('Escenario C — pago de más Q3,000: excedente 1,988.12 a capital', () => {
    const r = aplicarPago(Dinero.de(3000), deudaReferencia());
    expect(r.cuotaSaldada).toBe(true);
    expect(r.excedente.aNumero()).toBe(1988.12);
    expect(r.destinoExcedente).toBe('A_CAPITAL');
  });

  it('El orden importa: gastos y moratorio se consumen antes que corriente', () => {
    const deuda: Rubros = {
      gastos: Dinero.de(50),
      interesMoratorio: Dinero.de(7.26),
      interesCorriente: Dinero.de(278.86),
      capital: Dinero.de(725.76),
    };
    const r = aplicarPago(Dinero.de(60), deuda);
    expect(r.aplicados.gastos.aNumero()).toBe(50);
    expect(r.aplicados.interesMoratorio.aNumero()).toBe(7.26);
    expect(r.aplicados.interesCorriente.aNumero()).toBe(2.74);
    expect(r.aplicados.capital.aNumero()).toBe(0);
  });

  it('Invariante de conservación: aplicados + excedente = pago recibido', () => {
    for (const monto of [500, 1011.88, 3000]) {
      const pago = Dinero.de(monto);
      const r = aplicarPago(pago, deudaReferencia());
      expect(totalRubros(r.aplicados).sumar(r.excedente).aNumero()).toBe(pago.aNumero());
    }
  });

  it('Rechaza pagos negativos', () => {
    expect(() => aplicarPago(Dinero.de(-100), deudaReferencia())).toThrow();
  });
});