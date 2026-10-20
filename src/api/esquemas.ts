/**
 * esquemas.ts — Contratos Zod de la API (P1 8.2: un esquema, tres usos:
 * API, OpenAPI y herramientas MCP).
 */
import { z } from 'zod';

/** Fecha ISO AAAA-MM-DD. Nunca se acepta "hoy": la fecha de corte es parámetro. */
export const FechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida: use el formato AAAA-MM-DD');

/**
 * Corte por defecto = fecha de congelación del paquete canónico (LEEME.md).
 * Es un dato del paquete, NO el reloj del sistema.
 */
export const CORTE_CANONICO = '2026-10-31';

export const CorteQuerySchema = z.object({
  corte: FechaSchema.default(CORTE_CANONICO),
});

export const PagoRequestSchema = z.object({
  id_credito: z.string().min(1),
  clave_idempotencia: z.string().min(6),
  monto_centavos: z.number().int().positive(),
  canal: z.enum(['campo', 'agencia', 'transferencia']),
  fecha: FechaSchema,
});

export const ClienteRequestSchema = z.object({
  id_cliente: z.string().min(1).optional(),
  nombre_completo: z.string().min(3),
  dpi: z.string().min(3),
  telefono: z.string().min(6),
  municipio: z.string().min(2),
  fecha_alta: FechaSchema,
});

export const CreditoRequestSchema = z.object({
  id_credito: z.string().min(1),
  id_cliente: z.string().min(1),
  id_asesor: z.string().min(1),
  fecha: FechaSchema,
  capital_centavos: z.number().int().min(100000).max(2500000), // Q1,000 – Q25,000
  plazo_meses: z.number().int().min(3).max(24),
  tna_bps: z.number().int().min(0).max(10000),
});

export const SimulacionQuerySchema = z.object({
  capital_centavos: z.coerce.number().int().min(100000).max(2500000),
  plazo_meses: z.coerce.number().int().min(3).max(24),
  tna_bps: z.coerce.number().int().min(0).max(10000),
});

export const DiasQuerySchema = z.object({
  corte: FechaSchema.default(CORTE_CANONICO),
  dias: z.coerce.number().int().min(1).max(365),
});

export const MorososQuerySchema = z.object({
  corte: FechaSchema.default(CORTE_CANONICO),
  tramo: z.string().optional(),
});

export const MesQuerySchema = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/, 'Mes inválido: use el formato AAAA-MM'),
});