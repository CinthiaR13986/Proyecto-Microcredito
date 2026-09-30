/**
 * cargar-cli.ts — `npm run cargar`.
 * La ruta del paquete llega por CV_DATA_DIR, nunca incrustada (5.3).
 */
import { crearConexion } from './conexion';
import { cargarPaquete } from './cargador';

const dataDir = process.env.CV_DATA_DIR;
if (!dataDir) {
  console.error('Defina la variable de entorno CV_DATA_DIR con la ruta del paquete de datos.');
  process.exit(1);
}

const db = await crearConexion('.pgdata');
const r = await cargarPaquete(db, dataDir);

console.log(`✔ SHA-256 verificado: ${r.sha256}`);
if (r.yaEstabaCargado) {
  console.log(`✔ Carga ya presente (idempotencia): ${r.clientes} clientes, ${r.creditos} créditos, ${r.pagos} pagos.`);
} else {
  console.log(
    `✔ Carga canónica completa: ${r.clientes} clientes, ${r.creditos} créditos, ` +
      `${r.pagos} pagos en bitácora (${r.pagosAplicados} aplicados; ` +
      `${r.pagos - r.pagosAplicados} reintentos ignorados por idempotencia).`,
  );
}