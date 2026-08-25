/**
 * consola.ts — Adaptador primario de demostración (consola).
 *
 * NO es parte del núcleo: src/dominio/ permanece puro, sin console.log.
 * Este adaptador invoca el mismo dominio que usarán la API REST, el chat
 * y el servidor MCP en el Proyecto Final.
 *
 * Ejecución:  npm run demo           (simula 45 días de atraso)
 *             npm run demo -- 60     (simula 60 días de atraso)
 *
 * No lee la fecha del sistema: la fecha de corte es fija (puerto Reloj).
 */
import { Dinero } from '../dominio/dinero';
import { MetodoFrances, PlanAmortizacion } from '../dominio/plan-amortizacion';
import { calcularInteresMoratorio, clasificarTramo, POLITICA_REFERENCIA } from '../dominio/calculadora-mora';
import { aplicarPago } from '../dominio/prelacion-pago';
import { Credito } from '../dominio/estado-credito';
import { calcularCarteraEnRiesgo, type CreditoCartera } from '../dominio/cartera';

const FECHA_CORTE = '2026-08-19'; // inyectada (puerto Reloj), nunca Date.now()
const USUARIO = 'demo';
const q = (d: Dinero) => d.aNumero().toFixed(2);
const titulo = (t: string) => console.log(`\n=== ${t} ===`);

// ── 1. Plan de amortización (6.4.1) ────────────────────────────
titulo('PLAN DE AMORTIZACION · Q10,000.00 · TNA 36% · 12 cuotas');
const plan = PlanAmortizacion.generar({
  capital: Dinero.de(10000),
  tasaMensual: 0.03,
  numeroCuotas: 12,
  metodo: MetodoFrances,
});
console.log(' N | saldoIni |   cuota | interes | amortiza | saldoFin');
for (const c of plan.cuotas) {
  console.log(
    `${String(c.numero).padStart(2)} | ${q(c.saldoInicial).padStart(8)} | ` +
      `${q(c.cuota).padStart(7)} | ${q(c.interes).padStart(7)} | ` +
      `${q(c.amortizacion).padStart(8)} | ${q(c.saldoFinal).padStart(8)}`,
  );
}

// ── 2. Interés moratorio de la cuota 2 (6.5) ───────────────────
titulo('MORA · cuota 2 vencida hace 15 días · TNA moratoria 24% A/360');
const cuota2 = plan.cuotas[1]!;
const moratorio = calcularInteresMoratorio(cuota2.amortizacion, 15, POLITICA_REFERENCIA);
console.log(`Capital en mora: ${q(cuota2.amortizacion)}  ->  interes moratorio: ${q(moratorio)}`);

// ── 3. Prelación con pago exacto (6.6) ─────────────────────────
titulo('PRELACION · pago exacto Q1,011.88');
const resultado = aplicarPago(Dinero.de(1011.88), {
  gastos: Dinero.cero(),
  interesMoratorio: moratorio,
  interesCorriente: cuota2.interes,
  capital: cuota2.amortizacion,
});
console.log(
  `gastos ${q(resultado.aplicados.gastos)} -> moratorio ${q(resultado.aplicados.interesMoratorio)} ` +
    `-> corriente ${q(resultado.aplicados.interesCorriente)} -> capital ${q(resultado.aplicados.capital)}`,
);
console.log(`Cuota saldada: ${resultado.cuotaSaldada ? 'SI' : 'NO'} · excedente: ${q(resultado.excedente)}`);

// ── 4. Ciclo de vida con reversibilidad (6.7) ──────────────────
const dias = Number(process.argv[2] ?? 45);
titulo(`CICLO DE VIDA · atraso simulado: ${dias} dias (tramo ${clasificarTramo(dias)})`);
let credito = Credito.solicitar('CR-DEMO', FECHA_CORTE, USUARIO)
  .aplicar({ tipo: 'APROBAR' }, FECHA_CORTE, USUARIO)
  .aplicar({ tipo: 'DESEMBOLSAR' }, FECHA_CORTE, USUARIO)
  .aplicar({ tipo: 'ATRASO', dias }, FECHA_CORTE, USUARIO);
console.log(`Tras el atraso    -> estado: ${credito.estadoActual}, tramo: ${credito.tramo}`);
credito = credito.aplicar({ tipo: 'PAGO', nuevosDiasAtraso: 10 }, FECHA_CORTE, USUARIO);
console.log(`Paga y baja a 10  -> estado: ${credito.estadoActual}, tramo: ${credito.tramo}`);
credito = credito.aplicar({ tipo: 'PAGO', nuevosDiasAtraso: 0 }, FECHA_CORTE, USUARIO);
console.log(`Paga todo         -> estado: ${credito.estadoActual}, tramo: ${credito.tramo}`);

// ── 5. Transición inválida rechazada por diseño ────────────────
titulo('TRANSICION INVALIDA · pagar un credito solicitado');
try {
  Credito.solicitar('CR-RECHAZA', FECHA_CORTE, USUARIO).aplicar(
    { tipo: 'PAGO', nuevosDiasAtraso: 0 },
    FECHA_CORTE,
    USUARIO,
  );
} catch (e) {
  console.log(`Rechazada por diseño: ${(e as Error).message}`);
}

// ── 6. Cartera en riesgo (6.8.1) ───────────────────────────────
titulo('CARTERA EN RIESGO · caso 6.8.1');
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
console.log(
  `Cartera activa: ${q(riesgo.carteraActiva)} · en riesgo: ${q(riesgo.montoEnRiesgo)} · indicador: ${riesgo.porcentaje.toFixed(2)}%`,
);
console.log(`Incobrables (se reportan junto): ${q(riesgo.totalIncobrables)}`);