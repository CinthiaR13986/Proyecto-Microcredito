/**
 * plan-amortizacion.ts — Plan de amortización francés (cuota fija).
 *
 * Reglas de negocio (sección 6.4):
 *  - cuota = P · i(1+i)^n / ((1+i)^n − 1);  caso especial i = 0 → cuota = P / n.
 *  - Por período: interes_k = redondear(saldo_{k-1} · i);
 *                 amortizacion_k = cuota − interes_k;
 *                 saldo_k = saldo_{k-1} − amortizacion_k.
 *  - AJUSTE DE ÚLTIMA CUOTA: amortizacion_n = saldo_{n-1} (todo el saldo),
 *    cuota_n = amortizacion_n + interes_n.
 *  - Invariantes (6.10): Σ amortizaciones = P exacto y saldo_n = 0.00 exacto.
 *
 * Diseño (secciones 7.2 y 9):
 *  - Strategy: interfaz MetodoAmortizacion; MetodoFrances es una implementación.
 *  - Factory:  PlanAmortizacion.generar() garantiza los invariantes.
 */
import Decimal from 'decimal.js';
import { Dinero } from './dinero';

/** Una fila de la tabla de amortización. */
export interface Cuota {
  readonly numero: number;
  readonly saldoInicial: Dinero;
  readonly cuota: Dinero;
  readonly interes: Dinero;
  readonly amortizacion: Dinero;
  readonly saldoFinal: Dinero;
}

/**
 * Strategy (GoF): método de interés.
 * Permite agregar métodos nuevos sin tocar el motor de generación (OCP).
 * La política es intercambiable y versionable, nunca una constante.
 */
export interface MetodoAmortizacion {
  readonly nombre: string;
  /** Cuota fija teórica SIN redondear. */
  cuotaBase(capital: Dinero, tasaMensual: Decimal, numeroCuotas: number): Dinero;
}

/** Método francés: cuota fija con composición capital/interés variable. */
export const MetodoFrances: MetodoAmortizacion = {
  nombre: 'francés',
  cuotaBase(capital, tasaMensual, numeroCuotas) {
    if (tasaMensual.isZero()) {
      return capital.dividirEntre(numeroCuotas); // caso especial i = 0 (6.4)
    }
    const factor = new Decimal(1).plus(tasaMensual).pow(numeroCuotas);
    const coeficiente = tasaMensual.times(factor).dividedBy(factor.minus(1));
    return capital.multiplicarPor(coeficiente.toString());
  },
};

/** Parámetros para generar un plan. */
export interface ParametrosPlan {
  readonly capital: Dinero;
  /** Tasa periódica mensual en decimal (0.03 = 3 % mensual). */
  readonly tasaMensual: number | string;
  readonly numeroCuotas: number;
  readonly metodo?: MetodoAmortizacion;
}

export class PlanAmortizacion {
  private readonly filas: readonly Cuota[];

  private constructor(filas: Cuota[]) {
    this.filas = filas;
  }

  /** Factory (GoF): construye el plan y verifica invariantes antes de entregarlo. */
  static generar(params: ParametrosPlan): PlanAmortizacion {
    const metodo = params.metodo ?? MetodoFrances;
    const i = new Decimal(params.tasaMensual);
    const n = params.numeroCuotas;

    if (!Number.isInteger(n) || n <= 0) {
      throw new Error('PlanAmortizacion: el número de cuotas debe ser entero positivo');
    }
    if (i.isNegative()) {
      throw new Error('PlanAmortizacion: la tasa no puede ser negativa');
    }

    const cuotaFija = metodo.cuotaBase(params.capital, i, n).redondeado();
    const filas: Cuota[] = [];
    let saldo = params.capital.redondeado();

    for (let k = 1; k <= n; k++) {
      const interes = saldo.multiplicarPor(i.toString()).redondeado();
      const esUltima = k === n;
      // Regla 6.4: la última cuota absorbe TODO el saldo restante (cuadre).
      const amortizacion = esUltima ? saldo : cuotaFija.restar(interes);
      const cuota = esUltima ? amortizacion.sumar(interes) : cuotaFija;
      const saldoFinal = saldo.restar(amortizacion);

      filas.push({
        numero: k,
        saldoInicial: saldo,
        cuota,
        interes,
        amortizacion,
        saldoFinal,
      });
      saldo = saldoFinal;
    }

    const plan = new PlanAmortizacion(filas);
    plan.verificarInvariantes(params.capital);
    return plan;
  }

  /** Invariantes 6.10: Σ amortizaciones = P y saldo final = 0.00 exactos. */
  private verificarInvariantes(capital: Dinero): void {
    if (!this.totalAmortizacion.esIgualA(capital.redondeado())) {
      throw new Error('PlanAmortizacion: la suma de amortizaciones no cuadra con el capital');
    }
    if (!this.saldoFinal.esCero()) {
      throw new Error('PlanAmortizacion: el saldo final no es 0.00');
    }
  }

  /** Las 12 (o n) filas del plan, en orden. */
  get cuotas(): readonly Cuota[] {
    return this.filas;
  }

  get saldoFinal(): Dinero {
    const ultima = this.filas[this.filas.length - 1];
    return ultima ? ultima.saldoFinal : Dinero.cero();
  }

  get totalAmortizacion(): Dinero {
    return this.filas.reduce((acc, f) => acc.sumar(f.amortizacion), Dinero.cero());
  }

  get totalInteres(): Dinero {
    return this.filas.reduce((acc, f) => acc.sumar(f.interes), Dinero.cero());
  }

  get totalPagado(): Dinero {
    return this.filas.reduce((acc, f) => acc.sumar(f.cuota), Dinero.cero());
  }
}