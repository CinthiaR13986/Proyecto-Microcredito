/**
 * puertos.ts — Puertos secundarios de la arquitectura hexagonal.
 *
 * El dominio depende de estas ABSTRACCIONES, nunca de la infraestructura
 * (Inversión de Dependencias, SOLID-D):
 *  - En pruebas: Reloj fijo y repositorio en memoria.
 *  - En producción (Proyecto Final): reloj real y PostgreSQL.
 *
 * El núcleo jamás lee la fecha del sistema ni conoce el motor de BD.
 */

/** Puerto Reloj: la fecha de corte se inyecta; una prueba no debe fallar mañana. */
export interface Reloj {
  /** Fecha de corte en formato ISO (ej. '2026-08-19'). */
  hoy(): string;
}

/** Puerto de generación de identificadores. */
export interface GeneradorIds {
  siguiente(prefijo: string): string;
}

/**
 * Puerto de persistencia de créditos.
 * Genérico: el dominio no sabe si detrás hay PostgreSQL o un Map en memoria.
 */
export interface RepositorioCreditos<TCredito> {
  obtener(id: string): Promise<TCredito | null>;
  guardar(credito: TCredito): Promise<void>;
}