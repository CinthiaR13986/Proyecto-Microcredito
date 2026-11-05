/**
 * lenguaje.ts — E5 · Comprensión de un español sencillo.
 *
 * Quienes usan el sistema no siempre escriben un español "de oficina": hay
 * personas que hablan un idioma maya como primera lengua, que escriben sin
 * tildes, con frases cortas o con el orden cambiado. El asistente debe
 * entender la intención sin corregir ni juzgar cómo se escribió.
 *
 * Dos piezas deterministas (no dependen del LLM):
 *   1. normalizarIdsCredito(): "cv 2026 43" → "CV-2026-0043".
 *   2. GLOSARIO: expresiones coloquiales → concepto del sistema, que se
 *      inyecta en el prompt para que el modelo elija bien la herramienta.
 */

/** Prefijo y año de todos los créditos de la cartera canónica. */
const ANIO_CARTERA = '2026';

/**
 * Normaliza identificadores de crédito escritos de forma libre:
 * "CV 2026 43", "cv-2026-43", "cv2026-0043", "CV-2026 0043" → "CV-2026-0043".
 * No toca números sueltos ("el 43"): esos los interpreta el modelo y debe
 * decir en la respuesta qué crédito asumió.
 */
export function normalizarIdsCredito(texto: string): string {
  return texto.replace(/\bcv\s*-?\s*(20\d{2})\s*-?\s*(\d{1,4})\b/gi, (_m, anio: string, num: string) => {
    return `CV-${anio}-${num.padStart(4, '0')}`;
  });
}

/** Expresión coloquial → a qué se refiere en el sistema. */
export const GLOSARIO: readonly [string, string][] = [
  ['pisto, plata, dinero, lo que hay', 'montos en quetzales (cartera o recuperaciones, según el contexto)'],
  ['lo prestado, lo que está en la calle, lo que nos deben, la cartera', 'cartera activa (consultar_cartera)'],
  ['los atrasados, los que no pagan, los que deben, los morosos, los quedados', 'créditos en mora (listar_morosos)'],
  ['los que ya no van a pagar, lo perdido, lo que se dio de baja, castigado', 'incobrable (consultar_cartera: incobrablesDelMes)'],
  ['lo que está en peligro, lo riesgoso, más de un mes atrasado', 'cartera en riesgo (consultar_cartera)'],
  ['multa, recargo, castigo, el extra por atrasarse, lo de la mora', 'interés moratorio (explicar_mora)'],
  ['abono, abonar, pagar, cobrarle, recibirle el pago, darle su pago', 'pago de cuota (proponer_pago; nunca se registra sin aprobación)'],
  ['cuánto debe, cuánto le toca pagar, cuánto tiene que dar', 'deuda exigible de la cuota vencida (calcular_deuda)'],
  ['cómo va, cómo está, qué tal está, el estado', 'estado del crédito (consultar_credito) o de la cartera'],
  ['lo que entró, lo que se cobró, lo que se recogió, lo recuperado', 'recuperaciones del cierre (consultar_cierre)'],
  ['lo que se dio, lo que se prestó, lo que salió, desembolsado', 'desembolsos del cierre (consultar_cierre)'],
  ['el cierre, el corte, cómo se cerró, el resumen del día/del mes', 'cierre diario o mensual (consultar_cierre)'],
  ['lo que viene, lo que se vence, lo que toca cobrar, los que tienen que pagar pronto', 'próximos vencimientos (ver_vencimientos)'],
  ['la semana que viene, en estos días, esta semana', 'ventana de 7 días desde el corte'],
  ['este mes, el mes que se cerró', `el mes de la fecha de corte`],
  ['hoy, ahorita, a la fecha, ya', 'la fecha de corte (nunca la del reloj)'],
  ['Mora 1 / primera mora', 'MORA_1 (1 a 30 días)'],
  ['Mora 2 / segunda mora', 'MORA_2 (31 a 60 días)'],
  ['Mora 3 / tercera mora', 'MORA_3 (61 a 90 días)'],
  ['vencido, muy atrasado', 'VENCIDO (91 a 120 días)'],
  ['la regla, la norma, lo que dice el papel, cómo se cobra', 'políticas de la empresa (buscar_politicas, con cita)'],
  [`"el 43", "el crédito 35", "el número 30"`, `crédito CV-${ANIO_CARTERA}-00NN (dígalo en la respuesta: "asumí el crédito CV-${ANIO_CARTERA}-0043")`],
];

export function seccionLenguaje(): string {
  const glosario = GLOSARIO.map(([dice, significa]) => `• "${dice}" → ${significa}`).join('\n');
  return `CÓMO ESCRIBEN LOS USUARIOS:
- Muchas personas de la empresa hablan un idioma maya como primera lengua. Pueden escribir sin tildes, con faltas, con frases cortas, sin artículos, con el género o el orden de las palabras cambiado, o mezclando palabras. Entiende la intención; nunca corrijas ni comentes cómo escriben.
- Si la pregunta se puede entender, responde directamente. Si de verdad es ambigua (por ejemplo, no se sabe de qué crédito habla), haz UNA sola pregunta corta y sencilla, con opciones ("¿Habla del crédito CV-2026-0043?").
- Si asumes algo (un número de crédito, la fecha de corte, si es cierre diario o mensual), dilo en una línea al inicio: "Tomé la fecha 31 de octubre de 2026."

CÓMO RESPONDER:
- Palabras sencillas y frases cortas. Primero la respuesta, después el detalle.
- Si usas un término técnico (mora, cartera en riesgo, prelación), explícalo en pocas palabras la primera vez.
- Las cifras van exactas, tal como las da la herramienta, aunque el resto sea sencillo.

PALABRAS QUE PUEDEN USAR:
${glosario}`;
}
