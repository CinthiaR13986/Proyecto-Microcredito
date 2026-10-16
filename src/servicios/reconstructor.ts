/**
 * reconstructor.ts — E1 · Capa de aplicación.
 *
 * Reconstruye el estado de un crédito a una fecha de corte reproduciendo la
 * bitácora de pagos aplicados (P1 6.10) contra el plan de amortización, con:
 *  - prelación normativa (aplicarPago, P1 6.6),
 *  - política de mora resuelta por fecha de otorgamiento (CP-03),
 *  - gasto de gestión de cobro idempotente (CP-02, solo POL-2026-10),
 *  - tramos derivados y reversibles (P1 6.7),
 *  - suspensión de devengo cuantificada (CP-04.2).
 *
 * Ninguna cifra se escribe a mano: el plan sale de PlanAmortizacion, la mora
 * de PoliticaMora y la aplicación de aplicarPago. La fecha de corte SIEMPRE
 * es parámetro (puerto Reloj): nunca se lee el reloj del sistema.
 */
import { addMonths, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { Dinero } from '../dominio/dinero';
import { MetodoFrances, PlanAmortizacion } from '../dominio/plan-amortizacion';
import { aplicarPago, type Rubros } from '../dominio/prelacion-pago';
import { clasificarTramo, type TramoMora } from '../dominio/calculadora-mora';
import {
  POLITICA_ESCALONADA,
  tramosRecorridos,
  type LineaTramo,
} from '../dominio/politica-mora/politica-escalonada';
import { POLITICA_PLANA } from '../dominio/politica-mora/politica-plana';
import type { PoliticaMora } from '../dominio/politica-mora/politica-mora';
import { devengarInteresCorriente } from '../dominio/devengo';

export const POLITICAS_POR_CODIGO: Record<string, PoliticaMora> = {
  'POL-2024-01': POLITICA_PLANA,
  'POL-2026-10': POLITICA_ESCALONADA,
};

export interface FilaCredito {
  id_credito: string;
  id_cliente: string;
  id_asesor: string;
  fecha: string;
  capital_centavos: number | string;
  plazo_meses: number;
  tna_bps: number;
  reestructurado: boolean;
  politica_mora: string;
}

export interface FilaPago {
  clave_idempotencia: string;
  id_credito: string;
  fecha: string;
  monto_centavos: number | string;
  canal: string;
}

export interface ReglasGasto {
  montoCentavos: number;
  diaGeneracion: number;
  aplicaAPoliticas: readonly string[];
}

/** Centavos enteros → Dinero, sin pasar por punto flotante. */
export function deCentavos(centavos: number | string): Dinero {
  const negativo = String(centavos).startsWith('-');
  const s = String(centavos).replace('-', '').padStart(3, '0');
  return Dinero.de(`${negativo ? '-' : ''}${s.slice(0, -2)}.${s.slice(-2)}`);
}

/** Dinero → centavos enteros (para la API y la base). */
export const aCentavos = (d: Dinero): number => Math.round(d.aNumero() * 100);

const iso = (f: Date): string => format(f, 'yyyy-MM-dd');
const noNeg = (d: Dinero): Dinero => (d.esNegativo() ? Dinero.cero() : d);
const sumaRubros = (r: Rubros): Dinero =>
  r.gastos.sumar(r.interesMoratorio).sumar(r.interesCorriente).sumar(r.capital);

export interface CuotaEstado {
  numero: number;
  vencimiento: string;
  monto: Dinero;
  interes: Dinero;
  amortizacion: Dinero;
  pagada: boolean;
  capitalRestante: Dinero;
  diasAtrasoAlCorte: number;
}

export interface AplicacionPago {
  clave: string;
  fecha: string;
  aplicados: Rubros;
  excedente: Dinero;
}

export interface DetalleCredito {
  id: string;
  idCliente: string;
  nombreCliente: string;
  politica: string;
  reestructurado: boolean;
  estado: 'vigente' | 'en_mora' | 'cancelado' | 'incobrable';
  diasAtraso: number;
  tramo: TramoMora;
  saldoCapital: Dinero;
  cuotas: CuotaEstado[];
  proximaCuota: { numero: number; vencimiento: string; monto: Dinero } | null;
  deuda: (Rubros & { total: Dinero; cuotaNumero: number }) | null;
  lineasMora: readonly LineaTramo[];
  interesEnSuspenso: Dinero;
  aplicaciones: AplicacionPago[];
}

export function reconstruirCredito(
  credito: FilaCredito,
  nombreCliente: string,
  pagos: readonly FilaPago[],
  corte: string,
  reglas: ReglasGasto,
): DetalleCredito {
  const tasaMensual = Number(credito.tna_bps) / 10000 / 12;
  const plan = PlanAmortizacion.generar({
    capital: deCentavos(credito.capital_centavos),
    tasaMensual,
    numeroCuotas: credito.plazo_meses,
    metodo: MetodoFrances,
  });
  const politica = POLITICAS_POR_CODIGO[credito.politica_mora] ?? POLITICA_PLANA;
  const aplicaGasto = reglas.aplicaAPoliticas.includes(credito.politica_mora);

  const cuotas: CuotaEstado[] = plan.cuotas.map((c) => ({
    numero: c.numero,
    vencimiento: iso(addMonths(parseISO(credito.fecha), c.numero)),
    monto: c.cuota,
    interes: c.interes,
    amortizacion: c.amortizacion,
    pagada: false,
    capitalRestante: c.amortizacion,
    diasAtrasoAlCorte: 0,
  }));

  const gastP = cuotas.map(() => Dinero.cero());
  const morP = cuotas.map(() => Dinero.cero());
  const corP = cuotas.map(() => Dinero.cero());
  const capP = cuotas.map(() => Dinero.cero());
  const aplicaciones: AplicacionPago[] = [];

  // ── Reproducción cronológica de la bitácora ────────────────
  for (const pago of pagos) {
    let remanente = deCentavos(pago.monto_centavos);
    const aplicados: Rubros = {
      gastos: Dinero.cero(),
      interesMoratorio: Dinero.cero(),
      interesCorriente: Dinero.cero(),
      capital: Dinero.cero(),
    };
    for (let i = 0; i < cuotas.length && remanente.esMayorQue(Dinero.cero()); i++) {
      const q = cuotas[i]!;
      const dias = differenceInCalendarDays(parseISO(pago.fecha), parseISO(q.vencimiento));
      const capitalEnMora = q.amortizacion.restar(capP[i]!);
      const rubros: Rubros = {
        gastos:
          aplicaGasto && dias >= reglas.diaGeneracion
            ? noNeg(deCentavos(reglas.montoCentavos).restar(gastP[i]!))
            : Dinero.cero(),
        interesMoratorio:
          dias > 0
            ? noNeg(politica.interesMoratorio(capitalEnMora, dias).restar(morP[i]!))
            : Dinero.cero(),
        interesCorriente: noNeg(q.interes.restar(corP[i]!)),
        capital: noNeg(q.amortizacion.restar(capP[i]!)),
      };
      if (sumaRubros(rubros).esCero()) continue;
      const r = aplicarPago(remanente, rubros);
      gastP[i] = gastP[i]!.sumar(r.aplicados.gastos);
      morP[i] = morP[i]!.sumar(r.aplicados.interesMoratorio);
      corP[i] = corP[i]!.sumar(r.aplicados.interesCorriente);
      capP[i] = capP[i]!.sumar(r.aplicados.capital);
      q.capitalRestante = q.amortizacion.restar(capP[i]!);
      aplicados.gastos = aplicados.gastos.sumar(r.aplicados.gastos);
      aplicados.interesMoratorio = aplicados.interesMoratorio.sumar(r.aplicados.interesMoratorio);
      aplicados.interesCorriente = aplicados.interesCorriente.sumar(r.aplicados.interesCorriente);
      aplicados.capital = aplicados.capital.sumar(r.aplicados.capital);
      remanente = r.excedente;
    }
    aplicaciones.push({
      clave: pago.clave_idempotencia,
      fecha: pago.fecha,
      aplicados,
      excedente: remanente,
    });
  }

  // ── Estado al corte ────────────────────────────────────────
  for (let i = 0; i < cuotas.length; i++) {
    const q = cuotas[i]!;
    q.pagada = q.capitalRestante.esCero() && q.interes.restar(corP[i]!).esCero();
    q.diasAtrasoAlCorte = differenceInCalendarDays(parseISO(corte), parseISO(q.vencimiento));
  }

  const primeraImpaga = cuotas.find((q) => !q.pagada) ?? null;
  let estado: DetalleCredito['estado'];
  let dias = 0;
  if (!primeraImpaga) {
    estado = 'cancelado';
  } else {
    dias = Math.max(0, primeraImpaga.diasAtrasoAlCorte);
    if (primeraImpaga.diasAtrasoAlCorte > 120) estado = 'incobrable';
    else if (primeraImpaga.diasAtrasoAlCorte >= 1) estado = 'en_mora';
    else estado = 'vigente';
  }
  const tramo = estado === 'en_mora' ? clasificarTramo(dias) : 'AL_DIA';
  const saldoCapital = cuotas.reduce((acc, q) => acc.sumar(q.capitalRestante), Dinero.cero());
  const proxima = cuotas.find((q) => !q.pagada && q.diasAtrasoAlCorte <= 0) ?? null;

  let deuda: DetalleCredito['deuda'] = null;
  let lineasMora: readonly LineaTramo[] = [];
  if (primeraImpaga && (estado === 'en_mora' || estado === 'incobrable')) {
    const idx = cuotas.indexOf(primeraImpaga);
    const diasMora = Math.min(dias, 120);
    const capitalEnMora = primeraImpaga.amortizacion.restar(capP[idx]!);
    const gastos =
      aplicaGasto && dias >= reglas.diaGeneracion
        ? noNeg(deCentavos(reglas.montoCentavos).restar(gastP[idx]!))
        : Dinero.cero();
    const interesMoratorio = noNeg(
      politica.interesMoratorio(capitalEnMora, diasMora).restar(morP[idx]!),
    );
    const interesCorriente = noNeg(primeraImpaga.interes.restar(corP[idx]!));
    const capital = noNeg(primeraImpaga.amortizacion.restar(capP[idx]!));
    deuda = {
      gastos,
      interesMoratorio,
      interesCorriente,
      capital,
      total: gastos.sumar(interesMoratorio).sumar(interesCorriente).sumar(capital),
      cuotaNumero: primeraImpaga.numero,
    };
    lineasMora = tramosRecorridos(capitalEnMora, diasMora);
  }

  const interesEnSuspenso =
    dias > 90 ? devengarInteresCorriente(saldoCapital, tasaMensual, dias).enSuspenso : Dinero.cero();

  return {
    id: credito.id_credito,
    idCliente: credito.id_cliente,
    nombreCliente,
    politica: credito.politica_mora,
    reestructurado: credito.reestructurado,
    estado,
    diasAtraso: dias,
    tramo,
    saldoCapital,
    cuotas,
    proximaCuota: proxima
      ? { numero: proxima.numero, vencimiento: proxima.vencimiento, monto: proxima.monto }
      : null,
    deuda,
    lineasMora,
    interesEnSuspenso,
    aplicaciones,
  };
}