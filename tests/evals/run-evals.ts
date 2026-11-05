/**
 * run-evals.ts — E6 · Corre el banco de evals contra el asistente real.
 *
 *   npm run evals                          todo el banco, 1 vez
 *   npm run evals -- --repeticiones 3      cada caso 3 veces (mide estabilidad)
 *   npm run evals -- --solo G-1,OP-7       solo casos cuyo id empieza así
 *   npm run evals -- --umbral 0.95         sale con error si la tasa baja de 95 %
 *
 * Requiere la API de datos cargada (npm run cargar), el corpus ingerido
 * (npm run rag:ingerir) y OPENROUTER_API_KEY. No registra pagos: las
 * propuestas se quedan pendientes y nunca se aprueban.
 *
 * Salidas:
 *   tests/evals/resultados/<fecha>.json   detalle de cada corrida
 *   tests/evals/candidatos.json           turnos que pasaron en TODAS las
 *                                         repeticiones → para revisión humana
 */
import '../../src/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { conversar, reiniciarSesion } from '../../src/agente/agente';
import { llamarMcp } from '../../src/agente/mcp-cliente';
import { MODELO_CHAT } from '../../src/agente/openrouter';
import { CASOS, CORTE, type Caso, type Oraculo } from './casos';
import { evaluarTurno, type RespuestaEval } from './evaluar';

const DIR = dirname(fileURLToPath(import.meta.url));

function opcion(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const REPETICIONES = Number(opcion('repeticiones') ?? 1);
const UMBRAL = Number(opcion('umbral') ?? 0.9);
const PARALELO = Number(opcion('paralelo') ?? 3);
const SOLO = opcion('solo')?.split(',').map((s) => s.trim()).filter(Boolean);

const oraculo: Oraculo = async (herramienta, args) => {
  const r = await llamarMcp(herramienta, args);
  if (!r.ok) throw new Error(`${herramienta}: ${JSON.stringify(r.datos)}`);
  return r.datos;
};

interface ResultadoTurno {
  pregunta: string;
  estilo: string;
  respuesta: string;
  herramientas: RespuestaEval['herramientas'];
  fallas: string[];
}

interface ResultadoCaso {
  id: string;
  categoria: string;
  repeticion: number;
  ok: boolean;
  turnos: ResultadoTurno[];
  error?: string;
}

async function correrCaso(caso: Caso, repeticion: number): Promise<ResultadoCaso> {
  const sesion = `eval-${caso.id}-${repeticion}-${randomUUID()}`;
  const turnos: ResultadoTurno[] = [];
  try {
    for (const t of caso.turnos) {
      const r = await conversar(sesion, t.pregunta);
      const fallas = await evaluarTurno(t, r, oraculo, caso.corte ?? CORTE);
      turnos.push({ pregunta: t.pregunta, estilo: t.estilo, respuesta: r.texto, herramientas: r.herramientas, fallas });
    }
    return { id: caso.id, categoria: caso.categoria, repeticion, ok: turnos.every((t) => t.fallas.length === 0), turnos };
  } catch (e) {
    return { id: caso.id, categoria: caso.categoria, repeticion, ok: false, turnos, error: e instanceof Error ? e.message : String(e) };
  } finally {
    reiniciarSesion(sesion);
  }
}

async function enParalelo<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let siguiente = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, n) }, async () => {
      while (siguiente < items.length) {
        const i = siguiente++;
        out[i] = await fn(items[i]!);
        process.stdout.write('.');
      }
    }),
  );
  process.stdout.write('\n');
  return out;
}

const casos = SOLO ? CASOS.filter((c) => SOLO.some((p) => c.id.startsWith(p))) : CASOS;
const trabajos = casos.flatMap((c) => Array.from({ length: REPETICIONES }, (_, r) => ({ c, r: r + 1 })));

console.log(`Evals · modelo ${MODELO_CHAT || '(sin OPENROUTER_MODEL)'} · ${casos.length} casos × ${REPETICIONES} = ${trabajos.length} corridas`);
const resultados = await enParalelo(trabajos, PARALELO, ({ c, r }) => correrCaso(c, r));

// ── Resumen por categoría y por estilo de escritura ────────────────
const porCategoria = new Map<string, { ok: number; total: number }>();
const porEstilo = new Map<string, { ok: number; total: number }>();
for (const r of resultados) {
  const c = porCategoria.get(r.categoria) ?? { ok: 0, total: 0 };
  c.total++;
  if (r.ok) c.ok++;
  porCategoria.set(r.categoria, c);
  for (const t of r.turnos) {
    const e = porEstilo.get(t.estilo) ?? { ok: 0, total: 0 };
    e.total++;
    if (t.fallas.length === 0) e.ok++;
    porEstilo.set(t.estilo, e);
  }
}
const pct = (x: { ok: number; total: number }) => `${((100 * x.ok) / x.total).toFixed(0)} %`;

console.log('\nPor categoría');
for (const [k, v] of porCategoria) console.log(`  ${v.ok === v.total ? '✔' : '✘'} ${k.padEnd(20)} ${v.ok}/${v.total}  ${pct(v)}`);
console.log('\nPor forma de escribir');
for (const [k, v] of porEstilo) console.log(`  ${k.padEnd(10)} ${v.ok}/${v.total}  ${pct(v)}`);

const fallidos = resultados.filter((r) => !r.ok);
if (fallidos.length) {
  console.log('\nFallas');
  for (const f of fallidos) {
    console.log(`  ✘ ${f.id} (rep ${f.repeticion})${f.error ? ` — error: ${f.error}` : ''}`);
    for (const t of f.turnos) for (const m of t.fallas) console.log(`      «${t.pregunta}» → ${m}`);
  }
}

const aprobados = resultados.filter((r) => r.ok).length;
const tasa = aprobados / resultados.length;
console.log(`\nTotal: ${aprobados}/${resultados.length} (${(tasa * 100).toFixed(1)} %) · umbral ${(UMBRAL * 100).toFixed(0)} %`);

// ── Archivos ───────────────────────────────────────────────────────
mkdirSync(join(DIR, 'resultados'), { recursive: true });
const sello = new Date().toISOString().replace(/[:.]/g, '-');
writeFileSync(
  join(DIR, 'resultados', `${sello}.json`),
  JSON.stringify({ modelo: MODELO_CHAT, repeticiones: REPETICIONES, tasa, resultados }, null, 2),
);

// Candidatos: solo turnos que pasaron en TODAS las repeticiones de su caso.
const estables = casos.filter((c) => resultados.filter((r) => r.id === c.id).every((r) => r.ok));
const candidatos = estables.flatMap((c) => {
  const r = resultados.find((x) => x.id === c.id)!;
  return r.turnos.map((t, i) => ({
    id: `${c.id}#${i + 1}`,
    categoria: c.categoria,
    estilo: t.estilo,
    pregunta: t.pregunta,
    herramientas: t.herramientas.map((h) => ({ nombre: h.nombre, argumentos: h.argumentos })),
    respuesta: t.respuesta,
  }));
});
writeFileSync(join(DIR, 'candidatos.json'), JSON.stringify(candidatos, null, 2));
console.log(`\n${candidatos.length} candidatos a ejemplo en tests/evals/candidatos.json (revíselos con npm run evals:promover)`);

process.exit(tasa >= UMBRAL ? 0 : 1);
