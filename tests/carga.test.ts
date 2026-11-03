/**
 * tests/carga.test.ts — E2/E6 · Pruebas del cargador canónico.
 *
 * Usa una base de datos de pruebas separada (credito_vecino_test) para
 * no interferir con la carga real. Limpia las tablas antes de cada prueba
 * para garantizar aislamiento y evitar conflictos de huella SHA-256.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { crearConexion } from '../src/persistencia/conexion';
import { cargarPaquete } from '../src/persistencia/cargador';

// Forzar el uso de la base de datos de pruebas para los fixtures
process.env.TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/credito_vecino_test';

let db: Pool;

beforeAll(async () => {
  db = await crearConexion();
});

beforeEach(async () => {
  // Limpiar tablas en orden inverso de dependencias (FK)
  await db.query('DELETE FROM carga_meta');
  await db.query('DELETE FROM pagos');
  await db.query('DELETE FROM creditos');
  await db.query('DELETE FROM clientes');
  await db.query('DELETE FROM asesores');
  await db.query('DELETE FROM politicas');
});

function fixture(dir: string, shaCorrupta = false): string {
  const ruta = mkdtempSync(join(tmpdir(), `${dir}-`));
  const eventos = '{"seq":1,"tipo":"CLIENTE"}\n{"seq":2,"tipo":"DESEMBOLSO"}\n';
  writeFileSync(join(ruta, 'eventos.jsonl'), eventos);
  const sha = createHash('sha256').update(Buffer.from(eventos)).digest('hex');
  writeFileSync(join(ruta, 'eventos.sha256'), `${shaCorrupta ? '0'.repeat(64) : sha}\n`);
  
  writeFileSync(join(ruta, 'asesores.csv'), 'id_asesor,nombre_completo\nAS-01,Ana Asesora\n');
  writeFileSync(
    join(ruta, 'clientes.csv'),
    'id_cliente,nombre_completo,dpi,telefono,municipio,fecha_alta\n' +
      'CL-0001,Cliente Uno,DPI-1,5555-0001,Mixco,2026-01-05\n' +
      'CL-0002,Cliente Dos,DPI-2,5555-0002,Guate,2026-01-06\n',
  );
  writeFileSync(
    join(ruta, 'creditos.csv'),
    'id_credito,id_cliente,id_asesor,fecha,capital_centavos,plazo_meses,tna_bps,reestructurado\n' +
      'CV-2026-0001,CL-0001,AS-01,2026-01-10,1000000,12,3600,false\n' +
      'CV-2026-0410,CL-0002,AS-01,2026-10-10,1000000,12,3600,false\n',
  );
  writeFileSync(
    join(ruta, 'pagos.csv'),
    'clave_idempotencia,id_credito,fecha,monto_centavos,canal\n' +
      'IDEM-1,CV-2026-0001,2026-02-10,100462,campo\n' +
      'IDEM-1,CV-2026-0001,2026-02-10,100462,agencia\n' + // reintento: se ignora
      'IDEM-2,CV-2026-0001,2026-03-10,100462,campo\n',
  );
  writeFileSync(
    join(ruta, 'politicas.json'),
    JSON.stringify({
      politicas_mora: {
        'POL-2024-01': { vigencia_otorgamiento: { hasta: '2026-09-30' } },
        'POL-2026-10': { vigencia_otorgamiento: { desde: '2026-10-01' } },
      },
      gasto_gestion_cobro: { monto_centavos: 2500, dia_generacion: 31, aplica_a_politicas: ['POL-2026-10'] },
      regla_incobrable_dias: 120,
      regla_riesgo_dias: 30,
      base_conteo: 'Actual/360',
    }),
  );
  return ruta;
}

describe('E2 · cargador canónico (fixtures)', () => {
  it('verifica la huella y carga la bitácora íntegra; la idempotencia se aplica al efecto', async () => {
    const r = await cargarPaquete(db, fixture('cv-ok'));
    expect(r.verificado).toBe(true);
    expect(r.clientes).toBe(2);
    expect(r.creditos).toBe(2);
    expect(r.pagos).toBe(3); // bitácora íntegra (append-only)
    expect(r.pagosAplicados).toBe(2); // la clave repetida no produce efecto
  });

  it('es idempotente: segunda ejecución no duplica la cartera', async () => {
    const dir = fixture('cv-idem');
    await cargarPaquete(db, dir);
    const segunda = await cargarPaquete(db, dir);
    expect(segunda.yaEstabaCargado).toBe(true);
    const conteo = await db.query<{ n: string }>('SELECT count(*)::text AS n FROM pagos');
    expect(conteo.rows[0]!.n).toBe('3');
  });

  it('huella distinta detiene la carga con aviso', async () => {
    await expect(cargarPaquete(db, fixture('cv-mal', true))).rejects.toThrow(/SHA-256/);
  });

  it('resuelve la política por fecha de otorgamiento (CP-03)', async () => {
    await cargarPaquete(db, fixture('cv-pol'));
    const filas = await db.query<{ id_credito: string; politica_mora: string }>(
      'SELECT id_credito, politica_mora FROM creditos ORDER BY id_credito',
    );
    expect(filas.rows[0]!.politica_mora).toBe('POL-2024-01'); // otorgado 10-ene
    expect(filas.rows[1]!.politica_mora).toBe('POL-2026-10'); // otorgado 10-oct
  });
});

// Contra el paquete real cuando CV_DATA_DIR esté definido.
// Usa la base de datos normal (credito_vecino) para esta prueba específica.
describe.runIf(process.env.CV_DATA_DIR)('E2 · carga canónica real', () => {
  it('deja 60 clientes, 75 créditos y 228 pagos', async () => {
    // Para la prueba real, usamos la conexión normal (sin TEST_DATABASE_URL)
    delete process.env.TEST_DATABASE_URL;
    const dbReal = await crearConexion();
    
    // Limpiar la base real antes de cargar (opcional, pero recomendado para pruebas repetibles)
    await dbReal.query('DELETE FROM carga_meta');
    await dbReal.query('DELETE FROM pagos');
    await dbReal.query('DELETE FROM creditos');
    await dbReal.query('DELETE FROM clientes');
    await dbReal.query('DELETE FROM asesores');
    await dbReal.query('DELETE FROM politicas');

    const r = await cargarPaquete(dbReal, process.env.CV_DATA_DIR!);
    expect([r.clientes, r.creditos, r.pagos]).toEqual([60, 75, 228]);
    expect(r.pagosAplicados).toBe(226); // 2 reintentos con clave repetida
    
    // Restaurar la variable para no afectar otras pruebas si se corren en secuencia
    process.env.TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/credito_vecino_test';
  });
});