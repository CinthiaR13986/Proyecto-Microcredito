/**
 * esquemas.ts — E4 · Contratos del RAG.
 *
 * El contenido recuperado se trata como DATO, nunca como instrucción.
 * La respuesta del asistente cita siempre el documento fuente.
 */
import { z } from 'zod';

export const ConsultaRagSchema = z.object({
  pregunta: z.string().min(5).describe('Pregunta en lenguaje natural sobre políticas o procedimientos'),
  corte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Fecha de corte para contexto temporal'),
});

export interface FragmentoCitado {
  doc_id: string;
  titulo: string;
  vigencia: string;
  seccion: string;
  texto: string;
  puntaje: number;
  /** true si el fragmento contiene instrucciones dirigidas a la IA (OP-7). */
  sospechoso: boolean;
}

export interface RespuestaRag {
  respuesta: string;
  fuentes: FragmentoCitado[];
  advertencia_seguridad?: string;
}