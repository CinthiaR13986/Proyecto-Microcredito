import { describe, it, expect } from 'vitest';
import { Dinero } from '../src/dominio/dinero';
import { Credito } from '../src/dominio/estado-credito';
import { devengarInteresCorriente, reconocerSuspenso } from '../src/dominio/devengo';

const F = '2026-09-12'; // fecha inyectada (puerto Reloj)
const U = 'prueba-p2';

const creditoEnMora = (dias: number) =>
  Credito.solicitar('CR-P2', F, U)
    .aplicar({ tipo: 'APROBAR' }, F, U)
    .aplicar({ tipo: 'DESEMBOLSAR' }, F, U)
    .aplicar({ tipo: 'ATRASO', dias }, F, U);

describe('CP-04.1 · transición en_mora → cancelado', () => {
  it('un crédito en mora que liquida todo su saldo pasa a cancelado', () => {
    const c = creditoEnMora(45).aplicar({ tipo: 'PAGO_ULTIMA_CUOTA' }, F, U);
    expect(c.estadoActual).toBe('cancelado');
  });

  it('sigue siendo imposible pagar un crédito solicitado (P1 intacto)', () => {
    const c = Credito.solicitar('CR-X', F, U);
    expect(() => c.aplicar({ tipo: 'PAGO', nuevosDiasAtraso: 0 }, F, U)).toThrow(
      /Transición inválida/,
    );
  });

  it('el historial registra el motivo de la cancelación (trazabilidad)', () => {
    const c = creditoEnMora(45).aplicar({ tipo: 'PAGO_ULTIMA_CUOTA' }, F, U);
    expect(c.historialEstados[c.historialEstados.length - 1]!.motivo).toBe(
      'PAGO_ULTIMA_CUOTA',
    );
  });
});

describe('CP-04.2 · suspensión de devengo cuantificada', () => {
  const saldo = Dinero.de(9295.38);

  it('entre el corte al día 90 y al día 100 el ingreso corriente NO aumenta', () => {
    const d90 = devengarInteresCorriente(saldo, 0.03, 90);
    const d100 = devengarInteresCorriente(saldo, 0.03, 100);
    expect(d100.reconocido.aNumero()).toBe(d90.reconocido.aNumero());
  });

  it('el interés en suspenso SÍ aumenta después del día 90', () => {
    const d90 = devengarInteresCorriente(saldo, 0.03, 90);
    const d100 = devengarInteresCorriente(saldo, 0.03, 100);
    expect(d90.enSuspenso.esCero()).toBe(true);
    expect(d100.enSuspenso.aNumero()).toBeGreaterThan(0);
  });

  it('al regularizar, lo acumulado en suspenso se reconoce en el período', () => {
    const d100 = devengarInteresCorriente(saldo, 0.03, 100);
    const r = reconocerSuspenso(d100.enSuspenso);
    expect(r.ingresoDelPeriodo.aNumero()).toBe(d100.enSuspenso.aNumero());
  });
});