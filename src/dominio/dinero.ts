/**
 * dinero.ts — Objeto de Valor (Value Object) "Dinero".
 *
 * Regla de negocio (sección 6.2 del enunciado):
 *  - Todo importe monetario se representa con aritmética decimal exacta
 *    (decimal.js), NUNCA con Number de punto flotante.
 *  - Es INMUTABLE: toda operación devuelve un Dinero nuevo.
 *  - Lleva moneda y prohíbe mezclar monedas distintas.
 *  - Redondeo: 2 decimales, medio hacia arriba (ROUND_HALF_UP).
 */
import Decimal from 'decimal.js';

// Precisión interna alta para cálculos; el redondeo a centavos se aplica
// solo donde la regla de negocio lo exige (por cuota, no al final).
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/** Monedas soportadas por el Sistema. */
export enum Moneda {
  Quetzal = 'GTQ',
  Dolar = 'USD',
}

export class Dinero {
  private readonly monto: Decimal;
  private readonly moneda: Moneda;

  // Constructor privado: solo se crea Dinero mediante las fábricas de abajo.
  private constructor(monto: Decimal, moneda: Moneda) {
    this.monto = monto;
    this.moneda = moneda;
  }

  // ─────────────────────────── Fábricas ───────────────────────────

  /** Crea un Dinero a partir de un número o texto (ej. "1004.62"). */
  static de(valor: number | string, moneda: Moneda = Moneda.Quetzal): Dinero {
    return new Dinero(new Decimal(valor), moneda);
  }

  /** Dinero con monto 0.00 en la moneda indicada. */
  static cero(moneda: Moneda = Moneda.Quetzal): Dinero {
    return new Dinero(new Decimal(0), moneda);
  }

  // ─────────────────── Aritmética (inmutable) ─────────────────────

  /** Suma dos Dinero de la misma moneda. Devuelve un Dinero NUEVO. */
  sumar(otro: Dinero): Dinero {
    this.asegurarMismaMoneda(otro);
    return new Dinero(this.monto.plus(otro.monto), this.moneda);
  }

  /** Resta otro Dinero de la misma moneda. */
  restar(otro: Dinero): Dinero {
    this.asegurarMismaMoneda(otro);
    return new Dinero(this.monto.minus(otro.monto), this.moneda);
  }

  /** Multiplica por un factor (ej. tasa 0.03). El factor NO es dinero. */
  multiplicarPor(factor: number | string): Dinero {
    return new Dinero(this.monto.times(new Decimal(factor)), this.moneda);
  }

  /** Divide entre un número. Lanza error si el divisor es cero. */
  dividirEntre(divisor: number | string): Dinero {
    const d = new Decimal(divisor);
    if (d.isZero()) {
      throw new Error('Dinero: división por cero no permitida');
    }
    return new Dinero(this.monto.dividedBy(d), this.moneda);
  }

  /** Redondeo monetario: 2 decimales, medio hacia arriba (regla 6.2). */
  redondeado(): Dinero {
    return new Dinero(
      this.monto.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      this.moneda,
    );
  }

  /** El menor de dos montos de la misma moneda (útil en la prelación). */
  static menor(a: Dinero, b: Dinero): Dinero {
    a.asegurarMismaMoneda(b);
    return a.monto.lte(b.monto) ? a : b;
  }

  // ─────────────────────── Comparaciones ──────────────────────────

  esCero(): boolean {
    return this.monto.isZero();
  }

  esNegativo(): boolean {
    return this.monto.isNegative();
  }

  esMayorQue(otro: Dinero): boolean {
    this.asegurarMismaMoneda(otro);
    return this.monto.gt(otro.monto);
  }

  esMenorQue(otro: Dinero): boolean {
    this.asegurarMismaMoneda(otro);
    return this.monto.lt(otro.monto);
  }

  esIgualA(otro: Dinero): boolean {
    this.asegurarMismaMoneda(otro);
    return this.monto.eq(otro.monto);
  }

  // ─────────────── Salida (frontera: pruebas / presentación) ──────

  /**
   * Valor numérico redondeado a 2 decimales.
   * SOLO para mostrar o comparar en pruebas; el núcleo opera con Decimal.
   */
  aNumero(): number {
    return this.redondeado().monto.toNumber();
  }

  /** Representación textual, ej. "Q1004.62". */
  toString(): string {
    return `Q${this.redondeado().monto.toFixed(2)}`;
  }

  // ─────────────────────── Privados ───────────────────────────────

  /** Regla 6.2: prohíbe operar quetzales con dólares. */
  private asegurarMismaMoneda(otro: Dinero): void {
    if (this.moneda !== otro.moneda) {
      throw new Error(
        `Dinero: no se puede operar ${this.moneda} con ${otro.moneda} (monedas distintas)`,
      );
    }
  }
}