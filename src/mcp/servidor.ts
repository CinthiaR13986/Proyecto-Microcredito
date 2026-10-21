/**
 * servidor.ts — E3 · Servidor MCP sobre los puertos del Proyecto 1.
 *
 * Expone las 8 capacidades de la sección 6.3 del enunciado:
 *   1. Consultar un crédito
 *   2. Calcular la deuda de una cuota
 *   3. Explicar una mora (desglose por tramos recorridos)
 *   4. Listar créditos en mora (filtrable por tramo)
 *   5. Ver próximos vencimientos
 *   6. Consultar la cartera (activa, mora, riesgo, incobrable)
 *   7. Consultar un cierre (diario o mensual)
 *   8. Registrar un pago (sensible, requiere aprobación humana)
 *
 * Solo lectura por defecto. La única acción sensible (registrar pago)
 * se marca con annotations.destructiveHint y annotations.openWorldHint
 * para que el cliente MCP muestre confirmación antes de ejecutar.
 *
 * Errores uniformes: crédito inexistente, cuota ya pagada, crédito
 * incobrable, monto no exacto, fecha inválida.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { crearConexion } from '../persistencia/conexion';
import {
  listarCreditos,
  listarPagosAplicados,
  nombresClientes,
  reglasDeGasto,
} from '../persistencia/consultas';
import {
  aCentavos,
  reconstruirCredito,
  type ContextoCartera,
  type DetalleCredito,
} from '../servicios/reconstructor';
import {
  carteraAlCorte,
  cierreEntre,
  morososAlCorte,
  vencimientosEn,
} from '../servicios/reportes';
import {
  CalcularDeudaSchema,
  ConsultarCarteraSchema,
  ConsultarCierreSchema,
  ConsultarCreditoSchema,
  ExplicarMoraSchema,
  ListarMorososSchema,
  RegistrarPagoSchema,
  VerVencimientosSchema,
} from './esquemas';
import { lastDayOfMonth, parseISO, format } from 'date-fns';

/**
 * esquemaJson — garantiza el contrato JSON Schema que el protocolo MCP
 * exige para inputSchema: un objeto con type: "object" en la raíz.
 * El conversor de Zod aporta properties/required; aquí se asegura el type.
 */
function esquemaJson(schema: Parameters<typeof zodToJsonSchema>[0]): Record<string, unknown> {
  const base = zodToJsonSchema(schema) as Record<string, unknown>;
  return { ...base, type: 'object' };
}

const db = await crearConexion('.pgdata');

async function contexto(): Promise<ContextoCartera> {
  return {
    creditos: await listarCreditos(db),
    pagos: await listarPagosAplicados(db),
    nombres: await nombresClientes(db),
    reglas: await reglasDeGasto(db),
  };
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

const dinero = (d: { aNumero(): number }) => ({
  centavos: aCentavos(d as any),
  texto: d.aNumero().toFixed(2),
});

function errorMcp(codigo: string, mensaje: string) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: { codigo, mensaje } }) }],
    isError: true,
  };
}

const server = new Server(
  { name: 'credito-vecino-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'consultar_credito',
        description:
          'Devuelve el estado completo de un crédito: saldo, días de atraso, tramo, cuotas pagadas y vencidas, próxima cuota.',
        inputSchema: esquemaJson(ConsultarCreditoSchema),
      },
      {
        name: 'calcular_deuda',
        description:
          'Calcula la deuda exigible de la primera cuota vencida: desglose de gastos, moratorio, interés corriente, capital y total.',
        inputSchema: esquemaJson(CalcularDeudaSchema),
      },
      {
        name: 'explicar_mora',
        description:
          'Explica el interés moratorio de una cuota desglosado por tramos recorridos, con días y tasa de cada uno.',
        inputSchema: esquemaJson(ExplicarMoraSchema),
      },
      {
        name: 'listar_morosos',
        description:
          'Lista los créditos en mora al corte indicado, con días de atraso, tramo y saldo. Filtrable por tramo.',
        inputSchema: esquemaJson(ListarMorososSchema),
      },
      {
        name: 'ver_vencimientos',
        description:
          'Lista las cuotas que vencen en una ventana de días desde el corte, con monto y total.',
        inputSchema: esquemaJson(VerVencimientosSchema),
      },
      {
        name: 'consultar_cartera',
        description:
          'Devuelve la cartera activa, en mora, en riesgo con desglose por tramo, e incobrable del período.',
        inputSchema: esquemaJson(ConsultarCarteraSchema),
      },
      {
        name: 'consultar_cierre',
        description:
          'Devuelve desembolsos y recuperaciones por concepto (gastos, moratorio, corriente, capital) para un cierre diario o mensual.',
        inputSchema: esquemaJson(ConsultarCierreSchema),
      },
      {
        name: 'registrar_pago',
        description:
          'Registra un pago aplicando la prelación y la idempotencia. REQUIERE APROBACIÓN HUMANA antes de ejecutarse.',
        inputSchema: esquemaJson(RegistrarPagoSchema),
        annotations: {
          title: 'Registrar pago (acción sensible)',
          destructiveHint: true,
          openWorldHint: true,
          readOnlyHint: false,
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'consultar_credito': {
        const parsed = ConsultarCreditoSchema.safeParse(args);
        if (!parsed.success) return errorMcp('VALIDACION_ERROR', parsed.error.message);
        const { fila, detalle } = await detalleDe(parsed.data.id_credito, parsed.data.corte);
        if (!fila || !detalle) return errorMcp('CREDITO_INEXISTENTE', `El crédito ${parsed.data.id_credito} no existe.`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                id: detalle.id,
                cliente: { id: detalle.idCliente, nombre: detalle.nombreCliente },
                politica: detalle.politica,
                estado: detalle.estado,
                diasAtraso: detalle.diasAtraso,
                tramo: detalle.tramo,
                saldoCapital: dinero(detalle.saldoCapital),
                proximaCuota: detalle.proximaCuota
                  ? { numero: detalle.proximaCuota.numero, vencimiento: detalle.proximaCuota.vencimiento, monto: dinero(detalle.proximaCuota.monto) }
                  : null,
                cuotas: detalle.cuotas.map((q) => ({
                  numero: q.numero,
                  vencimiento: q.vencimiento,
                  pagada: q.pagada,
                  diasAtrasoAlCorte: q.diasAtrasoAlCorte,
                })),
              }),
            },
          ],
        };
      }

      case 'calcular_deuda': {
        const parsed = CalcularDeudaSchema.safeParse(args);
        if (!parsed.success) return errorMcp('VALIDACION_ERROR', parsed.error.message);
        const { fila, detalle } = await detalleDe(parsed.data.id_credito, parsed.data.corte);
        if (!fila || !detalle) return errorMcp('CREDITO_INEXISTENTE', `El crédito ${parsed.data.id_credito} no existe.`);
        if (!detalle.deuda) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ mensaje: 'Sin cuotas vencidas en la fecha de corte.' }) }],
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                id: detalle.id,
                corte: parsed.data.corte,
                cuotaNumero: detalle.deuda.cuotaNumero,
                gastos: dinero(detalle.deuda.gastos),
                interesMoratorio: dinero(detalle.deuda.interesMoratorio),
                interesCorriente: dinero(detalle.deuda.interesCorriente),
                capital: dinero(detalle.deuda.capital),
                total: dinero(detalle.deuda.total),
              }),
            },
          ],
        };
      }

      case 'explicar_mora': {
        const parsed = ExplicarMoraSchema.safeParse(args);
        if (!parsed.success) return errorMcp('VALIDACION_ERROR', parsed.error.message);
        const { fila, detalle } = await detalleDe(parsed.data.id_credito, parsed.data.corte);
        if (!fila || !detalle) return errorMcp('CREDITO_INEXISTENTE', `El crédito ${parsed.data.id_credito} no existe.`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                id: detalle.id,
                corte: parsed.data.corte,
                diasAtraso: detalle.diasAtraso,
                tramo: detalle.tramo,
                politica: detalle.politica,
                lineas: detalle.lineasMora.map((l) => ({
                  tramo: l.tramo,
                  tasaTna: l.tasaTna,
                  diasEnTramo: l.diasEnTramo,
                  montoSinRedondear: l.montoSinRedondear.toFixed(4),
                })),
                moratorioTotal: detalle.deuda ? dinero(detalle.deuda.interesMoratorio) : dinero({ aNumero: () => 0 }),
              }),
            },
          ],
        };
      }

      case 'listar_morosos': {
        const parsed = ListarMorososSchema.safeParse(args);
        if (!parsed.success) return errorMcp('VALIDACION_ERROR', parsed.error.message);
        const lista = morososAlCorte(await contexto(), parsed.data.corte, parsed.data.tramo);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                corte: parsed.data.corte,
                total: lista.length,
                morosos: lista.map((m) => ({
                  idCredito: m.idCredito,
                  cliente: m.cliente,
                  dias: m.dias,
                  tramo: m.tramo,
                  saldoCapital: dinero(m.saldoCapital),
                  deudaTotal: m.deudaTotal ? dinero(m.deudaTotal) : null,
                })),
              }),
            },
          ],
        };
      }

      case 'ver_vencimientos': {
        const parsed = VerVencimientosSchema.safeParse(args);
        if (!parsed.success) return errorMcp('VALIDACION_ERROR', parsed.error.message);
        const v = vencimientosEn(await contexto(), parsed.data.corte, parsed.data.dias);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                ventana: v.ventana,
                totalCuotas: v.cuotas.length,
                total: dinero(v.total),
                cuotas: v.cuotas.map((c) => ({
                  idCredito: c.idCredito,
                  cliente: c.cliente,
                  numero: c.numero,
                  vencimiento: c.vencimiento,
                  monto: dinero(c.monto),
                })),
              }),
            },
          ],
        };
      }

      case 'consultar_cartera': {
        const parsed = ConsultarCarteraSchema.safeParse(args);
        if (!parsed.success) return errorMcp('VALIDACION_ERROR', parsed.error.message);
        const c = carteraAlCorte(await contexto(), parsed.data.corte);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
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
              }),
            },
          ],
        };
      }

      case 'consultar_cierre': {
        const parsed = ConsultarCierreSchema.safeParse(args);
        if (!parsed.success) return errorMcp('VALIDACION_ERROR', parsed.error.message);
        const desde = parsed.data.tipo === 'diario' ? parsed.data.fecha! : `${parsed.data.mes}-01`;
        const hasta =
          parsed.data.tipo === 'diario' ? parsed.data.fecha! : format(lastDayOfMonth(parseISO(desde)), 'yyyy-MM-dd');
        const c = cierreEntre(await contexto(), desde, hasta);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                tipo: parsed.data.tipo,
                desde: c.desde,
                hasta: c.hasta,
                desembolsos: dinero(c.desembolsos),
                numeroDesembolsos: c.numeroDesembolsos,
                recuperaciones: {
                  gastos: dinero(c.recuperaciones.gastos),
                  interesMoratorio: dinero(c.recuperaciones.interesMoratorio),
                  interesCorriente: dinero(c.recuperaciones.interesCorriente),
                  capital: dinero(c.recuperaciones.capital),
                  total: dinero(c.recuperaciones.total),
                },
                numeroPagos: c.numeroPagos,
              }),
            },
          ],
        };
      }

      case 'registrar_pago': {
        const parsed = RegistrarPagoSchema.safeParse(args);
        if (!parsed.success) return errorMcp('VALIDACION_ERROR', parsed.error.message);
        const { id_credito, clave_idempotencia, monto_centavos, canal, fecha } = parsed.data;

        // Idempotencia P1 6.10: misma clave → no se aplica dos veces.
        const existente = await db.query<{ fecha: string; monto_centavos: number | string; canal: string }>(
          'select fecha, monto_centavos, canal from pagos where clave_idempotencia = $1',
          [clave_idempotencia],
        );
        if (existente.rows.length > 0) {
          const orig = existente.rows[0]!;
          return errorMcp(
            'PAGO_DUPLICADO',
            `Este pago ya fue registrado el ${orig.fecha} con la misma clave de idempotencia. No se aplicó dos veces.`,
          );
        }

        const { fila, detalle } = await detalleDe(id_credito, fecha);
        if (!fila || !detalle) return errorMcp('CREDITO_INEXISTENTE', `El crédito ${id_credito} no existe.`);
        if (detalle.estado === 'incobrable') {
          return errorMcp('CREDITO_INCOBRABLE', 'El crédito está dado de baja por incobrable: no admite pagos por esta vía.');
        }
        if (!detalle.deuda) {
          return errorMcp('CUOTA_YA_PAGADA', 'El crédito no tiene cuotas vencidas pendientes en la fecha indicada.');
        }
        if (monto_centavos !== aCentavos(detalle.deuda.total)) {
          return errorMcp(
            'MONTO_NO_EXACTO',
            `El monto no coincide con lo adeudado de la cuota ${detalle.deuda.cuotaNumero} al ${fecha}.`,
          );
        }

        await db.query(
          'insert into pagos (clave_idempotencia, id_credito, fecha, monto_centavos, canal) values ($1,$2,$3,$4,$5)',
          [clave_idempotencia, id_credito, fecha, monto_centavos, canal],
        );
        const despues = await detalleDe(id_credito, fecha);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                clave: clave_idempotencia,
                aplicado: detalle.deuda
                  ? {
                      gastos: dinero(detalle.deuda.gastos),
                      interesMoratorio: dinero(detalle.deuda.interesMoratorio),
                      interesCorriente: dinero(detalle.deuda.interesCorriente),
                      capital: dinero(detalle.deuda.capital),
                      total: dinero(detalle.deuda.total),
                    }
                  : null,
                estadoResultante: despues.detalle?.estado,
                tramoResultante: despues.detalle?.tramo,
                diasResultantes: despues.detalle?.diasAtraso,
              }),
            },
          ],
        };
      }

      default:
        return errorMcp('HERRAMIENTA_INEXISTENTE', `La herramienta ${name} no existe.`);
    }
  } catch (e) {
    return errorMcp('ERROR_INTERNO', e instanceof Error ? e.message : String(e));
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('✔ Servidor MCP de Crédito Vecino listo (stdio)');