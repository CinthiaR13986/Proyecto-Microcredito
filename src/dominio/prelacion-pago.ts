/**
 * prelacion-pago.ts — Aplicación de pagos con prelación (sección 6.6).
 *
 * Orden legal de aplicación (6.6.2):
 *   1. Gastos y comisiones
 *   2. Interés moratorio
 *   3. Interés corriente
 *   4. Capital
 * Cada rubro consume lo suyo y pasa el remanente al siguiente
 * (Chain of Responsibility, GoF).
 *
 * Escenarios cubiertos (6.6.3–6.6.5):
 *   A pago exacto  → cuota saldada, remanente 0.
 *   B pago parcial → se aplica hasta donde alcanza; NO salda y NO se rechaza.
 *   C pago de más  → salda lo vencido y el excedente se aplica a favor del
 *                    cliente según la política de adelanto (Strategy).
 *
 * La prelación es regla de negocio, no detalle de implementación:
 * cambiar el orden altera cuánto debe el cliente y cuánto ingreso
 * reconoce la institución.
 */
import { Dinero } from './dinero';

/** Los cuatro rubros de una cuota vencida. */
export interface Rubros {
  readonly gastos: Dinero;
  readonly interesMoratorio: Dinero;
  readonly interesCorriente: Dinero;
  readonly capital: Dinero;
}

export type Rubro = keyof Rubros;

/** Orden de prelación normativo (6.6.2). Reordenar la cadena = cambiar política. */
export const ORDEN_PRELACION: readonly Rubro[] = [
  'gastos',
  'interesMoratorio',
  'interesCorriente',
  'capital',
];

/** Rubros en cero (acumulador inicial). */
export const rubrosCero = (): Rubros => ({
  gastos: Dinero.cero(),
  interesMoratorio: Dinero.cero(),
  interesCorriente: Dinero.cero(),
  capital: Dinero.cero(),
});

/** Suma de los cuatro rubros (invariante de conservación del dinero). */
export const totalRubros = (r: Rubros): Dinero =>
  r.gastos.sumar(r.interesMoratorio).sumar(r.interesCorriente).sumar(r.capital);

/** Devuelve una copia con el monto sumado al rubro indicado (inmutable). */
const sumarRubro = (r: Rubros, rubro: Rubro, monto: Dinero): Rubros => {
  switch (rubro) {
    case 'gastos':
      return { ...r, gastos: r.gastos.sumar(monto) };
    case 'interesMoratorio':
      return { ...r, interesMoratorio: r.interesMoratorio.sumar(monto) };
    case 'interesCorriente':
      return { ...r, interesCorriente: r.interesCorriente.sumar(monto) };
    case 'capital':
      return { ...r, capital: r.capital.sumar(monto) };
    default:
      throw new Error(`Rubro desconocido: ${String(rubro)}`);
  }
};

/**
 * Chain of Responsibility (GoF): cada eslabón consume lo que le corresponde
 * —mínimo(remanente, pendiente)— y delega el resto en el siguiente.
 * El último eslabón devuelve el remanente final (excedente).
 */
export class EslabonPrelacion {
  constructor(
    readonly rubro: Rubro,
    private readonly siguiente: EslabonPrelacion | null = null,
  ) {}

  procesar(
    remanente: Dinero,
    deuda: Rubros,
    aplicados: Rubros,
  ): { remanente: Dinero; aplicados: Rubros } {
    const aplicado = Dinero.menor(remanente, deuda[this.rubro]);
    const nuevosAplicados = sumarRubro(aplicados, this.rubro, aplicado);
    const restante = remanente.restar(aplicado);
    if (this.siguiente === null) {
      return { remanente: restante, aplicados: nuevosAplicados };
    }
    return this.siguiente.procesar(restante, deuda, nuevosAplicados);
  }
}

/** Construye la cadena en el orden normativo: gastos → moratorio → corriente → capital. */
export const crearCadenaPrelacion = (): EslabonPrelacion =>
  new EslabonPrelacion(
    'gastos',
    new EslabonPrelacion(
      'interesMoratorio',
      new EslabonPrelacion('interesCorriente', new EslabonPrelacion('capital', null)),
    ),
  );

/**
 * Política de adelanto (Strategy, 6.6.5): qué hacer con el excedente.
 * El excedente pertenece al cliente: nunca se pierde.
 */
export type DestinoExcedente = 'A_CAPITAL' | 'A_CUOTAS_FUTURAS';

export interface PoliticaAdelanto {
  readonly destino: DestinoExcedente;
}

/** Política elegida (recomendada por el enunciado): amortización a capital. */
export const POLITICA_ADELANTO_REFERENCIA: PoliticaAdelanto = {
  destino: 'A_CAPITAL',
};

export interface ResultadoAplicacionPago {
  readonly aplicados: Rubros;
  /** Remanente tras saldar todo lo adeudado (activa la política de adelanto). */
  readonly excedente: Dinero;
  readonly destinoExcedente: DestinoExcedente;
  /** Capital no cubierto tras el pago (pago parcial). */
  readonly capitalPendiente: Dinero;
  /** True solo si los cuatro rubros quedaron cubiertos por completo. */
  readonly cuotaSaldada: boolean;
}

/**
 * Aplica un pago a una deuda vencida con la prelación normativa (6.6).
 * Función pura: no muta los datos recibidos ni persiste nada
 * (la capa de crédito hará eso en el sub-paso 2.6).
 */
export function aplicarPago(
  pago: Dinero,
  deuda: Rubros,
  politicaAdelanto: PoliticaAdelanto = POLITICA_ADELANTO_REFERENCIA,
): ResultadoAplicacionPago {
  if (pago.esNegativo()) {
    throw new Error('aplicarPago: el pago no puede ser negativo');
  }
  const { remanente, aplicados } = crearCadenaPrelacion().procesar(
    pago,
    deuda,
    rubrosCero(),
  );
  const capitalPendiente = deuda.capital.restar(aplicados.capital);
  const cuotaSaldada = ORDEN_PRELACION.every((r) => aplicados[r].esIgualA(deuda[r]));

  return {
    aplicados,
    excedente: remanente,
    destinoExcedente: politicaAdelanto.destino,
    capitalPendiente,
    cuotaSaldada,
  };
}