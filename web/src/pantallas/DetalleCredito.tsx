import { useEffect, useState } from 'react';
import { api, q, type DetalleDTO } from '../api/cliente';
import { CORTE } from '../api/corte';

export function estadoLlano(d: DetalleDTO): string {
  if (d.estado === 'en_mora') {
    const tramo =
      d.tramo === 'MORA_1'
        ? 'primer mes'
        : d.tramo === 'MORA_2'
          ? 'más de un mes'
          : d.tramo === 'MORA_3'
            ? 'más de dos meses'
            : 'más de tres meses';
    return `Lleva ${d.diasAtraso} días de atraso (${tramo})`;
  }
  if (d.estado === 'vigente') return 'Al día: sin cuotas vencidas';
  if (d.estado === 'cancelado') return 'Cancelado: no debe nada';
  return 'Incobrable: dado de baja, lo gestiona casa de cobro';
}

export function DetalleCredito({
  id,
  irAMora,
  irAPago,
  volver,
}: {
  id: string;
  irAMora: () => void;
  irAPago: () => void;
  volver: () => void;
}) {
  const [d, setD] = useState<DetalleDTO | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    setD(null);
    api.credito(id, CORTE).then(setD).catch((e: Error) => setError(e.message));
  }, [id]);

  if (error) return <p className="p-4 text-red-700">{error}</p>;
  if (!d) return <p className="p-4">Cargando…</p>;

  return (
    <main className="p-4 max-w-md mx-auto space-y-4">
      <button onClick={volver} className="text-sm text-blue-700">← Volver</button>

      <section className="bg-white rounded-xl p-4 shadow-sm">
        <p className="text-sm text-slate-500">{d.id} · {d.cliente.nombre}</p>
        <h2 className="text-lg font-semibold">{estadoLlano(d)}</h2>
        <p className="text-xs text-slate-600">
          Política de mora: {d.politica}
          {d.reestructurado ? ' · crédito reestructurado (sigue contando en riesgo)' : ''}
        </p>
      </section>

      <section className="bg-white rounded-xl p-4 shadow-sm grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-slate-500">Saldo de capital</p>
          <p className="text-xl font-semibold tabular-nums">{q(d.saldoCapital)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Próxima cuota</p>
          <p className="text-base font-semibold tabular-nums">
            {d.proximaCuota ? `${q(d.proximaCuota.monto)} · ${d.proximaCuota.vencimiento}` : '—'}
          </p>
        </div>
      </section>

      {d.deuda && (
        <section className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-800">Cuota {d.deuda.cuotaNumero} vencida · total exigible</p>
          <p className="text-2xl font-bold tabular-nums text-red-900">{q(d.deuda.total)}</p>
          <p className="text-xs text-red-700 mt-1">
            Si paga después de hoy, el recargo seguirá creciendo por tramos.
          </p>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button onClick={irAMora} className="h-12 rounded-xl bg-white border border-slate-300 font-medium">
          Ver recargo por atraso
        </button>
        <button onClick={irAPago} className="h-12 rounded-xl bg-blue-700 text-white font-medium">
          Registrar pago
        </button>
      </div>
    </main>
  );
}