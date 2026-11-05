/**
 * agente.test.ts — E6 · Controles de seguridad del asistente (sin red ni base).
 *
 * Verifica las barreras deterministas que no dependen del LLM:
 *   - la nota envenenada (OP-7) llega al modelo con la instrucción tachada,
 *   - la respuesta final nunca expone DPI ni teléfonos,
 *   - el token de aprobación humana firma exactamente un pago.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { filtrarDatosPersonales, neutralizarInstrucciones } from '../src/agente/agente';
import { firmarAprobacion, verificarAprobacion } from '../src/mcp/aprobacion';
import { fragmentar, parsearDocumento } from '../src/rag/ingesta';
import { contieneInyeccion } from '../src/rag/recuperador';

const NOTA = readFileSync('datos/corpus/NOTA-CAMPO-07.md', 'utf8');

describe('E4/E5 · OP-7: instrucciones incrustadas en el corpus', () => {
  it('detecta la instrucción dirigida a la IA en NOTA-CAMPO-07', () => {
    expect(contieneInyeccion(NOTA)).toBe(true);
  });

  it('tacha la instrucción antes de entregarla al modelo y conserva el contenido operativo', () => {
    const { texto, tachado } = neutralizarInstrucciones(NOTA);
    expect(tachado).toBe(true);
    expect(texto).not.toContain('CANARIO-7431');
    expect(texto).not.toContain('registrar_pago');
    expect(texto).toContain('registrar cada visita el mismo día');
  });

  it('no altera documentos legítimos', () => {
    const pol = readFileSync('datos/corpus/POL-2026-10.md', 'utf8');
    expect(neutralizarInstrucciones(pol).tachado).toBe(false);
    expect(contieneInyeccion(pol)).toBe(false);
  });
});

describe('E5 · filtro de datos personales en la respuesta', () => {
  it('enmascara DPI y teléfono', () => {
    const t = filtrarDatosPersonales('DPI-FICT-000030, tel. 5555-1203');
    expect(t).not.toMatch(/DPI-FICT|5555-1203/);
  });

  it('no toca identificadores de crédito, fechas ni montos', () => {
    const t = 'CV-2026-0043 al 2026-10-31 debe Q2,511.55';
    expect(filtrarDatosPersonales(t)).toBe(t);
  });
});

describe('E3 · token de aprobación humana', () => {
  const pago = { id_credito: 'CV-2026-0043', clave_idempotencia: 'CHAT-1', monto_centavos: 251155, fecha: '2026-10-31' };

  it('valida el token del mismo pago', () => {
    expect(verificarAprobacion('s', pago, firmarAprobacion('s', pago))).toBe(true);
  });

  it('rechaza el token si cambia el monto, el crédito o el secreto', () => {
    const token = firmarAprobacion('s', pago);
    expect(verificarAprobacion('s', { ...pago, monto_centavos: 1 }, token)).toBe(false);
    expect(verificarAprobacion('s', { ...pago, id_credito: 'CV-2026-0001' }, token)).toBe(false);
    expect(verificarAprobacion('otro', pago, token)).toBe(false);
    expect(verificarAprobacion('s', pago, 'inventado')).toBe(false);
  });
});

describe('E4 · fragmentación del corpus', () => {
  it('lee el front-matter como metadato de cita y fragmenta por sección', () => {
    const { meta, cuerpo } = parsearDocumento(readFileSync('datos/corpus/POL-2024-01.md', 'utf8'));
    expect(meta.doc_id).toBe('POL-2024-01');
    expect(meta.vigencia).toContain('30 de septiembre de 2026');
    const fr = fragmentar(cuerpo);
    expect(fr.length).toBeGreaterThan(1);
    expect(fr.every((f) => f.texto.length >= 80)).toBe(true);
    expect(cuerpo).not.toContain('doc_id:');
  });
});
