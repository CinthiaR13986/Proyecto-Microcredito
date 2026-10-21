/**
 * mcp.test.ts — E6 · Pruebas del servidor MCP.
 *
 * El StdioClientTransport del SDK lanza y apaga el proceso del servidor
 * por nosotros (cross-spawn resuelve npx.cmd en Windows). Solo conectamos
 * un cliente y verificamos que las herramientas devuelven lo mismo que el
 * núcleo y rechazan lo que deben rechazar.
 *
 * Requiere: npm run cargar ejecutado antes (la base .pgdata debe existir).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

let client: Client;

beforeAll(async () => {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'src/mcp/servidor.ts'],
    cwd: process.cwd(),
    stderr: 'ignore',
  });
  client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(transport);
}, 60000);

afterAll(async () => {
  await client.close();
});

function textoDe(result: unknown): string {
  const r = result as { content: Array<{ type: string; text?: string }> };
  return r.content.map((c) => c.text ?? '').join('');
}

describe('E3/E6 · servidor MCP sobre los puertos del P1', () => {
  it('expone las 8 herramientas de la sección 6.3', async () => {
    const { tools } = await client.listTools();
    const nombres = tools.map((t) => t.name).sort();
    expect(nombres).toEqual(
      [
        'calcular_deuda',
        'consultar_cartera',
        'consultar_cierre',
        'consultar_credito',
        'explicar_mora',
        'listar_morosos',
        'registrar_pago',
        'ver_vencimientos',
      ].sort(),
    );
  });

  it('consultar_credito devuelve el mismo estado que el núcleo (CV-2026-0043)', async () => {
    const result = await client.callTool({
      name: 'consultar_credito',
      arguments: { id_credito: 'CV-2026-0043', corte: '2026-10-31' },
    });
    const data = JSON.parse(textoDe(result));
    expect(data.id).toBe('CV-2026-0043');
    expect(data.estado).toBe('en_mora');
    expect(data.diasAtraso).toBe(55);
    expect(data.tramo).toBe('MORA_2');
  });

  it('registrar_pago con clave repetida NO se aplica dos veces (P1 6.10)', async () => {
    const result = await client.callTool({
      name: 'registrar_pago',
      arguments: {
        id_credito: 'CV-2026-0043',
        clave_idempotencia: 'IDEM-000001', // ya existe en la bitácora
        monto_centavos: 251155,
        canal: 'campo',
        fecha: '2026-10-31',
      },
    });
    const r = result as { isError?: boolean };
    expect(r.isError).toBe(true);
    expect(textoDe(result)).toContain('PAGO_DUPLICADO');
  });

  it('registrar_pago sobre crédito incobrable se rechaza (OP-6)', async () => {
    const result = await client.callTool({
      name: 'registrar_pago',
      arguments: {
        id_credito: 'CV-2026-0015',
        clave_idempotencia: 'TEST-INCOBRABLE-1',
        monto_centavos: 10000,
        canal: 'campo',
        fecha: '2026-10-31',
      },
    });
    const r = result as { isError?: boolean };
    expect(r.isError).toBe(true);
    expect(textoDe(result)).toContain('CREDITO_INCOBRABLE');
  });
});