/**
 * agenteClient.ts — E5 · Cliente HTTP del asistente gerencial.
 *
 * La interfaz no decide qué herramienta usar ni calcula cifras: envía el
 * mensaje al agente del backend (LLM + MCP + RAG) y muestra lo que devuelve.
 */

export interface TrazaHerramienta {
  nombre: string;
  argumentos: Record<string, unknown>;
  ok: boolean;
}

export interface FuenteCitada {
  doc_id: string;
  titulo: string;
  vigencia: string;
  seccion: string;
}

export interface Dinero {
  centavos: number;
  texto: string;
}

export interface DesglosePago {
  cuotaNumero?: number;
  gastos?: Dinero;
  interesMoratorio?: Dinero;
  interesCorriente?: Dinero;
  capital?: Dinero;
  total?: Dinero;
}

export interface PropuestaPago {
  id: string;
  id_credito: string;
  fecha: string;
  canal: string;
  clave_idempotencia: string;
  monto_centavos: number;
  desglose: DesglosePago;
  estado: 'pendiente' | 'ejecutada' | 'rechazada';
}

export interface RespuestaAgente {
  texto: string;
  herramientas: TrazaHerramienta[];
  fuentes: FuenteCitada[];
  propuesta?: PropuestaPago;
  alertaSeguridad?: string;
}

export interface ResultadoAprobacion {
  ok: boolean;
  resultado: unknown;
  estadoDespues?: unknown;
  traza: TrazaHerramienta[];
}

async function post<T>(ruta: string, cuerpo: unknown): Promise<T> {
  const r = await fetch(ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const texto = await r.text();
  let data: unknown;
  try {
    data = JSON.parse(texto);
  } catch {
    throw new Error('El servidor no respondió con JSON. ¿Está corriendo npm run api?');
  }
  if (!r.ok) {
    const e = data as { error?: { mensaje?: string } };
    throw new Error(e.error?.mensaje ?? `Error ${r.status}`);
  }
  return data as T;
}

export const agente = {
  conversar: (sesion: string, mensaje: string) => post<RespuestaAgente>('/api/chat', { sesion, mensaje }),
  aprobar: (sesion: string, propuesta: string) => post<ResultadoAprobacion>('/api/chat/aprobar', { sesion, propuesta }),
  rechazar: (sesion: string, propuesta: string) => post<{ ok: boolean }>('/api/chat/rechazar', { sesion, propuesta }),
  reiniciar: (sesion: string) => post<{ ok: boolean }>('/api/chat/reiniciar', { sesion }),
};
