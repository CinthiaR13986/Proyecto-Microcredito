import type { PropuestaPago } from './agenteClient';

const FILAS: [keyof PropuestaPago['desglose'], string][] = [
  ['gastos', '1. Gastos de cobranza'],
  ['interesMoratorio', '2. Interés moratorio'],
  ['interesCorriente', '3. Interés corriente'],
  ['capital', '4. Capital'],
];

export function ApprovalModal({
  propuesta,
  onAprobar,
  onRechazar,
  cargando,
}: {
  propuesta: PropuestaPago;
  onAprobar: () => void;
  onRechazar: () => void;
  cargando: boolean;
}) {
  const d = propuesta.desglose;
  const dinero = (v: unknown) => (v && typeof v === 'object' && 'texto' in v ? `Q${(v as { texto: string }).texto}` : '—');
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <h3 className="text-lg font-bold text-amber-700">⚠️ Aprobación humana requerida</h3>
        <p className="text-sm text-slate-700">
          El asistente propone registrar un pago. Mueve dinero y cambia el estado del crédito: solo se ejecuta si usted lo aprueba.
        </p>
        <div className="text-sm space-y-1">
          <p>
            <span className="text-slate-500">Crédito:</span> <b>{propuesta.id_credito}</b> · cuota {d.cuotaNumero ?? '—'}
          </p>
          <p>
            <span className="text-slate-500">Fecha de operación:</span> {propuesta.fecha} · canal {propuesta.canal}
          </p>
        </div>
        <table className="w-full text-sm">
          <caption className="text-left text-xs text-slate-500 pb-1">Prelación calculada por el núcleo</caption>
          <tbody>
            {FILAS.map(([k, etiqueta]) => (
              <tr key={k} className="border-b border-slate-100">
                <td className="py-1">{etiqueta}</td>
                <td className="py-1 text-right font-mono">{dinero(d[k])}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className="py-1">Total exigible</td>
              <td className="py-1 text-right font-mono">{dinero(d.total)}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-slate-500 font-mono break-all">Clave de idempotencia: {propuesta.clave_idempotencia}</p>
        <div className="flex gap-3 pt-2">
          <button onClick={onRechazar} disabled={cargando} className="flex-1 h-10 rounded-lg border border-slate-300 font-medium">
            Rechazar
          </button>
          <button onClick={onAprobar} disabled={cargando} className="flex-1 h-10 rounded-lg bg-emerald-700 text-white font-semibold disabled:opacity-50">
            {cargando ? 'Registrando…' : 'Aprobar y registrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
