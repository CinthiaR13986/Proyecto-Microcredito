/**
 * ejemplos.ts — E5 · Ejemplos curados (few-shot) que guían al asistente.
 *
 * No es un entrenamiento del modelo (fuera de alcance, enunciado 3.1): son
 * conversaciones correctas que se muestran al LLM en el prompt.
 *
 * De dónde salen:
 *   1. `npm run evals` corre el banco de pruebas y guarda las conversaciones
 *      que pasaron en tests/evals/candidatos.json.
 *   2. Una persona del equipo las revisa y promueve las buenas con
 *      `npm run evals:promover -- <id> ... --revisor "Nombre"`.
 *   3. Al promover, las cifras se reemplazan por ⟨cifra⟩: el ejemplo enseña
 *      QUÉ herramienta usar y CÓMO redactar, nunca un número, para que el
 *      modelo no copie cifras viejas en vez de consultar el núcleo.
 *
 * Nada entra aquí sin revisión humana.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface EjemploCurado {
  id: string;
  pregunta: string;
  herramientas: { nombre: string; argumentos: Record<string, unknown> }[];
  respuesta: string;
  revisor: string;
  fecha: string;
}

export const RUTA_EJEMPLOS = join(dirname(fileURLToPath(import.meta.url)), 'ejemplos.json');

/** Máximo de ejemplos en el prompt (costo y foco). */
export const MAX_EJEMPLOS = 15;

/**
 * Cifras que dependen de los datos → ⟨cifra⟩: montos, porcentajes, conteos
 * ("14 créditos", "2 de 6") y días de atraso de un crédito. Se conservan los
 * IDs, las fechas y los límites fijos de los tramos ("1 a 30 días").
 */
export function anonimizarCifras(texto: string): string {
  return texto
    .replace(/Q\s?\d[\d,]*(\.\d+)?/g, 'Q⟨cifra⟩')
    .replace(/(?<![\w-])\d[\d,]*(\.\d+)?\s?%/g, '⟨cifra⟩ %')
    .replace(/(?<![\w-])\d{1,3}(,\d{3})+(\.\d+)?(?![\w-])/g, '⟨cifra⟩')
    .replace(/(?<![\w-])\d+\.\d{2,}(?![\w-])/g, '⟨cifra⟩')
    .replace(/(?<![\w-])\d+(?=\s+(créditos?|cuotas?|pagos?|desembolsos?|clientes?)\b)/gi, '⟨cifra⟩')
    .replace(/(?<![\w-])\d+\s+de\s+\d+(?=\s|$|[.,;)])/g, '⟨cifra⟩ de ⟨cifra⟩')
    .replace(/(?<![\w-])(?<!\ba\s)\d+(?=\s+días\s+de\s+atraso)/gi, '⟨cifra⟩')
    .replace(/(atraso\s*:\s*)\d+/gi, '$1⟨cifra⟩');
}

/** Razones para rechazar un ejemplo (vacío = aceptable). */
export function problemasDeEjemplo(e: { pregunta: string; respuesta: string }): string[] {
  const p: string[] = [];
  const todo = `${e.pregunta}\n${e.respuesta}`;
  if (/DPI-[A-Z]+-\d+/i.test(todo)) p.push('contiene un DPI');
  if (/(?<![\w-])\d{4}-\d{4}(?![\w-])/.test(todo)) p.push('contiene un teléfono');
  if (/CANARIO/i.test(todo)) p.push('contiene el texto de la instrucción incrustada');
  if (anonimizarCifras(e.respuesta) !== e.respuesta) p.push('contiene cifras sin anonimizar');
  if (e.respuesta.trim().length < 20) p.push('respuesta demasiado corta');
  return p;
}

export function cargarEjemplos(): EjemploCurado[] {
  if (!existsSync(RUTA_EJEMPLOS)) return [];
  return JSON.parse(readFileSync(RUTA_EJEMPLOS, 'utf8')) as EjemploCurado[];
}

export function seccionEjemplos(): string {
  const ejemplos = cargarEjemplos().slice(-MAX_EJEMPLOS);
  if (ejemplos.length === 0) return '';
  const bloques = ejemplos.map((e) => {
    const herr = e.herramientas.map((h) => `${h.nombre}(${JSON.stringify(h.argumentos)})`).join(' → ') || '(ninguna)';
    return `Usuario: ${e.pregunta}\nHerramientas: ${herr}\nRespuesta: ${e.respuesta}`;
  });
  return `EJEMPLOS DE CONVERSACIONES CORRECTAS (revisados por el equipo). ⟨cifra⟩ significa "la cifra que devuelva la herramienta": nunca copies números de los ejemplos, consulta siempre.

${bloques.join('\n\n')}`;
}
