import { useEffect, useRef, useState } from 'react';
import { useChat, type MensajeChat } from './useChat';
import { ApprovalModal } from './ApprovalModal';

function argumentosCortos(a: Record<string, unknown>): string {
  return Object.entries(a)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(', ');
}

/** Evidencia del origen de cada cifra: qué herramienta del núcleo se llamó y con qué argumentos. */
function Trazas({ m }: { m: MensajeChat }) {
  if (!m.herramientas?.length) return null;
  return (
    <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
      <p className="text-[11px] font-semibold text-slate-500">🔧 Herramientas usadas</p>
      {m.herramientas.map((h, i) => (
        <code
          key={i}
          className={`block text-[11px] px-2 py-0.5 rounded break-all ${h.ok ? 'bg-slate-100 text-slate-700' : 'bg-red-50 text-red-700'}`}
        >
          {h.nombre}({argumentosCortos(h.argumentos)}){h.ok ? '' : ' → rechazado'}
        </code>
      ))}
    </div>
  );
}

function Fuentes({ m }: { m: MensajeChat }) {
  if (!m.fuentes?.length) return null;
  return (
    <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-600">
      <p className="font-semibold mb-1">📚 Fuentes consultadas</p>
      {m.fuentes.map((f) => (
        <p key={f.doc_id}>
          <b>{f.doc_id}</b> — {f.titulo} <span className="text-slate-400">({f.vigencia})</span>
        </p>
      ))}
    </div>
  );
}

export function ChatWidget() {
  const [abierto, setAbierto] = useState(false);
  const [input, setInput] = useState('');
  const { mensajes, cargando, enviar, propuesta, aprobar, rechazar, reiniciar } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [mensajes, cargando]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void enviar(input);
    setInput('');
  };

  return (
    <>
      <button
        onClick={() => setAbierto(!abierto)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-700 hover:bg-blue-800 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-40 transition-transform hover:scale-105"
        aria-label="Abrir asistente gerencial"
      >
        💬
      </button>

      {abierto && (
        <div className="fixed bottom-24 right-6 w-[520px] max-w-[calc(100vw-3rem)] h-[75vh] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col z-40 overflow-hidden">
          <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
            <div>
              <h3 className="font-semibold">Asistente gerencial</h3>
              <p className="text-xs text-slate-400">LLM vía OpenRouter · cifras del núcleo por MCP · políticas por RAG</p>
            </div>
            <div className="flex gap-3 items-center">
              <button onClick={() => void reiniciar()} className="text-xs text-slate-300 hover:text-white" title="Nueva conversación">
                ↺ Nueva
              </button>
              <button onClick={() => setAbierto(false)} className="text-slate-400 hover:text-white" aria-label="Cerrar">
                ✕
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {mensajes.map((m, i) => (
              <div key={i} className={`flex ${m.rol === 'usuario' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[90%] p-3 rounded-2xl text-sm ${
                    m.rol === 'usuario'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : m.rol === 'sistema'
                        ? 'bg-amber-50 border border-amber-200 text-slate-800'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'
                  }`}
                >
                  {m.alertaSeguridad && (
                    <p className="mb-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded p-2">
                      🛡️ {m.alertaSeguridad}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap">{m.texto}</p>
                  <Fuentes m={m} />
                  <Trazas m={m} />
                </div>
              </div>
            ))}
            {cargando && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-bl-none shadow-sm text-xs text-slate-500 flex items-center gap-2">
                  <span className="animate-spin">⏳</span> Consultando núcleo y documentos...
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-3 border-t border-slate-200 bg-white flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregunte sobre cartera, cierres, mora, políticas…"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={cargando || !!propuesta}
            />
            <button
              type="submit"
              disabled={cargando || !input.trim() || !!propuesta}
              className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              Enviar
            </button>
          </form>
        </div>
      )}

      {propuesta && <ApprovalModal propuesta={propuesta} onAprobar={() => void aprobar()} onRechazar={() => void rechazar()} cargando={cargando} />}
    </>
  );
}
