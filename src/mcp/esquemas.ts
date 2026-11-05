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
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida: use el formato AAAA-MM-DD')
  .describe('Fecha de corte AAAA-MM-DD. Obligatoria: el sistema nunca usa la fecha del reloj.');

const IdCreditoSchema = z.string().min(1).describe('Identificador del crédito (ej: CV-2026-0043)');

export const CORTE_CANONICO = '2026-10-31';

export const ConsultarCreditoSchema = z.object({
  id_credito: IdCreditoSchema,
  corte: FechaSchema,
});

export const CalcularDeudaSchema = z.object({
  id_credito: IdCreditoSchema,
  corte: FechaSchema,
});

export const ExplicarMoraSchema = z.object({
  id_credito: IdCreditoSchema,
  corte: FechaSchema,
  numero_cuota: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Número de cuota a explicar. Si se omite, se explica la primera cuota vencida e impaga.'),
});

export const ListarMorososSchema = z.object({
  corte: FechaSchema,
  tramo: z
    .enum(['MORA_1', 'MORA_2', 'MORA_3', 'VENCIDO'])
    .optional()
    .describe('Filtrar por tramo ("Mora 3" = MORA_3). Si se omite, lista todos los créditos en mora.'),
});

export const VerVencimientosSchema = z.object({
  corte: FechaSchema,
  dias: z.number().int().min(1).max(365).describe('Ventana de días hacia adelante desde el corte'),
});

export const ConsultarCarteraSchema = z.object({
  corte: FechaSchema,
});

export const ConsultarCierreSchema = z
  .object({
    tipo: z.enum(['diario', 'mensual']).describe('Tipo de cierre'),
    fecha: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe('Fecha del cierre diario (AAAA-MM-DD); obligatoria si tipo = diario'),
    mes: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional()
      .describe('Mes del cierre mensual (AAAA-MM); obligatorio si tipo = mensual'),
  })
  .refine((d) => (d.tipo === 'diario' ? !!d.fecha : !!d.mes), {
    message: 'Cierre diario requiere fecha; mensual requiere mes',
  });

export const RegistrarPagoSchema = z.object({
  id_credito: IdCreditoSchema,
  clave_idempotencia: z.string().min(6).describe('Clave única para evitar doble cobro'),
  monto_centavos: z.number().int().positive(),
  canal: z.enum(['campo', 'agencia', 'transferencia']),
  fecha: FechaSchema,
  token_aprobacion: z
    .string()
    .describe('Firma de la aprobación humana, emitida por la interfaz. El asistente no puede generarla.'),
});
