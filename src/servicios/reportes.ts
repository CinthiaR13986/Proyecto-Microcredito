/**
 * reportes.ts — E1 · Reportes de gerencia sobre la cartera reconstruida.
 *
 * Funciones puras sobre filas + fecha de corte: la fecha SIEMPRE es
 * parámetro (puerto Reloj); nunca se lee el reloj del sistema (regla 7.3 PF).
 * Ninguna cifra se recalcula aquí: todo sale de reconstruirCredito(),
 * que a su vez usa el núcleo del P1/P2.
 */
import { addDays, format, parseISO } from 'date-fns';
import { Dinero } from '../dominio/dinero';
import {
  deCentavos,
  reconstruirCredito,
  type DetalleCredito,
  type FilaCredito,
  type FilaPago,
  type ReglasGasto,
} from './reconstructor';

export interface ContextoCartera {
  creditos: readonly FilaCredito[];
  pagos: readonly FilaPago[];
  nombres: Record<string, string>;
  reglas: ReglasGasto;
}

/** Reconstruye toda la cartera a una fecha de corte (pagos posteriores excluidos). */
export function reconstruirTodos(ctx: ContextoCartera, corte: string): DetalleCredito[] {
  return ctx.creditos.map((c) =>
    reconstruirCredito(
      c,
      ctx.nombres[c.id_cliente] ?? '(sin nombre)',
      ctx.pagos.filter((p) => p.id_credito === c.id_credito && p.fecha <= corte),
      corte,
      ctx.reglas,
    ),
  );
}

const pct = (parte: Dinero, base: Dinero): number =>
  base.esCero()
    ? 0
    : parte.dividirEntre(base.aNumero()).multiplicarPor(100).redondeado().aNumero();

// ── G-1 · Cartera al corte ────────────────────────────────────────

export type TramoRiesgo = 'MORA_1' | 'MORA_2' | 'MORA_3' | 'VENCIDO' | 'REESTRUCTURADO_AL_DIA';

export interface LineaRiesgo {
  tramo: TramoRiesgo;
  creditos: number;
  saldoCapital: Dinero;
  porcentaje: number;
}

export interface CarteraCorte {
  corte: string;
  creditosActivos: number;
  carteraActiva: Dinero;
  carteraEnMora: Dinero;
  porcentajeEnMora: number;
  carteraEnRiesgo: Dinero;
  porcentajeRiesgo: number;
  desglose: readonly LineaRiesgo[];
  incobrablesDelMes: Dinero;
  creditosIncobrablesDelMes: number;
}

const tramoDeRiesgo = (d: DetalleCredito): TramoRiesgo =>
  d.diasAtraso === 0
    ? 'REESTRUCTURADO_AL_DIA'
    : d.diasAtraso <= 30
      ? 'MORA_1'
      : d.diasAtraso <= 60
        ? 'MORA_2'
        : d.diasAtraso <= 90
          ? 'MORA_3'
          : 'VENCIDO';

export function carteraAlCorte(ctx: ContextoCartera, corte: string): CarteraCorte {
  const detalles = reconstruirTodos(ctx, corte);
  const activos = detalles.filter((d) => d.estado !== 'incobrable');
  const carteraActiva = activos.reduce((a, d) => a.sumar(d.saldoCapital), Dinero.cero());

  const enMora = activos.filter((d) => d.diasAtraso >= 1);
  const carteraEnMora = enMora.reduce((a, d) => a.sumar(d.saldoCapital), Dinero.cero());

  const enRiesgo = activos.filter((d) => d.diasAtraso > 30 || d.reestructurado);
  const carteraEnRiesgo = enRiesgo.reduce((a, d) => a.sumar(d.saldoCapital), Dinero.cero());

  const buckets: TramoRiesgo[] = ['MORA_1', 'MORA_2', 'MORA_3', 'VENCIDO', 'REESTRUCTURADO_AL_DIA'];
  const desglose = buckets.map((tramo) => {
    const delTramo = enRiesgo.filter((d) => tramoDeRiesgo(d) === tramo);
    const saldo = delTramo.reduce((a, d) => a.sumar(d.saldoCapital), Dinero.cero());
    return { tramo, creditos: delTramo.length, saldoCapital: saldo, porcentaje: pct(saldo, carteraActiva) };
  });

  // Incobrables cuya baja contable (vencimiento + 121 días) cayó en el mes del corte.
  const mes = corte.slice(0, 7);
  const bajadosEnElMes = detalles.filter((d) => {
    if (d.estado !== 'incobrable') return false;
    const primeraImpaga = d.cuotas.find((q) => !q.pagada);
    if (!primeraImpaga) return false;
    const fechaBaja = format(addDays(parseISO(primeraImpaga.vencimiento), 121), 'yyyy-MM-dd');
    return fechaBaja.slice(0, 7) === mes;
  });

  return {
    corte,
    creditosActivos: activos.length,
    carteraActiva,
    carteraEnMora,
    porcentajeEnMora: pct(carteraEnMora, carteraActiva),
    carteraEnRiesgo,
    porcentajeRiesgo: pct(carteraEnRiesgo, carteraActiva),
    desglose,
    incobrablesDelMes: bajadosEnElMes.reduce((a, d) => a.sumar(d.saldoCapital), Dinero.cero()),
    creditosIncobrablesDelMes: bajadosEnElMes.length,
  };
}

// ── G-2 / G-3 · Cierres (diario y mensual: mismo esqueleto) ────────

export interface CierrePeriodo {
  desde: string;
  hasta: string;
  desembolsos: Dinero;
  numeroDesembolsos: number;
  recuperaciones: {
    gastos: Dinero;
    interesMoratorio: Dinero;
    interesCorriente: Dinero;
    capital: Dinero;
    total: Dinero;
  };
  numeroPagos: number;
}

export function cierreEntre(ctx: ContextoCartera, desde: string, hasta: string): CierrePeriodo {
  const detalles = reconstruirTodos(ctx, hasta);
  const desembolsados = ctx.creditos.filter((c) => c.fecha >= desde && c.fecha <= hasta);
  const desembolsos = desembolsados.reduce(
    (a, c) => a.sumar(deCentavos(c.capital_centavos)),
    Dinero.cero(),
  );

  let gastos = Dinero.cero();
  let moratorio = Dinero.cero();
  let corriente = Dinero.cero();
  let capital = Dinero.cero();
  let numeroPagos = 0;
  for (const d of detalles) {
    for (const a of d.aplicaciones) {
      if (a.fecha < desde || a.fecha > hasta) continue;
      numeroPagos += 1;
      gastos = gastos.sumar(a.aplicados.gastos);
      moratorio = moratorio.sumar(a.aplicados.interesMoratorio);
      corriente = corriente.sumar(a.aplicados.interesCorriente);
      capital = capital.sumar(a.aplicados.capital);
    }
  }
  return {
    desde,
    hasta,
    desembolsos,
    numeroDesembolsos: desembolsados.length,
    recuperaciones: {
      gastos,
      interesMoratorio: moratorio,
      interesCorriente: corriente,
      capital,
      total: gastos.sumar(moratorio).sumar(corriente).sumar(capital),
    },
    numeroPagos,
  };
}

// ── G-6 · Vencimientos próximos ───────────────────────────────────

export interface Vencimiento {
  idCredito: string;
  cliente: string;
  numero: number;
  vencimiento: string;
  monto: Dinero;
}

export function vencimientosEn(
  ctx: ContextoCartera,
  corte: string,
  dias: number,
): { ventana: { desde: string; hasta: string }; cuotas: Vencimiento[]; total: Dinero } {
  const hasta = format(addDays(parseISO(corte), dias), 'yyyy-MM-dd');
  const detalles = reconstruirTodos(ctx, corte);
  const cuotas: Vencimiento[] = [];
  for (const d of detalles) {
    if (d.estado === 'incobrable' || d.estado === 'cancelado') continue;
    for (const q of d.cuotas) {
      if (!q.pagada && q.vencimiento > corte && q.vencimiento <= hasta) {
        cuotas.push({ idCredito: d.id, cliente: d.nombreCliente, numero: q.numero, vencimiento: q.vencimiento, monto: q.monto });
      }
    }
  }
  cuotas.sort((a, b) => a.vencimiento.localeCompare(b.vencimiento));
  return {
    ventana: { desde: corte, hasta },
    cuotas,
    total: cuotas.reduce((a, q) => a.sumar(q.monto), Dinero.cero()),
  };
}

// ── G-4 · Morosos (filtrable por tramo) ───────────────────────────

export interface Moroso {
  idCredito: string;
  cliente: string;
  dias: number;
  tramo: string;
  politica: string;
  saldoCapital: Dinero;
  deudaTotal: Dinero | null;
}

export function morososAlCorte(ctx: ContextoCartera, corte: string, tramo?: string): Moroso[] {
  const enMora = reconstruirTodos(ctx, corte).filter((d) => d.estado === 'en_mora');
  const filtrados = tramo ? enMora.filter((d) => d.tramo === tramo) : enMora;
  return filtrados
    .sort((a, b) => b.diasAtraso - a.diasAtraso)
    .map((d) => ({
      idCredito: d.id,
      cliente: d.nombreCliente,
      dias: d.diasAtraso,
      tramo: d.tramo,
      politica: d.politica,
      saldoCapital: d.saldoCapital,
      deudaTotal: d.deuda ? d.deuda.total : null,
    }));
}