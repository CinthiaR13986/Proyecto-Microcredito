/** Cliente HTTP de la API. Ninguna cifra se calcula aquí: todo viene del núcleo. */

export interface DineroDTO {
  centavos: number;
  texto: string;
}

export const q = (d: DineroDTO | null | undefined): string => (d ? `Q${d.texto}` : '—');

export class ErrorApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensaje: string,
    readonly detalles?: unknown,
  ) {
    super(mensaje);
  }
}

async function pedir<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  const r = await fetch(ruta, opciones);
  const cuerpo = (await r.json().catch(() => null)) as any;
  if (!r.ok) {
    const e = cuerpo?.error ?? { codigo: 'ERROR', mensaje: r.statusText };
    throw new ErrorApi(r.status, e.codigo, e.mensaje, e.detalles);
  }
  return cuerpo as T;
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export interface LineaMoraDTO {
  tramo: string;
  tasaTna: string;
  diasEnTramo: number;
  montoSinRedondear: string;
}

export interface DeudaDTO {
  cuotaNumero: number;
  gastos: DineroDTO;
  interesMoratorio: DineroDTO;
  interesCorriente: DineroDTO;
  capital: DineroDTO;
  total: DineroDTO;
}

export interface DetalleDTO {
  id: string;
  cliente: { id: string; nombre: string };
  politica: string;
  reestructurado: boolean;
  estado: 'vigente' | 'en_mora' | 'cancelado' | 'incobrable';
  diasAtraso: number;
  tramo: string;
  saldoCapital: DineroDTO;
  proximaCuota: { numero: number; vencimiento: string; monto: DineroDTO } | null;
  deuda: DeudaDTO | null;
  lineasMora: LineaMoraDTO[];
  interesEnSuspenso: DineroDTO;
  cuotas: Array<{
    numero: number;
    vencimiento: string;
    monto: DineroDTO;
    interes: DineroDTO;
    amortizacion: DineroDTO;
    pagada: boolean;
    capitalRestante: DineroDTO;
    diasAtrasoAlCorte: number;
  }>;
}

export interface MoraDTO {
  id: string;
  corte: string;
  diasAtraso: number;
  tramo: string;
  politica: string;
  lineas: LineaMoraDTO[];
  moratorioTotal: DineroDTO;
}

export interface CarteraDTO {
  corte: string;
  creditosActivos: number;
  carteraActiva: DineroDTO;
  carteraEnMora: DineroDTO;
  porcentajeEnMora: number;
  carteraEnRiesgo: DineroDTO;
  porcentajeRiesgo: number;
  desglose: Array<{
    tramo: string;
    creditos: number;
    saldoCapital: DineroDTO;
    porcentaje: number;
  }>;
  incobrablesDelMes: DineroDTO;
  creditosIncobrablesDelMes: number;
}

export interface CierreDTO {
  desde: string;
  hasta: string;
  desembolsos: DineroDTO;
  numeroDesembolsos: number;
  recuperaciones: {
    gastos: DineroDTO;
    interesMoratorio: DineroDTO;
    interesCorriente: DineroDTO;
    capital: DineroDTO;
    total: DineroDTO;
  };
  numeroPagos: number;
}

export interface SimulacionDTO {
  cuotas: Array<{
    numero: number;
    cuota: DineroDTO;
    interes: DineroDTO;
    amortizacion: DineroDTO;
    saldoFinal: DineroDTO;
  }>;
  totalPagado: DineroDTO;
  totalInteres: DineroDTO;
}

export const api = {
  credito: (id: string, corte: string) => pedir<DetalleDTO>(`/api/creditos/${id}?corte=${corte}`),
  mora: (id: string, corte: string) => pedir<MoraDTO>(`/api/creditos/${id}/mora?corte=${corte}`),
  pagar: (body: unknown) => pedir<any>('/api/pagos', json(body)),
  simulacion: (p: { capital_centavos: number; plazo_meses: number; tna_bps: number }) =>
    pedir<SimulacionDTO>(`/api/simulacion?capital_centavos=${p.capital_centavos}&plazo_meses=${p.plazo_meses}&tna_bps=${p.tna_bps}`),
  altaCliente: (body: unknown) => pedir<any>('/api/clientes', json(body)),
  desembolsar: (body: unknown) => pedir<any>('/api/creditos', json(body)),
  cartera: (corte: string) => pedir<CarteraDTO>(`/api/cartera?corte=${corte}`),
  cierreDiario: (fecha: string) => pedir<CierreDTO>(`/api/cierres/diario?fecha=${fecha}`),
  cierreMensual: (mes: string) => pedir<CierreDTO>(`/api/cierres/mensual?mes=${mes}`),
  morosos: (corte: string, tramo?: string) =>
    pedir<any>(`/api/morosos?corte=${corte}${tramo ? `&tramo=${tramo}` : ''}`),
  vencimientos: (corte: string, dias: number) =>
    pedir<any>(`/api/vencimientos?corte=${corte}&dias=${dias}`),
};