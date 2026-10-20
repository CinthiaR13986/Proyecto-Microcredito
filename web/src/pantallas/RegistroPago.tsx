import { useEffect, useState } from 'react';
import { api, q, ErrorApi, type DetalleDTO } from '../api/cliente';
import { CORTE } from '../api/corte';

type Paso = 'captura' | 'aprobacion' | 'recibo' | 'rechazo';

export function RegistroPago({ id, volver }: { id: string; volver: () => void }) {
  const [d, setD] = useState<DetalleDTO | null>(null);
  const [monto, setMonto] = useState('');
  const [paso, setPaso] = useState<Paso>('captura');
  const [rechazo, setRechazo] = useState<{ codigo: string; mensaje: string; correcto?: string; original?: any } | null>(null);
  const [recibo, setRecibo] = useState<any>(null);
  const [clave, setClave] = useState('');

  useEffect(() => {
    setPaso('captura');
    setRechazo(null);
    setRecibo(null);
    api
      .credito(id, CORTE)
      .then((x) => {
        setD(x);
        setMonto(x.deuda ? x.deuda.total.texto : '');
      })
      .catch((e: Error) => setRechazo({ codigo: 'ERROR', mensaje: e.message }));
  }, [id]);

  const confirmar = async () => {
    const centavos = Math.round(Number(monto.replace(',', '.')) * 100);
    const key = crypto.randomUUID();
    setClave(key);
    try {
      const r = await api.pagar({
        id_credito: id,
        clave_idempotencia: key,
        monto_centavos: centavos,
        canal: 'campo',
        fecha: CORTE,
      });
      setRecibo(r);
      setPaso('recibo');
    } catch (e) {
      if (e instanceof ErrorApi) {
        const det = e.detalles as any;
        setRechazo({
          codigo: e.codigo,
          mensaje: e.message,
          correcto: e.codigo === 'MONTO_NO_EXACTO' ? det?.montoCorrecto?.texto : undefined,
          original: e.codigo === 'PAGO_DUPLICADO' ? det?.original : undefined,
        });
      } else {
        setRechazo({ codigo: 'ERROR', mensaje: String(e) });
      }
      setPaso('rechazo');
    }
  };

  if (!d) return <p className="p-4">Cargando…</p>;

  return (
    <main className="p-4 max-w-md mx-auto space-y-4">
      <button onClick={volver} className="text-sm text-blue-700">← Volver al crédito</button>
      <h2 className="text-lg font-semibold">Registro de pago · {d.id}</h2>

      {paso === 'captura' && (
        <>
          {d.deuda ? (
            <section className="bg-white rounded-xl p-4 shadow-sm space-y-2">
              <p className="text-sm font-medium">Así se aplicará su pago (cuota {d.deuda.cuotaNumero}):</p>
              <p className="flex justify-between text-sm"><span>1 · Gastos de gestión</span><span className="tabular-nums">{q(d.deuda.gastos)}</span></p>
              <p className="flex justify-between text-sm"><span>2 · Recargo por atraso</span><span className="tabular-nums">{q(d.deuda.interesMoratorio)}</span></p>
              <p className="flex justify-between text-sm"><span>3 · Interés del período</span><span className="tabular-nums">{q(d.deuda.interesCorriente)}</span></p>
              <p className="flex justify-between text-sm"><span>4 · Capital</span><span className="tabular-nums">{q(d.deuda.capital)}</span></p>
              <p className="flex justify-between font-semibold border-t border-slate-200 pt-2"><span>Total exigible</span><span className="tabular-nums">{q(d.deuda.total)}</span></p>
            </section>
          ) : (
            <section className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
              Este crédito no tiene cuotas vencidas en el corte: no hay nada que cobrar por esta vía.
            </section>
          )}

          <label className="block text-sm font-medium" htmlFor="monto">Monto recibido (Q)</label>
          <input
            id="monto"
            inputMode="decimal"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="w-full h-14 rounded-xl border border-slate-300 px-4 text-xl tabular-nums"
          />
          <button
            disabled={!d.deuda}
            onClick={() => setPaso('aprobacion')}
            className="w-full h-12 rounded-xl bg-blue-700 text-white font-medium disabled:opacity-40"
          >
            Continuar
          </button>
        </>
      )}

      {paso === 'aprobacion' && d.deuda && (
        <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <h3 className="font-semibold">Aprobación humana requerida</h3>
          <p className="text-sm text-slate-600">
            Se registrará un pago de <strong className="tabular-nums">Q{monto}</strong> al crédito {d.id} con fecha {CORTE}.
            El sistema lo aplicará en este orden y no podrá deshacerse.
          </p>
          <p className="flex justify-between text-sm"><span>Gastos</span><span className="tabular-nums">{q(d.deuda.gastos)}</span></p>
          <p className="flex justify-between text-sm"><span>Recargo</span><span className="tabular-nums">{q(d.deuda.interesMoratorio)}</span></p>
          <p className="flex justify-between text-sm"><span>Interés</span><span className="tabular-nums">{q(d.deuda.interesCorriente)}</span></p>
          <p className="flex justify-between text-sm"><span>Capital</span><span className="tabular-nums">{q(d.deuda.capital)}</span></p>
          <button onClick={confirmar} className="w-full h-12 rounded-xl bg-emerald-700 text-white font-semibold">
            Aprobar y registrar el pago
          </button>
          <button onClick={() => setPaso('captura')} className="w-full h-12 rounded-xl bg-white border border-slate-300 font-medium">
            Corregir monto
          </button>
        </section>
      )}

      {paso === 'rechazo' && rechazo && (
        <section className="bg-red-50 border border-red-300 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-red-900">El pago no se registró · {rechazo.codigo}</h3>
          <p className="text-sm text-red-800">{rechazo.mensaje}</p>
          {rechazo.correcto && (
            <div className="bg-white rounded-lg p-3 text-sm">
              <p className="text-slate-600">Monto correcto al {CORTE}:</p>
              <p className="text-xl font-bold tabular-nums">Q{rechazo.correcto}</p>
              <button
                onClick={() => {
                  setMonto(rechazo.correcto!);
                  setPaso('captura');
                }}
                className="mt-2 w-full h-11 rounded-lg bg-blue-700 text-white font-medium"
              >
                Usar el monto correcto
              </button>
            </div>
          )}
          {rechazo.original && (
            <p className="text-xs text-red-700">
              Pago original: {rechazo.original.fecha} · Q{(Number(rechazo.original.monto_centavos) / 100).toFixed(2)} · canal {rechazo.original.canal}
            </p>
          )}
          <button onClick={() => setPaso('captura')} className="w-full h-11 rounded-lg bg-white border border-slate-300">
            Volver a capturar
          </button>
        </section>
      )}

      {paso === 'recibo' && recibo && (
        <section className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 space-y-2">
          <h3 className="font-semibold text-emerald-900">Pago registrado ✔</h3>
          <p className="text-sm text-emerald-800">Clave de idempotencia: {clave}</p>
          <p className="flex justify-between text-sm"><span>1 · Gastos</span><span className="tabular-nums">{q(recibo.aplicado?.gastos)}</span></p>
          <p className="flex justify-between text-sm"><span>2 · Recargo</span><span className="tabular-nums">{q(recibo.aplicado?.interesMoratorio)}</span></p>
          <p className="flex justify-between text-sm"><span>3 · Interés</span><span className="tabular-nums">{q(recibo.aplicado?.interesCorriente)}</span></p>
          <p className="flex justify-between text-sm"><span>4 · Capital</span><span className="tabular-nums">{q(recibo.aplicado?.capital)}</span></p>
          <p className="text-sm text-emerald-900 pt-2">
            Estado del crédito después del pago: <strong>{recibo.estadoResultante}</strong>
            {recibo.diasResultantes > 0 ? ` · ${recibo.diasResultantes} días de atraso` : ' · sin atraso'}
          </p>
          <button onClick={volver} className="w-full h-11 rounded-lg bg-white border border-slate-300">
            Volver al crédito
          </button>
        </section>
      )}
    </main>
  );
}