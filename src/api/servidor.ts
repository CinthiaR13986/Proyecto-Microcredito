/**
 * servidor.ts — E1 · API REST sobre los puertos primarios del Proyecto 1.
 *
 * Aquí NO hay reglas de negocio: todo se delega a servicios (reconstructor,
 * reportes) y al núcleo P1/P2. Convención uniforme de errores:
 *   { error: { codigo, mensaje, detalles? } }
 * Códigos: 400 validación/fecha · 404 inexistente · 409 clave duplicada ·
 * 422 regla de negocio (incobrable, cuota pagada, monto no exacto).
 */
import express, { type Response } from 'express';
import cors from 'cors';
import { lastDayOfMonth, parseISO, format } from 'date-fns';
import { crearConexion } from '../persistencia/conexion';
import {
  listarCreditos,
  listarPagosAplicados,
  nombresClientes,
  reglasDeGasto,
} from '../persistencia/consultas';
import {
  aCentavos,
  deCentavos,
  reconstruirCredito,
  type DetalleCredito,
} from '../servicios/reconstructor';
import {
  carteraAlCorte,
  cierreEntre,
  morososAlCorte,
  vencimientosEn,
  type ContextoCartera,
} from '../servicios/reportes';
import { MetodoFrances, PlanAmortizacion } from '../dominio/plan-amortizacion';
import type { Dinero } from '../dominio/dinero';
import {
  ClienteRequestSchema,
  CorteQuerySchema,
  CreditoRequestSchema,
  DiasQuerySchema,
  FechaSchema,
  MesQuerySchema,
  MorososQuerySchema,
  PagoRequestSchema,
  SimulacionQuerySchema,
} from './esquemas';

const dinero = (d: Dinero) => ({ centavos: aCentavos(d), texto: d.aNumero().toFixed(2) });

function detalleJson(d: DetalleCredito) {
  return {
    id: d.id,
    cliente: { id: d.idCliente, nombre: d.nombreCliente },
    politica: d.politica,
    reestructurado: d.reestructurado,
    estado: d.estado,
    diasAtraso: d.diasAtraso,
    tramo: d.tramo,
    saldoCapital: dinero(d.saldoCapital),
    proximaCuota: d.proximaCuota
      ? { numero: d.proximaCuota.numero, vencimiento: d.proximaCuota.vencimiento, monto: dinero(d.proximaCuota.monto) }
      : null,
    deuda: d.deuda
      ? {
          cuotaNumero: d.deuda.cuotaNumero,
          gastos: dinero(d.deuda.gastos),
          interesMoratorio: dinero(d.deuda.interesMoratorio),
          interesCorriente: dinero(d.deuda.interesCorriente),
          capital: dinero(d.deuda.capital),
          total: dinero(d.deuda.total),
        }
      : null,
    lineasMora: d.lineasMora.map((l) => ({
      tramo: l.tramo,
      tasaTna: l.tasaTna,
      diasEnTramo: l.diasEnTramo,
      montoSinRedondear: l.montoSinRedondear.toFixed(4),
    })),
    interesEnSuspenso: dinero(d.interesEnSuspenso),
    cuotas: d.cuotas.map((q) => ({
      numero: q.numero,
      vencimiento: q.vencimiento,
      monto: dinero(q.monto),
      interes: dinero(q.interes),
      amortizacion: dinero(q.amortizacion),
      pagada: q.pagada,
      capitalRestante: dinero(q.capitalRestante),
      diasAtrasoAlCorte: q.diasAtrasoAlCorte,
    })),
  };
}

const app = express();
app.use(cors());
app.use(express.json());

const db = await crearConexion('.pgdata');

async function contexto(): Promise<ContextoCartera> {
  return {
    creditos: await listarCreditos(db),
    pagos: await listarPagosAplicados(db),
    nombres: await nombresClientes(db),
    reglas: await reglasDeGasto(db),
  };
}

function error(
  res: Response,
  status: number,
  codigo: string,
  mensaje: string,
  detalles?: unknown,
): Response {
  return res.status(status).json({
    error: { codigo, mensaje, ...(detalles === undefined ? {} : { detalles }) },
  });
}

async function detalleDe(id: string, corte: string) {
  const ctx = await contexto();
  const fila = ctx.creditos.find((c) => c.id_credito === id);
  if (!fila) return { ctx, fila: null as null, detalle: null as null };
  const pagos = ctx.pagos.filter((p) => p.id_credito === id && p.fecha <= corte);
  const detalle = reconstruirCredito(
    fila,
    ctx.nombres[fila.id_cliente] ?? '(sin nombre)',
    pagos,
    corte,
    ctx.reglas,
  );
  return { ctx, fila, detalle };
}

// ── Crédito: detalle, mora y deuda ────────────────────────────────
app.get('/api/creditos/:id', async (req, res) => {
  const q = CorteQuerySchema.safeParse(req.query);
  if (!q.success) return error(res, 400, 'FECHA_INVALIDA', 'La fecha de corte debe ser AAAA-MM-DD.');
  const { fila, detalle } = await detalleDe(req.params.id, q.data.corte);
  if (!fila || !detalle) return error(res, 404, 'CREDITO_INEXISTENTE', `El crédito ${req.params.id} no existe.`);
  res.json(detalleJson(detalle));
});

app.get('/api/creditos/:id/mora', async (req, res) => {
  const q = CorteQuerySchema.safeParse(req.query);
  if (!q.success) return error(res, 400, 'FECHA_INVALIDA', 'La fecha de corte debe ser AAAA-MM-DD.');
  const { fila, detalle } = await detalleDe(req.params.id, q.data.corte);
  if (!fila || !detalle) return error(res, 404, 'CREDITO_INEXISTENTE', `El crédito ${req.params.id} no existe.`);
  res.json({
    id: detalle.id,
    corte: q.data.corte,
    diasAtraso: detalle.diasAtraso,
    tramo: detalle.tramo,
    politica: detalle.politica,
    lineas: detalle.lineasMora.map((l) => ({
      tramo: l.tramo,
      tasaTna: l.tasaTna,
      diasEnTramo: l.diasEnTramo,
      montoSinRedondear: l.montoSinRedondear.toFixed(4),
    })),
    moratorioTotal: detalle.deuda ? dinero(detalle.deuda.interesMoratorio) : dinero(deCentavos(0)),
  });
});

app.get('/api/creditos/:id/deuda', async (req, res) => {
  const q = CorteQuerySchema.safeParse(req.query);
  if (!q.success) return error(res, 400, 'FECHA_INVALIDA', 'La fecha de corte debe ser AAAA-MM-DD.');
  const { fila, detalle } = await detalleDe(req.params.id, q.data.corte);
  if (!fila || !detalle) return error(res, 404, 'CREDITO_INEXISTENTE', `El crédito ${req.params.id} no existe.`);
  if (!detalle.deuda) {
    return res.json({ id: detalle.id, corte: q.data.corte, exigible: null, mensaje: 'Sin cuotas vencidas en la fecha de corte.' });
  }
  res.json({ id: detalle.id, corte: q.data.corte, exigible: detalleJson(detalle).deuda });
});

// ── Pagos: rechazo por incobrable, cuota pagada, monto no exacto, clave repetida ──
app.post('/api/pagos', async (req, res) => {
  const parsed = PagoRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return error(res, 400, 'VALIDACION_ERROR', 'Los datos del pago no cumplen el contrato.', parsed.error.issues);
  }
  const { id_credito, clave_idempotencia, monto_centavos, canal, fecha } = parsed.data;

  // Idempotencia P1 6.10: misma clave → no se aplica dos veces.
  const existente = await db.query<{ fecha: string; monto_centavos: number | string; canal: string }>(
    'select fecha, monto_centavos, canal from pagos where clave_idempotencia = $1',
    [clave_idempotencia],
  );
  if (existente.rows.length > 0) {
    const orig = existente.rows[0]!;
    return error(res, 409, 'PAGO_DUPLICADO',
      `Este pago ya fue registrado el ${orig.fecha} con la misma clave de idempotencia. No se aplicó dos veces.`,
      { original: { fecha: orig.fecha, monto_centavos: Number(orig.monto_centavos), canal: orig.canal } });
  }

  const { fila, detalle } = await detalleDe(id_credito, fecha);
  if (!fila || !detalle) return error(res, 404, 'CREDITO_INEXISTENTE', `El crédito ${id_credito} no existe.`);
  if (detalle.estado === 'incobrable') {
    return error(res, 422, 'CREDITO_INCOBRABLE',
      'El crédito está dado de baja por incobrable: no admite pagos por esta vía (gestión de casa de cobro externa).');
  }
  if (!detalle.deuda) {
    return error(res, 422, 'CUOTA_YA_PAGADA', 'El crédito no tiene cuotas vencidas pendientes en la fecha indicada.');
  }
  if (monto_centavos !== aCentavos(detalle.deuda.total)) {
    return error(res, 422, 'MONTO_NO_EXACTO',
      `El monto no coincide con lo adeudado de la cuota ${detalle.deuda.cuotaNumero} al ${fecha}.`,
      { montoCorrecto: dinero(detalle.deuda.total) });
  }

  await db.query(
    'insert into pagos (clave_idempotencia, id_credito, fecha, monto_centavos, canal) values ($1,$2,$3,$4,$5)',
    [clave_idempotencia, id_credito, fecha, monto_centavos, canal],
  );
  const despues = await detalleDe(id_credito, fecha);
  res.status(201).json({
    clave: clave_idempotencia,
    aplicado: detalleJson(detalle).deuda,
    estadoResultante: despues.detalle?.estado,
    tramoResultante: despues.detalle?.tramo,
    diasResultantes: despues.detalle?.diasAtraso,
  });
});

// ── Originación (OP-3): alta de cliente y desembolso ──────────────
app.post('/api/clientes', async (req, res) => {
  const parsed = ClienteRequestSchema.safeParse(req.body);
  if (!parsed.success) return error(res, 400, 'VALIDACION_ERROR', 'Datos del cliente inválidos.', parsed.error.issues);
  const d = parsed.data;
  const id = d.id_cliente ?? `CL-${Date.now()}`;
  const previo = await db.query('select 1 from clientes where id_cliente = $1', [id]);
  if (previo.rows.length > 0) return error(res, 409, 'CLIENTE_DUPLICADO', `El cliente ${id} ya existe.`);
  await db.query(
    'insert into clientes (id_cliente, nombre_completo, dpi, telefono, municipio, fecha_alta) values ($1,$2,$3,$4,$5,$6)',
    [id, d.nombre_completo, d.dpi, d.telefono, d.municipio, d.fecha_alta],
  );
  res.status(201).json({ id_cliente: id });
});

app.get('/api/simulacion', async (req, res) => {
  const parsed = SimulacionQuerySchema.safeParse(req.query);
  if (!parsed.success) return error(res, 400, 'VALIDACION_ERROR', 'Parámetros de simulación inválidos.', parsed.error.issues);
  const { capital_centavos, plazo_meses, tna_bps } = parsed.data;
  const plan = PlanAmortizacion.generar({
    capital: deCentavos(capital_centavos),
    tasaMensual: tna_bps / 10000 / 12,
    numeroCuotas: plazo_meses,
    metodo: MetodoFrances,
  });
  res.json({
    cuotas: plan.cuotas.map((c) => ({
      numero: c.numero,
      cuota: dinero(c.cuota),
      interes: dinero(c.interes),
      amortizacion: dinero(c.amortizacion),
      saldoFinal: dinero(c.saldoFinal),
    })),
    totalPagado: dinero(plan.totalPagado),
    totalInteres: dinero(plan.totalInteres),
  });
});

app.post('/api/creditos', async (req, res) => {
  const parsed = CreditoRequestSchema.safeParse(req.body);
  if (!parsed.success) return error(res, 400, 'VALIDACION_ERROR', 'Datos del crédito inválidos.', parsed.error.issues);
  const d = parsed.data;
  const previo = await db.query('select 1 from creditos where id_credito = $1', [d.id_credito]);
  if (previo.rows.length > 0) return error(res, 409, 'CREDITO_DUPLICADO', `El crédito ${d.id_credito} ya existe.`);
  const politica = d.fecha < '2026-10-01' ? 'POL-2024-01' : 'POL-2026-10';
  await db.query(
    `insert into creditos (id_credito, id_cliente, id_asesor, fecha, capital_centavos, plazo_meses, tna_bps, reestructurado, politica_mora)
     values ($1,$2,$3,$4,$5,$6,$7,false,$8)`,
    [d.id_credito, d.id_cliente, d.id_asesor, d.fecha, d.capital_centavos, d.plazo_meses, d.tna_bps, politica],
  );
  const { detalle } = await detalleDe(d.id_credito, d.fecha);
  res.status(201).json({ id_credito: d.id_credito, politica_mora: politica, detalle: detalle ? detalleJson(detalle) : null });
});

// ── Gerencia: cartera, cierres, vencimientos, morosos ─────────────
app.get('/api/cartera', async (req, res) => {
  const q = CorteQuerySchema.safeParse(req.query);
  if (!q.success) return error(res, 400, 'FECHA_INVALIDA', 'La fecha de corte debe ser AAAA-MM-DD.');
  const c = carteraAlCorte(await contexto(), q.data.corte);
  res.json({
    corte: c.corte,
    creditosActivos: c.creditosActivos,
    carteraActiva: dinero(c.carteraActiva),
    carteraEnMora: dinero(c.carteraEnMora),
    porcentajeEnMora: c.porcentajeEnMora,
    carteraEnRiesgo: dinero(c.carteraEnRiesgo),
    porcentajeRiesgo: c.porcentajeRiesgo,
    desglose: c.desglose.map((l) => ({ ...l, saldoCapital: dinero(l.saldoCapital) })),
    incobrablesDelMes: dinero(c.incobrablesDelMes),
    creditosIncobrablesDelMes: c.creditosIncobrablesDelMes,
  });
});

app.get('/api/cierres/diario', async (req, res) => {
  const f = FechaSchema.safeParse(req.query.fecha);
  if (!f.success) return error(res, 400, 'FECHA_INVALIDA', 'Indique ?fecha=AAAA-MM-DD.');
  const c = cierreEntre(await contexto(), f.data, f.data);
  res.json({
    ...c,
    desembolsos: dinero(c.desembolsos),
    recuperaciones: {
      gastos: dinero(c.recuperaciones.gastos),
      interesMoratorio: dinero(c.recuperaciones.interesMoratorio),
      interesCorriente: dinero(c.recuperaciones.interesCorriente),
      capital: dinero(c.recuperaciones.capital),
      total: dinero(c.recuperaciones.total),
    },
  });
});

app.get('/api/cierres/mensual', async (req, res) => {
  const m = MesQuerySchema.safeParse(req.query);
  if (!m.success) return error(res, 400, 'FECHA_INVALIDA', 'Indique ?mes=AAAA-MM.');
  const desde = `${m.data.mes}-01`;
  const hasta = format(lastDayOfMonth(parseISO(desde)), 'yyyy-MM-dd');
  const c = cierreEntre(await contexto(), desde, hasta);
  res.json({
    ...c,
    desembolsos: dinero(c.desembolsos),
    recuperaciones: {
      gastos: dinero(c.recuperaciones.gastos),
      interesMoratorio: dinero(c.recuperaciones.interesMoratorio),
      interesCorriente: dinero(c.recuperaciones.interesCorriente),
      capital: dinero(c.recuperaciones.capital),
      total: dinero(c.recuperaciones.total),
    },
  });
});

app.get('/api/vencimientos', async (req, res) => {
  const q = DiasQuerySchema.safeParse(req.query);
  if (!q.success) return error(res, 400, 'FECHA_INVALIDA', 'Indique ?corte=AAAA-MM-DD&dias=N.');
  const v = vencimientosEn(await contexto(), q.data.corte, q.data.dias);
  res.json({
    ventana: v.ventana,
    totalCuotas: v.cuotas.length,
    total: dinero(v.total),
    cuotas: v.cuotas.map((c) => ({ ...c, monto: dinero(c.monto) })),
  });
});

app.get('/api/morosos', async (req, res) => {
  const q = MorososQuerySchema.safeParse(req.query);
  if (!q.success) return error(res, 400, 'FECHA_INVALIDA', 'Indique ?corte=AAAA-MM-DD (&tramo opcional).');
  const lista = morososAlCorte(await contexto(), q.data.corte, q.data.tramo);
  res.json({
    corte: q.data.corte,
    total: lista.length,
    morosos: lista.map((m) => ({
      ...m,
      saldoCapital: dinero(m.saldoCapital),
      deudaTotal: m.deudaTotal ? dinero(m.deudaTotal) : null,
    })),
  });
});

app.listen(8080, () => {
  console.log('✔ API de Crédito Vecino en http://localhost:8080 (corte canónico 2026-10-31)');
});