export function ApprovalModal({ onAprobar, onRechazar }: { onAprobar: () => void; onRechazar: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <h3 className="text-lg font-bold text-red-700">⚠️ Aprobación Humana Requerida</h3>
        <p className="text-sm text-slate-700">
          El asistente propone registrar un pago. Esta acción modifica el estado financiero del sistema y no puede deshacerse automáticamente.
        </p>
        <div className="bg-slate-50 p-3 rounded text-xs font-mono">
          Acción: registrar_pago<br/>
          Requiere: Confirmación explícita del comité
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onRechazar} className="flex-1 h-10 rounded-lg border border-slate-300 font-medium">Rechazar</button>
          <button onClick={onAprobar} className="flex-1 h-10 rounded-lg bg-emerald-700 text-white font-semibold">Aprobar y Ejecutar</button>
        </div>
      </div>
    </div>
  );
}