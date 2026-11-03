import { useState, useRef, useEffect } from 'react';
import { useChat } from './useChat';
import { ApprovalModal } from './ApprovalModal';

export function ChatWidget() {
  const [abierto, setAbierto] = useState(false);
  const [input, setInput] = useState('');
  const { mensajes, cargando, enviar, esperandoAprobacion, aprobarPago, rechazarPago } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [mensajes, cargando]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    enviar(input);
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
        <div className="fixed bottom-24 right-6 w-[400px] h-[600px] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col z-40 overflow-hidden">
          <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
            <div>
              <h3 className="font-semibold">Asistente Gerencial</h3>
              <p className="text-xs text-slate-400">Conectado a Núcleo P1 + RAG + MCP</p>
            </div>
            <button onClick={() => setAbierto(false)} className="text-slate-400 hover:text-white">✕</button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {mensajes.map((m, i) => (
              <div key={i} className={`flex ${m.rol === 'usuario' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                  m.rol === 'usuario' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'
                }`}>
                  <p className="whitespace-pre-wrap">{m.texto}</p>
                  {m.fuentes && m.fuentes.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-500">
                      <p className="font-semibold mb-1">📚 Fuentes citadas:</p>
                      {m.fuentes.map((f, j) => (
                        <span key={j} className="inline-block bg-slate-100 px-2 py-0.5 rounded mr-1 mb-1">{f.doc_id}</span>
                      ))}
                    </div>
                  )}
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
              placeholder="Pregunta sobre cartera, mora, políticas..."
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={cargando || !!esperandoAprobacion}
            />
            <button type="submit" disabled={cargando || !input.trim() || !!esperandoAprobacion} className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              Enviar
            </button>
          </form>
        </div>
      )}

      {esperandoAprobacion && <ApprovalModal onAprobar={aprobarPago} onRechazar={rechazarPago} />}
    </>
  );
}