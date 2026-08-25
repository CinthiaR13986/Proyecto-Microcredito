/**
 * reporte.ts — Genera la evidencia del E4 en consola Y en archivo.
 *
 * Imprime el reporte completo y lo escribe en docs/reportes/reporte-e4.md.
 * No es parte del núcleo: src/dominio/ permanece puro.
 * Fecha de corte FIJA (puerto Reloj): nunca lee la fecha del sistema.
 *
 * Ejecución: npm run reporte
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { Dinero } from '../dominio/dinero';
import { MetodoFrances, PlanAmortizacion } from '../dominio/plan-amortizacion';
import { calcularInteresMoratorio, POLITICA_REFERENCIA } from '../dominio/calculadora-mora';
import { aplicarPago } from '../dominio/prelacion-pago';
import { Credito } from '../dominio/estado-credito';
import { calcularCarteraEnRiesgo, type CreditoCartera } from '../dominio/cartera';

const FECHA_CORTE = '2026-08-19';
const USUARIO = 'reporte';
const q = (d: Dinero) => d.aNumero().toFixed(2);

const lineas: string[] = [];
const out = (s = ''): void => {
  lineas.push(s);
};

out('# Reporte E4 — Evidencia del núcleo de cálculo');
out('');
out(`Fecha de corte fija (puerto Reloj): ${FECHA_CORTE} · Generado por: src/demo/reporte.ts`);
out('');

// ── 1. Tabla de amortización (6.4.1) ─────────────────────────
out('## 1) Tabla de amortización — caso 6.4.1');
out('P = Q10,000.00 · TNA nominal 36% (i = 3% mensual) · 12 cuotas');
out('');
out('| N | Saldo inicial | Cuota | Interés | Amortización | Saldo final |');
out('| --: | --: | --: | --: | --: | --: |');
const plan = PlanAmortizacion.generar({
  capital: Dinero.de(10000),
  tasaMensual: 0.03,
  numeroCuotas: 12,
  metodo: MetodoFrances,
});
for (const c of plan.cuotas) {
  out(`| ${c.numero} | ${q(c.saldoInicial)} | ${q(c.cuota)} | ${q(c.interes)} | ${q(c.amortizacion)} | ${q(c.saldoFinal)} |`);
}
out(`| **Total** | | **${q(plan.totalPagado)}** | **${q(plan.totalInteres)}** | **${q(plan.totalAmortizacion)}** | |`);
out('');
out(`Invariantes (6.10): Σ amortizaciones = ${q(plan.totalAmortizacion)} (esperado 10000.00) · saldo final = ${q(plan.saldoFinal)} (esperado 0.00)`);
out('');

// ── 2. Interés moratorio (6.5) ───────────────────────────────
out('## 2) Interés moratorio — ejemplo 6.5');
const capitalEnMora = plan.cuotas[1]!.amortizacion;
const moratorio = calcularInteresMoratorio(capitalEnMora, 15, POLITICA_REFERENCIA);
out(`Capital en mora (cuota 2): ${q(capitalEnMora)} · TNA moratoria 24% · base A/360 · 15 días`);
out(`Interés moratorio: ${q(moratorio)} (esperado 7.26)`);
out('');

// ── 3. Prelación (6.6) ───────────────────────────────────────
out('## 3) Aplicación de pagos — prelación (6.6)');
const deuda = {
  gastos: Dinero.cero(),
  interesMoratorio: moratorio,
  interesCorriente: plan.cuotas[1]!.interes,
  capital: capitalEnMora,
};
const escenarios: Array<[string, number]> = [
  ['A exacto', 1011.88],
  ['B parcial', 500],
  ['C de más', 3000],
];
for (const [nombre, monto] of escenarios) {
  const r = aplicarPago(Dinero.de(monto), deuda);
  out('');
  out(`Escenario ${nombre} — pago ${monto.toFixed(2)}:`);
  out(`  gastos ${q(r.aplicados.gastos)} · moratorio ${q(r.aplicados.interesMoratorio)} · corriente ${q(r.aplicados.interesCorriente)} · capital ${q(r.aplicados.capital)}`);
  out(`  cuota saldada: ${r.cuotaSaldada ? 'SÍ' : 'NO'} · capital pendiente: ${q(r.capitalPendiente)} · excedente: ${q(r.excedente)} (${r.destinoExcedente})`);
}
out('');

// ── 4. Ciclo de vida (6.7) ───────────────────────────────────
out('## 4) Ciclo de vida — reversibilidad y transición inválida (6.7)');
let credito = Credito.solicitar('CR-REPORTE', FECHA_CORTE, USUARIO)
  .aplicar({ tipo: 'APROBAR' }, FECHA_CORTE, USUARIO)
  .aplicar({ tipo: 'DESEMBOLSAR' }, FECHA_CORTE, USUARIO)
  .aplicar({ tipo: 'ATRASO', dias: 45 }, FECHA_CORTE, USUARIO);
out(`Atraso 45 días        → estado: ${credito.estadoActual} · tramo: ${credito.tramo} (esperado MORA_2)`);
credito = credito.aplicar({ tipo: 'PAGO', nuevosDiasAtraso: 10 }, FECHA_CORTE, USUARIO);
out(`Paga y baja a 10 días → estado: ${credito.estadoActual} · tramo: ${credito.tramo} (esperado MORA_1)`);
credito = credito.aplicar({ tipo: 'PAGO', nuevosDiasAtraso: 0 }, FECHA_CORTE, USUARIO);
out(`Paga todo lo vencido  → estado: ${credito.estadoActual} · tramo: ${credito.tramo} (esperado AL_DIA)`);
try {
  Credito.solicitar('CR-INVALIDO', FECHA_CORTE, USUARIO).aplicar(
    { tipo: 'PAGO', nuevosDiasAtraso: 0 },
    FECHA_CORTE,
    USUARIO,
  );
  out('Transición inválida: NO fue rechazada (¡error!)');
} catch (e) {
  out(`Transición inválida rechazada por diseño: ${(e as Error).message}`);
}
out('');

// ── 5. Cartera en riesgo (6.8.1) ─────────────────────────────
out('## 5) Cartera en riesgo — caso 6.8.1');
const cartera: CreditoCartera[] = [
  { id: 'C-001', saldoCapital: Dinero.de(620000), diasDeAtraso: 0, reestructurado: false, incobrable: false },
  { id: 'C-002', saldoCapital: Dinero.de(124000), diasDeAtraso: 8, reestructurado: false, incobrable: false },
  { id: 'C-003', saldoCapital: Dinero.de(24000), diasDeAtraso: 45, reestructurado: false, incobrable: false },
  { id: 'C-004', saldoCapital: Dinero.de(18000), diasDeAtraso: 75, reestructurado: false, incobrable: false },
  { id: 'C-005', saldoCapital: Dinero.de(8000), diasDeAtraso: 100, reestructurado: false, incobrable: false },
  { id: 'C-006', saldoCapital: Dinero.de(6000), diasDeAtraso: 0, reestructurado: true, incobrable: false },
  { id: 'C-007', saldoCapital: Dinero.de(15000), diasDeAtraso: 210, reestructurado: false, incobrable: true },
];
const riesgo = calcularCarteraEnRiesgo(cartera);
out(`Cartera activa: ${q(riesgo.carteraActiva)} · en riesgo: ${q(riesgo.montoEnRiesgo)} · indicador: ${riesgo.porcentaje.toFixed(2)}% (esperado 7.00%)`);
const conIncobrable = cartera.map((c) => (c.id === 'C-005' ? { ...c, incobrable: true } : c));
const riesgo2 = calcularCarteraEnRiesgo(conIncobrable);
out(`Si C-005 se da por incobrable: indicador ${riesgo2.porcentaje.toFixed(2)}% (esperado 6.06%) · incobrables: ${q(riesgo2.totalIncobrables)}`);
out('El porcentaje nunca se reporta solo: se acompaña de lo dado por incobrable.');
out('');

// ── Imprimir en consola y escribir el archivo ────────────────
const contenido = lineas.join('\n');
console.log(contenido);

const ruta = join(process.cwd(), 'docs', 'reportes', 'reporte-e4.md');
mkdirSync(dirname(ruta), { recursive: true });
writeFileSync(ruta, `${contenido}\n`, 'utf8');
console.log('\n✔ Reporte escrito en: docs/reportes/reporte-e4.md');