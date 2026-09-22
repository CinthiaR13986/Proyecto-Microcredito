/**
 * mora-escalonada.ts — Demo en consola de la mora escalonada (E6, Proyecto 2).
 * Ejecución: npm run demo:mora
 */
import { Dinero } from '../dominio/dinero';
import {
  POLITICA_ESCALONADA,
  tramosRecorridos,
} from '../dominio/politica-mora/politica-escalonada';
import { POLITICA_PLANA } from '../dominio/politica-mora/politica-plana';
import { POLITICA_RETROACTIVA } from '../dominio/politica-mora/politica-retroactiva';
import { resolverPoliticaMora } from '../dominio/politica-mora/catalogo-politicas';
import { evaluarGastoGestion } from '../dominio/gasto-gestion-cobro';
import { calcularCarteraEnRiesgo, type CreditoCartera } from '../dominio/cartera';

const q = (d: Dinero): string => d.aNumero().toFixed(2);
const CAPITAL = Dinero.de(725.76); // capital en mora de la cuota 2 (caso de referencia P1)
const CORRIENTE = Dinero.de(278.86); // interés corriente de la cuota 2
const titulo = (t: string): void => console.log(`\n=== ${t} ===`);

titulo('MORA ESCALONADA · desglose por tramos recorridos (7.3)');
for (const dias of [15, 45, 100, 120]) {
  console.log(`\n${dias} días de atraso:`);
  for (const l of tramosRecorridos(CAPITAL, dias)) {
    console.log(
      `  ${l.tramo.padEnd(8)} TNA ${(Number(l.tasaTna) * 100).toFixed(0)}% · ` +
        `${String(l.diasEnTramo).padStart(3)} días · sin redondear ${l.montoSinRedondear.toFixed(4)}`,
    );
  }
  console.log(`  → moratorio total (redondeo único): ${q(POLITICA_ESCALONADA.interesMoratorio(CAPITAL, dias))}`);
}

titulo('M-5 · total adeudado cuota 2 a 45 días (con gasto Q25.00)');
const gasto = evaluarGastoGestion({ diasDeAtraso: 45, gastoYaGenerado: false }).monto;
const mora45 = POLITICA_ESCALONADA.interesMoratorio(CAPITAL, 45);
console.log(`  1 gastos de gestión : ${q(gasto)}`);
console.log(`  2 interés moratorio : ${q(mora45)}`);
console.log(`  3 interés corriente : ${q(CORRIENTE)}`);
console.log(`  4 capital           : ${q(CAPITAL)}`);
console.log(`  TOTAL ADEUDADO      : ${q(gasto.sumar(mora45).sumar(CORRIENTE).sumar(CAPITAL))}`);

titulo('CP-03 · coexistencia de políticas (misma cuota, 45 días)');
console.log(`  CV-2026-0100 (otorgado 15-ago-2026) → ${resolverPoliticaMora('2026-08-15').codigo}: ${q(POLITICA_PLANA.interesMoratorio(CAPITAL, 45))}`);
console.log(`  CV-2026-0410 (otorgado 10-oct-2026) → ${resolverPoliticaMora('2026-10-10').codigo}: ${q(POLITICA_ESCALONADA.interesMoratorio(CAPITAL, 45))}`);
console.log(`  Contraste NO adoptado (retroactiva 36%, 100 días): ${q(POLITICA_RETROACTIVA.interesMoratorio(CAPITAL, 100))}`);

titulo('7.8 · cartera en riesgo desglosada por tramo');
const cartera: CreditoCartera[] = [
  { id: 'C-001', saldoCapital: Dinero.de(620000), diasDeAtraso: 0, reestructurado: false, incobrable: false },
  { id: 'C-002', saldoCapital: Dinero.de(124000), diasDeAtraso: 8, reestructurado: false, incobrable: false },
  { id: 'C-003', saldoCapital: Dinero.de(24000), diasDeAtraso: 45, reestructurado: false, incobrable: false },
  { id: 'C-004', saldoCapital: Dinero.de(18000), diasDeAtraso: 75, reestructurado: false, incobrable: false },
  { id: 'C-005', saldoCapital: Dinero.de(8000), diasDeAtraso: 100, reestructurado: false, incobrable: false },
  { id: 'C-006', saldoCapital: Dinero.de(6000), diasDeAtraso: 0, reestructurado: true, incobrable: false },
  { id: 'C-007', saldoCapital: Dinero.de(15000), diasDeAtraso: 210, reestructurado: false, incobrable: true },
];
const r = calcularCarteraEnRiesgo(cartera);
for (const l of r.desglose) {
  console.log(
    `  ${l.tramo.padEnd(24)} ${String(l.creditos).padStart(2)} créditos · ${q(l.saldoCapital).padStart(10)} · ${l.porcentaje.toFixed(2)}%`,
  );
}
console.log(`  En riesgo total: ${q(r.montoEnRiesgo)} = ${r.porcentaje.toFixed(2)}% · En mora: ${q(r.carteraEnMora)} = ${r.porcentajeEnMora.toFixed(2)}%`);
console.log(`  Dado por incobrable en el período: ${q(r.totalIncobrables)}`);