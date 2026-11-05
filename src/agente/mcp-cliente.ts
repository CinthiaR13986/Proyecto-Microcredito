/**
 * mcp-cliente.ts — E3/E5 · El agente consume el núcleo SOLO a través del
 * servidor MCP (protocolo real, transporte stdio).
 *
 * El proceso del servidor MCP se lanza con un secreto de aprobación aleatorio
 * generado al arrancar la API. Ese secreto vive en este proceso y en el del
 * servidor MCP; nunca se envía al LLM ni al navegador.
 */
import '../config';
import { randomBytes } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { firmarAprobacion, type PagoFirmable } from '../mcp/aprobacion';

export interface HerramientaMcp {
  name: string;
  description?: string | undefined;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean | undefined; destructiveHint?: boolean | undefined } | undefined;
}

export interface ResultadoMcp {
  ok: boolean;
  datos: unknown;
}

const SECRETO = randomBytes(32).toString('hex');

let conexion: Promise<Client> | null = null;

async function conectar(): Promise<Client> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  env['CV_APROBACION_SECRETO'] = SECRETO;

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'src/mcp/servidor.ts'],
    cwd: process.cwd(),
    env,
    stderr: 'inherit',
  });
  const client = new Client({ name: 'asistente-gerencial', version: '1.0.0' });
  transport.onclose = () => {
    conexion = null; // si el proceso muere, se reconecta en la próxima llamada
  };
  await client.connect(transport);
  return client;
}

export function clienteMcp(): Promise<Client> {
  conexion ??= conectar().catch((e) => {
    conexion = null;
    throw e;
  });
  return conexion;
}

export async function listarHerramientasMcp(): Promise<HerramientaMcp[]> {
  const { tools } = await (await clienteMcp()).listTools();
  return tools as HerramientaMcp[];
}

export async function llamarMcp(nombre: string, argumentos: Record<string, unknown>): Promise<ResultadoMcp> {
  const r = (await (await clienteMcp()).callTool({ name: nombre, arguments: argumentos })) as {
    content?: { type: string; text?: string }[];
    isError?: boolean;
  };
  const texto = (r.content ?? []).map((c) => c.text ?? '').join('');
  let datos: unknown = texto;
  try {
    datos = JSON.parse(texto);
  } catch {
    /* texto plano */
  }
  return { ok: !r.isError, datos };
}

/**
 * Ejecuta registrar_pago con el token de aprobación humana. Solo la llama
 * la ruta /api/chat/aprobar, que se dispara con el clic de una persona.
 */
export async function registrarPagoAprobado(
  pago: PagoFirmable & { canal: 'campo' | 'agencia' | 'transferencia' },
): Promise<ResultadoMcp> {
  return llamarMcp('registrar_pago', { ...pago, token_aprobacion: firmarAprobacion(SECRETO, pago) });
}
