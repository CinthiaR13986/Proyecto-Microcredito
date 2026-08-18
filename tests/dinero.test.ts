import { describe, it, expect } from 'vitest';
import { Dinero, Moneda } from '../src/dominio/dinero';

describe('Objeto de Valor Dinero (sección 6.2)', () => {
  it('evita el error de punto flotante: 0.1 + 0.2 = 0.3 exacto', () => {
    const a = Dinero.de(0.1);
    const b = Dinero.de(0.2);
    expect(a.sumar(b).aNumero()).toBe(0.3);
  });

  it('es inmutable: sumar devuelve uno nuevo y no toca los originales', () => {
    const a = Dinero.de(100);
    const b = Dinero.de(50);
    const c = a.sumar(b);
    expect(c.aNumero()).toBe(150);
    expect(a.aNumero()).toBe(100);
    expect(b.aNumero()).toBe(50);
    expect(c).not.toBe(a);
  });

  it('prohíbe mezclar monedas distintas', () => {
    const q = Dinero.de(10, Moneda.Quetzal);
    const usd = Dinero.de(10, Moneda.Dolar);
    expect(() => q.sumar(usd)).toThrow(/monedas distintas/i);
  });

  it('redondea medio hacia arriba a 2 decimales', () => {
    expect(Dinero.de(1.005).redondeado().aNumero()).toBe(1.01);
    expect(Dinero.de(2.675).redondeado().aNumero()).toBe(2.68);
    expect(Dinero.de(1.004).redondeado().aNumero()).toBe(1);
  });

  it('resta y compara correctamente', () => {
    const total = Dinero.de(1000);
    const capital = Dinero.de(725.76);
    const resto = total.restar(capital);
    expect(resto.aNumero()).toBe(274.24);
    expect(resto.esMenorQue(total)).toBe(true);
    expect(Dinero.cero().esCero()).toBe(true);
  });

  it('multiplica por factor decimal (interés de una cuota)', () => {
    const saldo = Dinero.de(9295.38);
    const interes = saldo.multiplicarPor(0.03).redondeado();
    expect(interes.aNumero()).toBe(278.86);
  });

  it('formatea como quetzales', () => {
    expect(Dinero.de(1004.62).toString()).toBe('Q1004.62');
  });
});