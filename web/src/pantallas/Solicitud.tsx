/**
 * Solicitud de crédito (OP-3 del guion).
 *
 * Tres pasos: (1) alta del cliente CL-9001, (2) simulación del plan,
 * (3) desembolso con confirmación explícita (WCAG 3.3.4).
 */
import { useState } from 'react';
import { api, q, ErrorApi, type SimulacionDTO } from '../api/cliente';
import { CORTE } from '../api/corte';

type Paso = 'cliente' | 'simulacion' | 'confirmar' | 'exito' | 'error';

interface ClienteForm {
  id_cliente: string;
  nombre_completo: string;
  dpi: string;
  telefono: string;
  municipio: string;
  fecha_alta: string;
}

interface CreditoForm {
  id_credito: string;
  id_asesor: string;
  capital_q: string;
  plazo_meses: number;
  tna_pct: number;
}

const CLIENTE_OP3: ClienteForm = {
  id_cliente: 'CL-9001',
  nombre_completo: 'Gerencia Demostración Gálvez',
  dpi: 'DPI-FICT-009001',
  telefono: '5555-9001',
  municipio: 'Guatemala',
  fecha_alta: CORTE,
};

const CREDITO_OP3: CreditoForm = {
  id_credito: 'CV-2026-9001',
  id_asesor: 'AS-01',
  capital_q: '10000',
  plazo_meses: 12,
  tna_pct: 36,
};

const ASESORES = [
  { id: 'AS-01', nombre: 'Byron Estuardo Cifuentes' },
  { id: 'AS-02', nombre: 'Wendy Lucrecia Ajú' },
  { id: 'AS-03', nombre: 'Erick Manuel Solís' },
  { id: 'AS-04', nombre: 'Karla Beatriz Monzón' },
  { id: 'AS-05', nombre: 'Selvin Adolfo Batz' },
  { id: 'AS-06', nombre: 'Diana Fabiola Orellana' },
];

export function Solicitud({ volver }: { volver: () => void }) {
  const [paso, setPaso] = useState<Paso>('cliente');
  const [cli, setCli] = useState<ClienteForm>(CLIENTE_OP3);
  const [cre, setCre] = useState<CreditoForm>(CREDITO_OP3);
  const [sim, setSim] = useState<SimulacionDTO | null>(null);
  const [error, setError] = useState('');
  const [exito, setExito] = useState<{ cliente: string; credito: string } | null>(null);

  const capitalCentavos = Math.round(Number(cre.capital_q) * 100);
  const tnaBps = Math.round(cre.tna_pct * 100);

  const simular = async () => {
    try {
      const s = await api.simulacion({
        capital_centavos: capitalCentavos,
        plazo_meses: cre.plazo_meses,
        tna_bps: tnaBps,
      });
      setSim(s);
      setPaso('simulacion');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPaso('error');
    }
  };

  const altaCliente = async () => {
    try {
      await api.altaCliente(cli);
      setPaso('simulacion');
      await simular();
    } catch (e) {
      if (e instanceof ErrorApi && e.codigo === 'CLIENTE_DUPLICADO') {
        // Ya existe: continuar con la simulación (el cliente es de demostración).
        setPaso('simulacion');
        await simular();
      } else {
        setError(e instanceof Error ? e.message : String(e));
        setPaso('error');
      }
    }
  };

  const desembolsar = async () => {
    try {
      const r = await api.desembolsar({
        id_credito: cre.id_credito,
        id_cliente: cli.id_cliente,
        id_asesor: cre.id_asesor,
        fecha: CORTE,
        capital_centavos: capitalCentavos,
        plazo_meses: cre.plazo_meses,
        tna_bps: tnaBps,
      });
      setExito({ cliente: cli.id_cliente, credito: r.id_credito });
      setPaso('exito');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPaso('error');
    }
  };

  return (
    <main className="p-4 max-w-md mx-auto space-y-4">
      <button onClick={volver} className="text-sm text-blue-700">← Volver al inicio</button>
      <h2 className="text-lg font-semibold">Solicitud de crédito · OP-3</h2>

      <div className="flex gap-1 text-xs">
        {(['cliente', 'simulacion', 'confirmar'] as Paso[]).map((p, i) => (
          <div key={p} className={`flex-1 py-1 rounded text-center ${
            paso === p ? 'bg-slate-900 text-white' :
            (['cliente', 'simulacion', 'confirmar'].indexOf(paso) > i ? 'bg-emerald-200' : 'bg-slate-200')
          }`}>
            {i + 1}. {p === 'cliente' ? 'Cliente' : p === 'simulacion' ? 'Simulación' : 'Confirmar'}
          </div>
        ))}
      </div>

      {paso === 'cliente' && (
        <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <h3 className="font-medium">Paso 1 · Alta del cliente</h3>
          <Campo label="ID cliente" valor={cli.id_cliente} onChange={(v) => setCli({ ...cli, id_cliente: v })} />
          <Campo label="Nombre completo" valor={cli.nombre_completo} onChange={(v) => setCli({ ...cli, nombre_completo: v })} />
          <Campo label="DPI" valor={cli.dpi} onChange={(v) => setCli({ ...cli, dpi: v })} />
          <Campo label="Teléfono" valor={cli.telefono} onChange={(v) => setCli({ ...cli, telefono: v })} />
          <Campo label="Municipio" valor={cli.municipio} onChange={(v) => setCli({ ...cli, municipio: v })} />
          <Campo label="Fecha alta" valor={cli.fecha_alta} onChange={(v) => setCli({ ...cli, fecha_alta: v })} />
          <button onClick={altaCliente} className="w-full h-12 rounded-xl bg-blue-700 text-white font-medium">
            Continuar al plan de pagos
          </button>
        </section>
      )}

      {paso === 'simulacion' && sim && (
        <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <h3 className="font-medium">Paso 2 · Simulación del plan</h3>
          <div className="space-y-2">
            <Campo label="ID crédito" valor={cre.id_credito} onChange={(v) => setCre({ ...cre, id_credito: v })} />
            <label className="block text-sm">
              <span className="text-xs text-slate-600">Asesor</span>
              <select
                value={cre.id_asesor}
                onChange={(e) => setCre({ ...cre, id_asesor: e.target.value })}
                className="w-full h-10 rounded border border-slate-300 px-2 mt-1"
              >
                {ASESORES.map((a) => <option key={a.id} value={a.id}>{a.id} · {a.nombre}</option>)}
              </select>
            </label>
            <Campo label="Capital (Q)" valor={cre.capital_q} onChange={(v) => setCre({ ...cre, capital_q: v })} />
            <Campo label="Plazo (meses)" valor={String(cre.plazo_meses)} onChange={(v) => setCre({ ...cre, plazo_meses: Number(v) })} />
            <Campo label="TNA %" valor={String(cre.tna_pct)} onChange={(v) => setCre({ ...cre, tna_pct: Number(v) })} />
            <button onClick={simular} className="w-full h-11 rounded-lg bg-white border border-slate-300">
              Recalcular plan
            </button>
          </div>

          <div className="mt-4">
            <p className="text-xs text-slate-600 mb-1">Plan de {sim.cuotas.length} cuotas</p>
            <div className="max-h-64 overflow-auto border border-slate-200 rounded">
              <table className="w-full text-xs tabular-nums">
                <thead className="bg-slate-50 sticky top-0">
                  <tr><th className="text-left p-1">#</th><th className="text-right p-1">Cuota</th><th className="text-right p-1">Interés</th><th className="text-right p-1">Capital</th></tr>
                </thead>
                <tbody>
                  {sim.cuotas.map((c) => (
                    <tr key={c.numero} className={c.numero === sim.cuotas.length ? 'bg-amber-50' : ''}>
                      <td className="p-1">{c.numero}</td>
                      <td className="text-right p-1">{q(c.cuota)}</td>
                      <td className="text-right p-1">{q(c.interes)}</td>
                      <td className="text-right p-1">{q(c.amortizacion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-amber-800 mt-1">
              ⓘ La cuota {sim.cuotas.length} es un centavo mayor: es el ajuste que deja el saldo exactamente en Q0.00.
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Total pagado: <strong>{q(sim.totalPagado)}</strong> · Interés total: {q(sim.totalInteres)}
            </p>
          </div>

          <button onClick={() => setPaso('confirmar')} className="w-full h-12 rounded-xl bg-blue-700 text-white font-medium">
            Continuar a confirmar desembolso
          </button>
        </section>
      )}

      {paso === 'confirmar' && sim && (
        <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <h3 className="font-medium">Paso 3 · Confirmar desembolso</h3>
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
            <p><strong>Cliente:</strong> {cli.nombre_completo} ({cli.id_cliente})</p>
            <p><strong>Crédito:</strong> {cre.id_credito}</p>
            <p><strong>Capital:</strong> Q{cre.capital_q} · <strong>Plazo:</strong> {cre.plazo_meses} meses · <strong>TNA:</strong> {cre.tna_pct}%</p>
            <p><strong>Fecha:</strong> {CORTE}</p>
          </div>
          <p className="text-sm text-slate-600">
            El desembolso es una transacción financiera <strong>irreversible</strong> en esta pantalla.
            Una vez confirmada, el crédito queda vigente y su primera cuota vence dentro de un mes.
          </p>
          <button onClick={desembolsar} className="w-full h-12 rounded-xl bg-emerald-700 text-white font-semibold">
            Aprobar y desembolsar
          </button>
          <button onClick={() => setPaso('simulacion')} className="w-full h-12 rounded-xl bg-white border border-slate-300">
            Volver a revisar el plan
          </button>
        </section>
      )}

      {paso === 'exito' && exito && (
        <section className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 space-y-2">
          <h3 className="font-semibold text-emerald-900">✔ Crédito desembolsado</h3>
          <p className="text-sm">Cliente: {exito.cliente} · Crédito: {exito.credito}</p>
          <p className="text-sm">El crédito ya está vigente. Su primera cuota vence en un mes.</p>
          <button onClick={volver} className="w-full h-11 rounded-lg bg-white border border-slate-300">
            Volver al inicio
          </button>
        </section>
      )}

      {paso === 'error' && (
        <section className="bg-red-50 border border-red-300 rounded-xl p-4 space-y-2">
          <h3 className="font-semibold text-red-900">No se pudo completar</h3>
          <p className="text-sm text-red-800">{error}</p>
          <button onClick={() => setPaso('cliente')} className="w-full h-11 rounded-lg bg-white border border-slate-300">
            Volver a empezar
          </button>
        </section>
      )}
    </main>
  );
}

function Campo({ label, valor, onChange }: { label: string; valor: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="text-xs text-slate-600">{label}</span>
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 rounded border border-slate-300 px-2 mt-1"
      />
    </label>
  );
}