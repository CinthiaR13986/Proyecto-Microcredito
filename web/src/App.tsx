import { useState } from 'react';
import { CORTE } from './api/corte';
import { DetalleCredito } from './pantallas/DetalleCredito';
import { DetalleMora } from './pantallas/DetalleMora';
import { RegistroPago } from './pantallas/RegistroPago';
import { Gerencia } from './pantallas/Gerencia';
import { Solicitud } from './pantallas/Solicitud';

type Vista = 'inicio' | 'detalle' | 'mora' | 'pago' | 'solicitud';

const RAPIDOS = ['CV-2026-0043', 'CV-2026-0035', 'CV-2026-0061', 'CV-2026-0015'];

export default function App() {
  const [perfil, setPerfil] = useState<'asesor' | 'gerencia'>('asesor');
  const [vista, setVista] = useState<Vista>('inicio');
  const [creditoId, setCreditoId] = useState('CV-2026-0043');
  const [abierto, setAbierto] = useState('CV-2026-0043');

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
        <h1 className="font-semibold text-sm sm:text-base">
          Crédito Vecino · {perfil === 'asesor' ? 'Asesor de campo' : 'Gerencia'}
        </h1>
        <span className="text-xs bg-amber-100 text-amber-900 px-2 py-1 rounded whitespace-nowrap">
          Corte: {CORTE}
        </span>
        <div className="flex rounded-lg overflow-hidden border border-slate-300 text-xs">
          <button
            onClick={() => setPerfil('asesor')}
            className={`px-3 py-2 ${perfil === 'asesor' ? 'bg-slate-900 text-white' : 'bg-white'}`}
          >
            Asesor
          </button>
          <button
            onClick={() => setPerfil('gerencia')}
            className={`px-3 py-2 ${perfil === 'gerencia' ? 'bg-slate-900 text-white' : 'bg-white'}`}
          >
            Gerencia
          </button>
        </div>
      </header>

      {perfil === 'gerencia' ? (
        <Gerencia />
      ) : (
        <>
          {vista === 'inicio' && (
            <main className="p-4 max-w-md mx-auto space-y-4">
              <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
                <label className="block text-sm font-medium" htmlFor="cid">
                  Crédito del cliente
                </label>
                <input
                  id="cid"
                  value={creditoId}
                  onChange={(e) => setCreditoId(e.target.value)}
                  className="w-full h-12 rounded-lg border border-slate-300 px-3 text-base"
                  placeholder="CV-2026-0043"
                />
                <button
                  onClick={() => {
                    setAbierto(creditoId.trim());
                    setVista('detalle');
                  }}
                  className="w-full h-12 rounded-xl bg-blue-700 text-white font-medium"
                >
                  Abrir crédito
                </button>
              </section>

              <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
                <p className="text-sm font-medium">Originación (OP-3)</p>
                <button
                  onClick={() => setVista('solicitud')}
                  className="w-full h-12 rounded-xl bg-emerald-700 text-white font-medium"
                >
                  Nueva solicitud de crédito
                </button>
              </section>

              <section className="space-y-2">
                <p className="text-xs text-slate-500">Accesos rápidos del guion:</p>
                <div className="flex flex-wrap gap-2">
                  {RAPIDOS.map((id) => (
                    <button
                      key={id}
                      onClick={() => {
                        setAbierto(id);
                        setVista('detalle');
                      }}
                      className="text-xs bg-white border border-slate-300 rounded-full px-3 py-2"
                    >
                      {id}
                    </button>
                  ))}
                </div>
              </section>
            </main>
          )}
          {vista === 'detalle' && (
            <DetalleCredito
              id={abierto}
              irAMora={() => setVista('mora')}
              irAPago={() => setVista('pago')}
              volver={() => setVista('inicio')}
            />
          )}
          {vista === 'mora' && <DetalleMora id={abierto} volver={() => setVista('detalle')} />}
          {vista === 'pago' && <RegistroPago id={abierto} volver={() => setVista('detalle')} />}
          {vista === 'solicitud' && <Solicitud volver={() => setVista('inicio')} />}

          <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex justify-around py-2">
            {(
              [
                ['inicio', 'Inicio'],
                ['detalle', 'Crédito'],
                ['mora', 'Recargo'],
                ['pago', 'Pago'],
                ['solicitud', 'Nuevo'],
              ] as [Vista, string][]
            ).map(([v, etiqueta]) => (
              <button
                key={v}
                onClick={() => setVista(v)}
                className={`min-w-12 min-h-12 px-3 rounded-lg text-sm ${
                  vista === v ? 'bg-slate-900 text-white' : 'text-slate-700'
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </nav>
          <div className="h-20" />
        </>
      )}
    </div>
  );
}
