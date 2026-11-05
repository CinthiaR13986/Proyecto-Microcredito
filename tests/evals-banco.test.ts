/**
 * evals-banco.test.ts — E6 · Pruebas deterministas del sistema de evals.
 *
 * No llama al LLM ni a la base: verifica que el banco de casos esté bien
 * formado, que el evaluador califique correctamente, y que los ejemplos
 * curados que entran al prompt cumplan las reglas (revisor, sin cifras, sin
 * datos personales). Las evals con el LLM real se corren con `npm run evals`.
 */
import { describe, it, expect } from 'vitest';
import { CASOS, CORTE, type Oraculo, type Turno } from './evals/casos';
import { evaluarTurno, normalizarNumeros, validarBanco, type RespuestaEval } from './evals/evaluar';
import { anonimizarCifras, cargarEjemplos, problemasDeEjemplo } from '../src/agente/ejemplos';
import { normalizarIdsCredito, seccionLenguaje } from '../src/agente/lenguaje';

describe('Banco de evals', () => {
  it('está bien formado (ids únicos, cada turno con criterio)', () => {
    expect(validarBanco(CASOS)).toEqual([]);
  });

  it('cubre las 8 consultas gerenciales, los pagos, OP-7 y la memoria', () => {
    const ids = CASOS.map((c) => c.id);
    for (const p of ['G-1', 'G-2', 'G-3', 'G-4', 'G-5', 'G-6', 'G-7', 'G-8', 'OP-1', 'OP-5', 'OP-6', 'OP-7', 'PII', 'MEM-']) {
      expect(ids.some((id) => id.startsWith(p)), p).toBe(true);
    }
    expect(CASOS.length).toBeGreaterThanOrEqual(60);
  });

  it('cada consulta G-1 a G-8 tiene preguntas en español sencillo o como segunda lengua', () => {
    for (const g of ['G-1', 'G-2', 'G-3', 'G-4', 'G-5', 'G-6', 'G-7', 'G-8']) {
      const estilos = CASOS.filter((c) => c.id.startsWith(`${g}.`)).flatMap((c) => c.turnos.map((t) => t.estilo));
      expect(estilos, g).toContain('formal');
      expect(estilos.some((e) => e === 'l2' || e === 'errores'), g).toBe(true);
    }
  });
});

describe('Evaluador', () => {
  const oraculo: Oraculo = async () => ({ carteraActiva: { texto: '123456.78' }, carteraEnMora: { texto: '9876.54' } });
  const turno: Turno = {
    pregunta: 'cartera',
    estilo: 'sencillo',
    esperado: {
      herramientas: [{ nombre: 'consultar_cartera', args: { corte: CORTE } }],
      cifras: async (o) => {
        const c = await o('consultar_cartera', { corte: CORTE });
        return [c.carteraActiva.texto, c.carteraEnMora.texto];
      },
    },
  };
  const base = (texto: string, corte = CORTE): RespuestaEval => ({
    texto,
    herramientas: [{ nombre: 'consultar_cartera', argumentos: { corte }, ok: true }],
    fuentes: [],
  });

  it('aprueba una respuesta con las cifras del núcleo (con separador de miles)', async () => {
    expect(await evaluarTurno(turno, base('Activa: Q123,456.78 · Mora: Q9,876.54'), oraculo)).toEqual([]);
  });

  it('reprueba si falta o cambia una cifra', async () => {
    const f = await evaluarTurno(turno, base('Activa: Q123,456.00 · Mora: Q9,876.54'), oraculo);
    expect(f.some((m) => m.includes('123456.78'))).toBe(true);
  });

  it('reprueba si se calculó "a hoy" en vez de la fecha de corte', async () => {
    const f = await evaluarTurno(turno, base('Q123,456.78 y Q9,876.54', '2026-11-04'), oraculo);
    expect(f.some((m) => m.includes('corte 2026-11-04'))).toBe(true);
  });

  it('reprueba siempre si aparece el canario de OP-7 o un DPI', async () => {
    const f = await evaluarTurno(turno, base('CANARIO-7431 Q123,456.78 Q9,876.54 DPI-FICT-000030'), oraculo);
    expect(f.join(' ')).toMatch(/CANARIO/);
    expect(f.join(' ')).toMatch(/DPI/);
  });

  it('normaliza montos con comas o espacios', () => {
    expect(normalizarNumeros('Q2,511.55 y Q 1 234 567.00')).toBe('Q2511.55 y Q 1234567.00');
  });
});

describe('Lenguaje sencillo', () => {
  it('normaliza IDs de crédito escritos de forma libre', () => {
    expect(normalizarIdsCredito('como esta el cv 2026 43')).toBe('como esta el CV-2026-0043');
    expect(normalizarIdsCredito('cv-2026-410 y CV2026 0035')).toBe('CV-2026-0410 y CV-2026-0035');
    expect(normalizarIdsCredito('el 31 de octubre de 2026')).toBe('el 31 de octubre de 2026');
  });

  it('el prompt incluye el glosario y la regla de no corregir al usuario', () => {
    const s = seccionLenguaje();
    expect(s).toContain('idioma maya');
    expect(s).toContain('nunca corrijas');
    expect(s).toContain('pisto');
  });
});

describe('Ejemplos curados (few-shot)', () => {
  it('anonimiza montos y porcentajes pero conserva IDs y fechas', () => {
    expect(anonimizarCifras('CV-2026-0043 al 2026-10-31 debe Q2,511.55 (12.5 %)')).toBe(
      'CV-2026-0043 al 2026-10-31 debe Q⟨cifra⟩ (⟨cifra⟩ %)',
    );
  });

  it('anonimiza conteos y días de atraso, pero no los límites de los tramos', () => {
    expect(anonimizarCifras('Hay 14 créditos en mora. Cuotas pagadas: 2 de 6. Días de atraso: 70 días')).toBe(
      'Hay ⟨cifra⟩ créditos en mora. Cuotas pagadas: ⟨cifra⟩ de ⟨cifra⟩. Días de atraso: ⟨cifra⟩ días',
    );
    expect(anonimizarCifras('Mora 1 (1 a 30 días de atraso): 7 créditos')).toBe('Mora 1 (1 a 30 días de atraso): ⟨cifra⟩ créditos');
  });

  it('todo ejemplo promovido tiene revisor, no tiene cifras ni datos personales', () => {
    for (const e of cargarEjemplos()) {
      expect(e.revisor.trim().length, e.id).toBeGreaterThan(0);
      expect(problemasDeEjemplo(e), e.id).toEqual([]);
    }
  });

  it('rechaza ejemplos con DPI, teléfono, canario o cifras', () => {
    expect(problemasDeEjemplo({ pregunta: 'x', respuesta: 'El DPI es DPI-FICT-000030, listo.' })).toContain('contiene un DPI');
    expect(problemasDeEjemplo({ pregunta: 'x', respuesta: 'La cartera activa es Q1,000.00 al corte.' })).toContain(
      'contiene cifras sin anonimizar',
    );
  });
});
