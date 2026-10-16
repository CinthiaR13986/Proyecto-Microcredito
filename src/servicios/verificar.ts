/**
 * verificar.ts — Imprime el estado de créditos clave al 31-oct-2026 para
 * revisarlo contra el guion del video (OP-1, OP-5, OP-6, G-5) ANTES de
 * construir la API. Ejecución: npm run verificar
 */
import { crearConexion } from '../persistencia/conexion';
import {
  listarCreditos,
  listarPagosAplicados,
  nombresClientes,
  reglasDeGasto,
} from '../persistencia/consultas';
import { reconstruirCredito, aCentavos } from './reconstructor';

const CORTE = '2026-10-31';
const q = (d: { aNumero(): number }): string => d.aNumero().toFixed(2);

const db = await crearConexion('.pgdata');
const creditos = await listarCreditos(db);
const pagos = await listarPagosAplicados(db);
const nombres = await nombresClientes(db);
const reglas = await reglasDeGasto(db);

for (const id of ['CV-2026-0043', 'CV-2026-0061', 'CV-2026-0015', 'CV-2026-0030', 'CV-2026-0410']) {
  const fila = creditos.find((c) => c.id_credito === id)!;
  const d = reconstruirCredito(
    fila,
    nombres[fila.id_cliente] ?? '?',
    pagos.filter((p) => p.id_credito === id),
    CORTE,
    reglas,
  );
  console.log(`\n=== ${id} · ${d.nombreCliente} · política ${d.politica} ===`);
  console.log(`estado: ${d.estado} · días: ${d.diasAtraso} · tramo: ${d.tramo} · saldo capital: ${q(d.saldoCapital)}`);
  if (d.deuda) {
    console.log(
      `deuda cuota ${d.deuda.cuotaNumero}: gastos ${q(d.deuda.gastos)} · moratorio ${q(d.deuda.interesMoratorio)} · ` +
        `corriente ${q(d.deuda.interesCorriente)} · capital ${q(d.deuda.capital)} → TOTAL ${q(d.deuda.total)} (${aCentavos(d.deuda.total)} centavos)`,
    );
    for (const l of d.lineasMora) {
      console.log(`   ${l.tramo} · ${l.diasEnTramo} días · TNA ${l.tasaTna} · ${l.montoSinRedondear.toFixed(4)}`);
    }

    for (const a of d.aplicaciones) {
    if (a.aplicados.interesMoratorio.aNumero() > 0) {
      console.log(`   pago ${a.clave} (${a.fecha}): moratorio aplicado ${q(a.aplicados.interesMoratorio)}`);
    }
  }
  }
  if (d.proximaCuota) console.log(`próxima cuota: ${d.proximaCuota.numero} vence ${d.proximaCuota.vencimiento} · ${q(d.proximaCuota.monto)}`);
  if (!d.interesEnSuspenso.esCero()) console.log(`interés en suspenso: ${q(d.interesEnSuspenso)}`);
}