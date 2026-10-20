/**
 * Gerencia — tablero + cierres + espacio reservado al chat.
 *
 * Reglas del enunciado E1:
 *  - La cartera ACTIVA se muestra (es el denominador de los porcentajes).
 *  - La cartera EN MORA y la EN RIESGO van en bloques separados, con
 *    rótulo y definición propios (hallazgo sev. 4 de E5).
 *  - El cierre desglosa las recuperaciones por concepto
 *    (gastos, moratorio, corriente, capital).
 *  - El chat del asistente vive en un panel lateral reservado.
 */
import { useEffect, useState } from 'react';
import { api, q, type CarteraDTO, type CierreDTO } from '../api/cliente';
import { CORTE } from '../api/corte';

type VistaG = 'tablero' | 'cierre-diario' | 'cierre-mensual';

const NOMBRE_TRAMO: Record<string, string> = {
  MORA_1: 'Mora 1 (1–30 días)',
  MORA_2: 'Mora 2 (31–60 días)',
  MORA_3: 'Mora 3 (61–90 días)',
  VENCIDO: 'Vencido (91–120 días)',
  REESTRUCTURADO_AL_DIA: 'Reestructurado al día',
};

export function Gerencia() {
  const [vista, setVista] = useState<VistaG>('tablero');
  const [cartera, setCartera] = useState<CarteraDTO | null>(null);
  const [cierreD, setCierreD] = useState<CierreDTO | null>(null);
  const [cierreM, setCierreM] = useState<CierreDTO | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setCargando(true);
        const [c, d, m] = await Promise.all([
          api.cartera(CORTE),
          api.cierreDiario(CORTE),
          api.cierreMensual(CORTE.slice(0, 7)),
        ]);
        setCartera(c);
        setCierreD(d);
        setCierreM(m);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  if (cargando) return <p className="p-6">Cargando indicadores…</p>;
  if (error) return <p className="p-6 text-red-700">{error}</p>;
  if (!cartera || !cierreD || !cierreM) return null;

  return (
    <main className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap gap-2 mb-4">
        {([
          ['tablero', 'Tablero'],
          ['cierre-diario', 'Cierre diario'],
          ['cierre-mensual', 'Cierre mensual'],
        ] as [VistaG, string][]).map(([v, etiqueta]) => (
          <button
            key={v}
            onClick={() => setVista(v)}
            className={`px-4 h-10 rounded-lg text-sm ${
              vista === v ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300'
            }`}
          >
            {etiqueta}
          </button>
        ))}
        <span className="ml-auto text-xs bg-amber-100 text-amber-900 px-3 h-10 flex items-center rounded">
          Corte: {CORTE}
        </span>
      </div>

      {vista === 'tablero' && <Tablero c={cartera} />}
      {vista === 'cierre-diario' && <Cierre c={cierreD} titulo={`Cierre diario · ${CORTE}`} />}
      {vista === 'cierre-mensual' && <Cierre c={cierreM} titulo={`Cierre mensual · ${CORTE.slice(0, 7)}`} />}

      <aside className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-4">
        <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">Reservado · Proyecto Final</p>
        <p className="font-medium text-sm">Asistente gerencial (chat)</p>
        <p className="text-xs text-slate-500 mt-1">
          Este panel acogerá el chat del asistente: responderá G-1 a G-8 en lenguaje natural
          usando el mismo núcleo que alimenta este tablero, para que las cifras coincidan
          siempre.
        </p>
      </aside>
    </main>
  );
}

function Kpi({ titulo, valor, subtitulo, tono }: {
  titulo: string; valor: string; subtitulo?: string; tono?: 'rojo' | 'ambar' | 'neutro';
}) {
  const tonos = {
    rojo: 'border-red-300 bg-red-50',
    ambar: 'border-amber-300 bg-amber-50',
    neutro: 'border-slate-200 bg-white',
  };
  return (
    <div className={`rounded-xl border p-4 ${tonos[tono ?? 'neutro']}`}>
      <p className="text-xs text-slate-600 uppercase tracking-wide">{titulo}</p>
      <p className="text-2xl font-bold tabular-nums mt-1">{valor}</p>
      {subtitulo && <p className="text-xs text-slate-500 mt-1">{subtitulo}</p>}
    </div>
  );
}

function Tablero({ c }: { c: CarteraDTO }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <Kpi
        titulo="Cartera activa"
        valor={q(c.carteraActiva)}
        subtitulo={`${c.creditosActivos} créditos activos · denominador de los porcentajes`}
      />
      <Kpi
        titulo="Cartera en riesgo"
        valor={`${c.porcentajeRiesgo.toFixed(2)}%`}
        subtitulo={`${q(c.carteraEnRiesgo)} · >30 días o reestructurados`}
        tono="rojo"
      />
      <Kpi
        titulo="Cartera en mora"
        valor={`${c.porcentajeEnMora.toFixed(2)}%`}
        subtitulo={`${q(c.carteraEnMora)} · todo crédito con ≥1 día de atraso`}
        tono="ambar"
      />
      <Kpi
        titulo="Incobrable en el mes"
        valor={q(c.incobrablesDelMes)}
        subtitulo={`${c.creditosIncobrablesDelMes} crédito(s) dados de baja`}
      />

      <section className="md:col-span-2 xl:col-span-3 bg-white border border-slate-200 rounded-xl p-4">
        <h3 className="font-semibold mb-3">Cartera en riesgo por tramo</h3>
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-1">Tramo</th>
              <th className="text-right">Créditos</th>
              <th className="text-right">Saldo</th>
              <th className="text-right">% de cartera</th>
            </tr>
          </thead>
          <tbody>
            {c.desglose.map((l) => (
              <tr key={l.tramo} className="border-t border-slate-100">
                <td className="py-2">{NOMBRE_TRAMO[l.tramo] ?? l.tramo}</td>
                <td className="text-right">{l.creditos}</td>
                <td className="text-right">{q(l.saldoCapital)}</td>
                <td className="text-right">{l.porcentaje.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold">
              <td className="py-2">Total en riesgo</td>
              <td className="text-right">{c.desglose.reduce((a, l) => a + l.creditos, 0)}</td>
              <td className="text-right">{q(c.carteraEnRiesgo)}</td>
              <td className="text-right">{c.porcentajeRiesgo.toFixed(2)}%</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="md:col-span-2 xl:col-span-1 bg-amber-50 border border-amber-300 rounded-xl p-4">
        <h3 className="font-semibold text-amber-900 mb-2">Cartera en mora</h3>
        <p className="text-2xl font-bold tabular-nums">{c.porcentajeEnMora.toFixed(2)}%</p>
        <p className="text-sm text-amber-900 mt-1">{q(c.carteraEnMora)}</p>
        <p className="text-xs text-amber-800 mt-2">
          "Todo crédito con al menos un día de atraso" — indicador distinto de la
          cartera en riesgo.
        </p>
      </section>
    </div>
  );
}

function Cierre({ c, titulo }: { c: CierreDTO; titulo: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <section className="bg-white border border-slate-200 rounded-xl p-4">
        <h3 className="font-semibold">{titulo}</h3>
        <p className="text-xs text-slate-500 mb-3">Desde {c.desde} hasta {c.hasta}</p>
        <Kpi
          titulo="Desembolsos del período"
          valor={q(c.desembolsos)}
          subtitulo={`${c.numeroDesembolsos} crédito(s) nuevo(s)`}
        />
      </section>
      <section className="bg-white border border-slate-200 rounded-xl p-4">
        <h3 className="font-semibold mb-2">Recuperaciones por concepto</h3>
        <p className="text-xs text-slate-500 mb-3">{c.numeroPagos} pagos aplicados</p>
        <div className="space-y-2 text-sm">
          <FilaConcepto concepto="1 · Gastos de gestión" d={c.recuperaciones.gastos} />
          <FilaConcepto concepto="2 · Interés moratorio" d={c.recuperaciones.interesMoratorio} />
          <FilaConcepto concepto="3 · Interés corriente" d={c.recuperaciones.interesCorriente} />
          <FilaConcepto concepto="4 · Capital" d={c.recuperaciones.capital} />
          <div className="flex justify-between font-semibold border-t border-slate-300 pt-2">
            <span>Total recuperado</span>
            <span className="tabular-nums">{q(c.recuperaciones.total)}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function FilaConcepto({ concepto, d }: { concepto: string; d: { texto: string } }) {
  return (
    <div className="flex justify-between">
      <span>{concepto}</span>
      <span className="tabular-nums">Q{d.texto}</span>
    </div>
  );
}