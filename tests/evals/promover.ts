/**
 * promover.ts — E6 · Revisión humana de los ejemplos que guían al asistente.
 *
 *   npm run evals:promover
 *       Lista los candidatos (turnos que pasaron todas las repeticiones).
 *
 *   npm run evals:promover -- G-1.3#1 OP-7.2#1 --revisor "Nombre Apellido"
 *       Promueve esos candidatos a src/agente/ejemplos.json.
 *
 *   npm run evals:promover -- --quitar G-1.3#1
 *       Retira un ejemplo ya promovido.
 *
 * Al promover: las cifras se cambian por ⟨cifra⟩, y se rechaza cualquier
 * ejemplo con datos personales o con rastros de la instrucción incrustada.
 * Después de promover, vuelva a correr `npm run evals` para confirmar que los
 * ejemplos nuevos no empeoraron otros casos (y reinicie `npm run api`).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAX_EJEMPLOS,
  RUTA_EJEMPLOS,
  anonimizarCifras,
  cargarEjemplos,
  problemasDeEjemplo,
  type EjemploCurado,
} from '../../src/agente/ejemplos';

interface Candidato {
  id: string;
  categoria: string;
  estilo: string;
  pregunta: string;
  herramientas: { nombre: string; argumentos: Record<string, unknown> }[];
  respuesta: string;
}

const RUTA_CANDIDATOS = join(dirname(fileURLToPath(import.meta.url)), 'candidatos.json');

function principal(): void {
  const args = process.argv.slice(2);
  const iRev = args.indexOf('--revisor');
  const revisor = iRev >= 0 ? args[iRev + 1] : undefined;
  const iQuitar = args.indexOf('--quitar');
  const ejemplos = cargarEjemplos();

  if (iQuitar >= 0) {
    const ids = args.slice(iQuitar + 1).filter((a) => !a.startsWith('--'));
    const quedan = ejemplos.filter((e) => !ids.includes(e.id));
    writeFileSync(RUTA_EJEMPLOS, JSON.stringify(quedan, null, 2) + '\n');
    console.log(`Retirados ${ejemplos.length - quedan.length} ejemplo(s). Quedan ${quedan.length}.`);
    return;
  }

  if (!existsSync(RUTA_CANDIDATOS)) {
    console.error('No hay candidatos. Corra primero: npm run evals');
    process.exit(1);
  }
  const candidatos = JSON.parse(readFileSync(RUTA_CANDIDATOS, 'utf8')) as Candidato[];
  const ids = args.filter((a, i) => !a.startsWith('--') && !(iRev >= 0 && i === iRev + 1));

  if (ids.length === 0) {
    console.log(`${candidatos.length} candidatos (ya promovidos: ${ejemplos.length}/${MAX_EJEMPLOS}):\n`);
    for (const c of candidatos) {
      const ya = ejemplos.some((e) => e.id === c.id) ? ' [ya promovido]' : '';
      console.log(`■ ${c.id}  (${c.categoria} · ${c.estilo})${ya}`);
      console.log(`  Pregunta:     ${c.pregunta}`);
      console.log(`  Herramientas: ${c.herramientas.map((h) => `${h.nombre}(${JSON.stringify(h.argumentos)})`).join(' → ') || '(ninguna)'}`);
      console.log(`  Respuesta:    ${anonimizarCifras(c.respuesta).replace(/\n/g, '\n                ')}\n`);
    }
    console.log('Para promover: npm run evals:promover -- <id> <id> --revisor "Nombre Apellido"');
    return;
  }

  if (!revisor) {
    console.error('Indique quién revisó los ejemplos: --revisor "Nombre Apellido"');
    process.exit(1);
  }

  const nuevos: EjemploCurado[] = [];
  for (const id of ids) {
    const c = candidatos.find((x) => x.id === id);
    if (!c) {
      console.error(`✘ ${id}: no está entre los candidatos`);
      continue;
    }
    if (ejemplos.some((e) => e.id === id || e.pregunta === c.pregunta)) {
      console.error(`✘ ${id}: ya existe un ejemplo con esa pregunta`);
      continue;
    }
    const ejemplo: EjemploCurado = {
      id: c.id,
      pregunta: c.pregunta,
      herramientas: c.herramientas,
      respuesta: anonimizarCifras(c.respuesta),
      revisor,
      fecha: new Date().toISOString().slice(0, 10),
    };
    const p = problemasDeEjemplo(ejemplo);
    if (p.length) {
      console.error(`✘ ${id}: rechazado — ${p.join('; ')}`);
      continue;
    }
    nuevos.push(ejemplo);
    console.log(`✔ ${id} promovido`);
  }

  const todos = [...ejemplos, ...nuevos];
  writeFileSync(RUTA_EJEMPLOS, JSON.stringify(todos, null, 2) + '\n');
  console.log(`\n${todos.length} ejemplos en src/agente/ejemplos.json.`);
  if (todos.length > MAX_EJEMPLOS) {
    console.log(`⚠ Hay más de ${MAX_EJEMPLOS}: el prompt solo usa los ${MAX_EJEMPLOS} más recientes. Considere retirar algunos con --quitar.`);
  }
  console.log('Siguiente paso: npm run evals (confirmar que no empeoró nada) y reiniciar npm run api.');
}

principal();
