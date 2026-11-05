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
import { firmarAprobacion } from '../src/mcp/aprobacion';

let client: Client;
const SECRETO = 'secreto-de-prueba-mcp';

/** Firma un pago como lo haría la interfaz tras el clic humano. */
function aprobado(p: { id_credito: string; clave_idempotencia: string; monto_centavos: number; canal: string; fecha: string }) {
  return { ...p, token_aprobacion: firmarAprobacion(SECRETO, p) };
}

beforeAll(async () => {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  env['CV_APROBACION_SECRETO'] = SECRETO;
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'src/mcp/servidor.ts'],
    cwd: process.cwd(),
    env,
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

  it('publica esquemas JSON con propiedades y la fecha de corte obligatoria', async () => {
    const { tools } = await client.listTools();
    const cartera = tools.find((t) => t.name === 'consultar_cartera')!;
    expect(cartera.inputSchema.properties).toHaveProperty('corte');
    expect(cartera.inputSchema.required).toContain('corte');
    const pago = tools.find((t) => t.name === 'registrar_pago')!;
    expect(pago.annotations?.destructiveHint).toBe(true);
    expect(pago.inputSchema.required).toContain('token_aprobacion');
  });

  it('explicar_mora explica la cuota pedida con fecha futura (G-7: cuota 2 al 2027-01-24)', async () => {
    const result = await client.callTool({
      name: 'explicar_mora',
      arguments: { id_credito: 'CV-2026-0410', corte: '2027-01-24', numero_cuota: 2 },
    });
    const data = JSON.parse(textoDe(result));
    expect(data.cuota.numero).toBe(2);
    expect(data.politica).toBe('POL-2026-10');
    // 45 días = 30 en Mora 1 + 15 en Mora 2 (tramos recorridos)
    expect(data.cuota.diasAtraso).toBe(45);
    expect(data.lineas.map((l: { diasEnTramo: number }) => l.diasEnTramo)).toEqual([30, 15]);
  });

  it('explicar_mora de un crédito con política plana usa 24 % en todos los tramos (G-5)', async () => {
    const result = await client.callTool({
      name: 'explicar_mora',
      arguments: { id_credito: 'CV-2026-0030', corte: '2026-10-31', numero_cuota: 3 },
    });
    const data = JSON.parse(textoDe(result));
    expect(data.politica).toBe('POL-2024-01');
    for (const l of data.lineas) expect(l.tasaTna).toBe('0.24');
  });

  it('registrar_pago SIN aprobación humana se rechaza y no escribe (menor privilegio)', async () => {
    const result = await client.callTool({
      name: 'registrar_pago',
      arguments: {
        id_credito: 'CV-2026-0043',
        clave_idempotencia: 'TEST-SIN-APROBACION-1',
        monto_centavos: 100000,
        canal: 'campo',
        fecha: '2026-10-31',
        token_aprobacion: 'inventado-por-el-modelo',
      },
    });
    expect((result as { isError?: boolean }).isError).toBe(true);
    expect(textoDe(result)).toContain('APROBACION_REQUERIDA');
  });

  it('un token aprobado para un monto no sirve para otro monto', async () => {
    const firmado = aprobado({
      id_credito: 'CV-2026-0043',
      clave_idempotencia: 'TEST-TOKEN-AJENO-1',
      monto_centavos: 100,
      canal: 'campo',
      fecha: '2026-10-31',
    });
    const result = await client.callTool({
      name: 'registrar_pago',
      arguments: { ...firmado, monto_centavos: 999999 },
    });
    expect(textoDe(result)).toContain('APROBACION_REQUERIDA');
  });

  it('registrar_pago con clave repetida NO se aplica dos veces (P1 6.10)', async () => {
    const result = await client.callTool({
      name: 'registrar_pago',
      arguments: aprobado({
        id_credito: 'CV-2026-0043',
        clave_idempotencia: 'IDEM-000001', // ya existe en la bitácora
        monto_centavos: 251155,
        canal: 'campo',
        fecha: '2026-10-31',
      }),
    });
    const r = result as { isError?: boolean };
    expect(r.isError).toBe(true);
    expect(textoDe(result)).toContain('PAGO_DUPLICADO');
  });

  it('registrar_pago sobre crédito incobrable se rechaza (OP-6)', async () => {
    const result = await client.callTool({
      name: 'registrar_pago',
      arguments: aprobado({
        id_credito: 'CV-2026-0015',
        clave_idempotencia: 'TEST-INCOBRABLE-1',
        monto_centavos: 10000,
        canal: 'campo',
        fecha: '2026-10-31',
      }),
    });
    const r = result as { isError?: boolean };
    expect(r.isError).toBe(true);
    expect(textoDe(result)).toContain('CREDITO_INCOBRABLE');
  });

  it('registrar_pago con monto no exacto se rechaza e indica el correcto (OP-5)', async () => {
    const result = await client.callTool({
      name: 'registrar_pago',
      arguments: aprobado({
        id_credito: 'CV-2026-0061',
        clave_idempotencia: 'TEST-MONTO-NO-EXACTO-1',
        monto_centavos: 50000,
        canal: 'campo',
        fecha: '2026-10-31',
      }),
    });
    expect((result as { isError?: boolean }).isError).toBe(true);
    expect(textoDe(result)).toContain('MONTO_NO_EXACTO');
    expect(textoDe(result)).toMatch(/monto correcto es Q\d+\.\d{2}/);
  });
});
