import { describe, it, expect } from 'vitest';
import { Credito } from '../src/dominio/estado-credito';

const F = '2026-08-19'; // fecha de corte INYECTADA (puerto Reloj), no la del sistema
const U = 'prueba';

const creditVigente = (id: string) =>
  Credito.solicitar(id, F, U)
    .aplicar({ tipo: 'APROBAR' }, F, U)
    .aplicar({ tipo: 'DESEMBOLSAR' }, F, U);

describe('Ciclo de vida del crédito (sección 6.7)', () => {
  it('avance normal: solicitado → aprobado → vigente', () => {
    expect(creditVigente('CR-1').estadoActual).toBe('vigente');
  });

  it('REVERSIBILIDAD obligatoria: Mora 2 → Mora 1 → vigente', () => {
    let c = creditVigente('CR-2').aplicar({ tipo: 'ATRASO', dias: 45 }, F, U);
    expect(c.estadoActual).toBe('en_mora');
    expect(c.tramo).toBe('MORA_2');

    c = c.aplicar({ tipo: 'PAGO', nuevosDiasAtraso: 10 }, F, U);
    expect(c.estadoActual).toBe('en_mora');
    expect(c.tramo).toBe('MORA_1'); // bajó de tramo al pagar

    c = c.aplicar({ tipo: 'PAGO', nuevosDiasAtraso: 0 }, F, U);
    expect(c.estadoActual).toBe('vigente'); // regularizó
    expect(c.tramo).toBe('AL_DIA');
  });

  it('un crédito VENCIDO también regulariza al pagar todo lo vencido', () => {
    const c = creditVigente('CR-3').aplicar({ tipo: 'ATRASO', dias: 100 }, F, U);
    expect(c.tramo).toBe('VENCIDO');
    const regularizado = c.aplicar({ tipo: 'PAGO', nuevosDiasAtraso: 0 }, F, U);
    expect(regularizado.estadoActual).toBe('vigente');
  });

  it('transición inválida imposible por diseño: pagar un crédito solicitado', () => {
    const c = Credito.solicitar('CR-4', F, U);
    expect(c.puedeRecibirPago()).toBe(false);
    expect(() => c.aplicar({ tipo: 'PAGO', nuevosDiasAtraso: 0 }, F, U)).toThrow(
      /Transición inválida/,
    );
  });

  it('estados terminales no aceptan eventos: cancelado no entra en mora', () => {
    const c = creditVigente('CR-5').aplicar({ tipo: 'PAGO_ULTIMA_CUOTA' }, F, U);
    expect(c.estadoActual).toBe('cancelado');
    expect(() => c.aplicar({ tipo: 'ATRASO', dias: 5 }, F, U)).toThrow();
  });

  it('reestructurado → vigente queda marcado para cartera en riesgo (6.8)', () => {
    const c = creditVigente('CR-6')
      .aplicar({ tipo: 'ATRASO', dias: 60 }, F, U)
      .aplicar({ tipo: 'REESTRUCTURAR' }, F, U)
      .aplicar({ tipo: 'CUMPLE_PLAN' }, F, U);
    expect(c.estadoActual).toBe('vigente');
    expect(c.esReestructurado).toBe(true); // la marca no se borra
  });

  it('incobrable exige >120 días y el crédito NO regresa a cartera', () => {
    const base = creditVigente('CR-7').aplicar({ tipo: 'ATRASO', dias: 100 }, F, U);
    expect(() => base.aplicar({ tipo: 'DECLARAR_INCOBRABLE', dias: 100 }, F, U)).toThrow();

    const inc = base
      .aplicar({ tipo: 'ATRASO', dias: 130 }, F, U)
      .aplicar({ tipo: 'DECLARAR_INCOBRABLE', dias: 130 }, F, U);
    expect(inc.estadoActual).toBe('incobrable');
    expect(() => inc.aplicar({ tipo: 'PAGO', nuevosDiasAtraso: 0 }, F, U)).toThrow();
  });

  it('el historial nunca se borra: fecha, usuario y motivo en cada cambio', () => {
    const c = creditVigente('CR-8')
      .aplicar({ tipo: 'ATRASO', dias: 45 }, F, U)
      .aplicar({ tipo: 'PAGO', nuevosDiasAtraso: 0 }, F, U);
    expect(c.historialEstados).toHaveLength(5);
    expect(
      c.historialEstados.every((r) => r.fecha === F && r.usuario === U && r.motivo.length > 0),
    ).toBe(true);
    expect(c.historialEstados[0]!.estado).toBe('solicitado');
    expect(c.historialEstados[4]!.estado).toBe('vigente');
  });
});