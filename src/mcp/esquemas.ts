/**
 * esquemas.ts — E3 · Esquemas Zod de las herramientas MCP.
 *
 * Un esquema escrito una vez valida tres cosas:
 *   1. La entrada de la API REST (E1)
 *   2. La entrada de las herramientas MCP (este archivo)
 *   3. La generación automática de OpenAPI
 *
 * Cada herramienta recibe la fecha de corte como parámetro.
 * Ninguna lee la fecha del sistema (puerto Reloj del P1).
 */
import { z } from 'zod';

export const FechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida: use el formato AAAA-MM-DD');

export const CORTE_CANONICO = '2026-10-31';

export const ConsultarCreditoSchema = z.object({
  id_credito: z.string().min(1).describe('Identificador del crédito (ej: CV-2026-0043)'),
  corte: FechaSchema.default(CORTE_CANONICO).describe('Fecha de corte para el cálculo'),
});

export const CalcularDeudaSchema = z.object({
  id_credito: z.string().min(1),
  corte: FechaSchema.default(CORTE_CANONICO),
});

export const ExplicarMoraSchema = z.object({
  id_credito: z.string().min(1),
  corte: FechaSchema.default(CORTE_CANONICO),
});

export const ListarMorososSchema = z.object({
  corte: FechaSchema.default(CORTE_CANONICO),
  tramo: z.string().optional().describe('Filtrar por tramo: MORA_1, MORA_2, MORA_3, VENCIDO'),
});

export const VerVencimientosSchema = z.object({
  corte: FechaSchema.default(CORTE_CANONICO),
  dias: z.number().int().min(1).max(365).describe('Ventana de días hacia adelante'),
});

export const ConsultarCarteraSchema = z.object({
  corte: FechaSchema.default(CORTE_CANONICO),
});

export const ConsultarCierreSchema = z
  .object({
    tipo: z.enum(['diario', 'mensual']).describe('Tipo de cierre'),
    fecha: FechaSchema.optional().describe('Fecha del cierre diario (AAAA-MM-DD)'),
    mes: z.string().regex(/^\d{4}-\d{2}$/).optional().describe('Mes del cierre mensual (AAAA-MM)'),
  })
  .refine((d) => (d.tipo === 'diario' ? !!d.fecha : !!d.mes), {
    message: 'Cierre diario requiere fecha; mensual requiere mes',
  });

export const RegistrarPagoSchema = z.object({
  id_credito: z.string().min(1),
  clave_idempotencia: z.string().min(6).describe('Clave única para evitar doble cobro'),
  monto_centavos: z.number().int().positive(),
  canal: z.enum(['campo', 'agencia', 'transferencia']),
  fecha: FechaSchema,
});