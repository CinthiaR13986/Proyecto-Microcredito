/**
 * openrouter.ts — Cliente mínimo de OpenRouter (API compatible con OpenAI).
 *
 * Dos usos:
 *   1. chat()       → el LLM del asistente gerencial (E5): interpreta la
 *                     pregunta, elige herramientas y redacta. Nunca calcula cifras.
 *   2. embeddings() → vectores del corpus para el RAG (E4).
 *
 * Se usa fetch directo (sin SDK) para que el equipo pueda explicar
 * exactamente qué se envía al proveedor.
 */
import '../config';

const BASE_URL = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';

export const MODELO_CHAT = process.env.OPENROUTER_MODEL ?? '';
export const MODELO_EMBEDDINGS = process.env.OPENROUTER_EMBEDDINGS_MODEL ?? 'openai/text-embedding-3-small';
/** Dimensión del vector; debe coincidir con la columna vector(N) del RAG. */
export const DIMENSION_EMBEDDINGS = Number(process.env.OPENROUTER_EMBEDDINGS_DIM ?? 1536);

function clave(): string {
  const k = process.env.OPENROUTER_API_KEY;
  if (!k) throw new Error('Falta OPENROUTER_API_KEY (defínala en .env; vea .env.example).');
  return k;
}

function cabeceras(): Record<string, string> {
  return {
    Authorization: `Bearer ${clave()}`,
    'Content-Type': 'application/json',
    'X-Title': 'Credito Vecino - Asistente gerencial',
  };
}

// ── Tipos del formato chat/completions ─────────────────────────────

export interface LlamadaHerramienta {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export type MensajeLLM =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: LlamadaHerramienta[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface HerramientaLLM {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export async function chat(
  mensajes: MensajeLLM[],
  herramientas: HerramientaLLM[],
): Promise<Extract<MensajeLLM, { role: 'assistant' }>> {
  if (!MODELO_CHAT) throw new Error('Falta OPENROUTER_MODEL (defínala en .env; vea .env.example).');
  const r = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: cabeceras(),
    body: JSON.stringify({
      model: MODELO_CHAT,
      messages: mensajes,
      tools: herramientas,
      tool_choice: 'auto',
      temperature: 0,
    }),
  });
  const cuerpo = (await r.json()) as {
    choices?: { message: Extract<MensajeLLM, { role: 'assistant' }> }[];
    error?: { message?: string };
  };
  if (!r.ok || !cuerpo.choices?.[0]) {
    throw new Error(`OpenRouter (${r.status}): ${cuerpo.error?.message ?? 'respuesta vacía'}`);
  }
  const m = cuerpo.choices[0].message;
  return { role: 'assistant', content: m.content ?? null, ...(m.tool_calls?.length ? { tool_calls: m.tool_calls } : {}) };
}

export async function embeddings(textos: string[]): Promise<number[][]> {
  const r = await fetch(`${BASE_URL}/embeddings`, {
    method: 'POST',
    headers: cabeceras(),
    body: JSON.stringify({ model: MODELO_EMBEDDINGS, input: textos }),
  });
  const cuerpo = (await r.json()) as {
    data?: { embedding: number[]; index: number }[];
    error?: { message?: string };
  };
  if (!r.ok || !cuerpo.data) {
    throw new Error(`OpenRouter embeddings (${r.status}): ${cuerpo.error?.message ?? 'respuesta vacía'}`);
  }
  const vectores = [...cuerpo.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
  for (const v of vectores) {
    if (v.length !== DIMENSION_EMBEDDINGS) {
      throw new Error(
        `El modelo ${MODELO_EMBEDDINGS} devolvió vectores de ${v.length} dimensiones; ` +
          `se esperaban ${DIMENSION_EMBEDDINGS} (ajuste OPENROUTER_EMBEDDINGS_DIM y re-ingiera).`,
      );
    }
  }
  return vectores;
}
