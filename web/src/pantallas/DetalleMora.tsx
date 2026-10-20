import { useEffect, useState } from 'react';
import { api, q, type MoraDTO } from '../api/cliente';
import { CORTE } from '../api/corte';

const NOMBRE_LLANO: Record<string, string> = {
  MORA_1: 'Primer mes de atraso',
  MORA_2: 'Segundo mes de atraso',
  MORA_3: 'Tercer mes de atraso',
  VENCIDO: 'Después del tercer mes',
};

export function DetalleMora({ id, volver }: { id: string; volver: () => void }) {
  const [m, setM] = useState<MoraDTO | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    setM(null);
    api.mora(id, CORTE).then(setM).catch((e: Error) => setError(e.message));
  }, [id]);

  if (error) return <p className="p-4 text-red-700">{error}</p>;
  if (!m) return <p className="p-4">Cargando…</p>;

  return (
    <main className="p-4 max-w-md mx-auto space-y-4">
      <button onClick={volver} className="text-sm text-blue-700">← Volver al crédito</button>

      <section className="bg-white rounded-xl p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Su recargo por atraso</h2>
        <p className="text-sm text-slate-600">
          {m.diasAtraso === 0
            ? 'Sin atraso: no hay recargo.'
            : `Su atraso pasó por ${m.lineas.length} ${m.lineas.length === 1 ? 'etapa' : 'etapas'}. Cada etapa tiene su propio recargo.`}
        </p>
      </section>

      {m.lineas.length > 0 && (
        <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          {m.lineas.map((l) => (
            <div key={l.tramo} className="flex items-baseline justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{NOMBRE_LLANO[l.tramo] ?? l.tramo}</p>
                <p className="text-xs text-slate-500">
                  {l.diasEnTramo} días · tasa {Number(l.tasaTna) * 100}% anual
                </p>
              </div>
              <p className="text-sm tabular-nums text-slate-600">{l.montoSinRedondear}</p>
            </div>
          ))}
          <div className="border-t border-slate-200 pt-3 flex items-baseline justify-between">
            <p className="text-sm font-medium">Recargo total a pagar</p>
            <p className="text-2xl font-bold tabular-nums">{q(m.moratorioTotal)}</p>
          </div>
          <p className="text-xs text-slate-500">
            El total se redondea una sola vez al final, sobre la suma de las etapas.
            El recargo se calcula solo sobre el capital vencido, nunca sobre intereses.
          </p>
        </section>
      )}

      <p className="text-xs text-slate-500 px-1">
        Política aplicada: {m.politica} · corte {m.corte}
      </p>
    </main>
  );
}