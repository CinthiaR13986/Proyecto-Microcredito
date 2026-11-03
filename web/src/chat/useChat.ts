import { useState, useCallback } from 'react';
import { procesarPregunta, type MensajeChat } from './orchestrator';
import { ejecutarMcp } from './mcpClient';

export function useChat() {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([
    { rol: 'asistente', texto: 'Hola, soy el asistente gerencial de Crédito Vecino. Puedo responder consultas sobre la cartera (G-1 a G-8), explicar políticas citando fuentes, o ayudarte a registrar pagos con tu aprobación.' },
  ]);
  const [cargando, setCargando] = useState(false);
  const [esperandoAprobacion, setEsperandoAprobacion] = useState<MensajeChat['requiereAprobacion'] | null>(null);

  const enviar = useCallback(async (texto: string) => {
    if (!texto.trim()) return;
    const nuevoMensaje: MensajeChat = { rol: 'usuario', texto };
    setMensajes((prev) => [...prev, nuevoMensaje]);
    setCargando(true);

    try {
      const respuesta = await procesarPregunta(texto, mensajes);
      
      if (respuesta.requiereAprobacion) {
        setEsperandoAprobacion(respuesta.requiereAprobacion);
        setMensajes((prev) => [...prev, { ...respuesta, texto: respuesta.texto + ' (Esperando aprobación...)' }]);
      } else {
        setMensajes((prev) => [...prev, respuesta]);
      }
    } catch (e) {
      setMensajes((prev) => [...prev, { rol: 'asistente', texto: `Error: ${e instanceof Error ? e.message : 'Desconocido'}` }]);
    } finally {
      setCargando(false);
    }
  }, [mensajes]);

  const aprobarPago = useCallback(async () => {
    if (!esperandoAprobacion) return;
    setCargando(true);
    try {
      await ejecutarMcp(esperandoAprobacion.herramienta, esperandoAprobacion.argumentos, true);
      setMensajes((prev) => [...prev, { rol: 'asistente', texto: '✅ Pago registrado correctamente con aprobación humana. El estado del crédito ha sido actualizado.' }]);
    } catch (e) {
      setMensajes((prev) => [...prev, { rol: 'asistente', texto: `❌ Error al registrar el pago: ${e instanceof Error ? e.message : 'Desconocido'}` }]);
    } finally {
      setEsperandoAprobacion(null);
      setCargando(false);
    }
  }, [esperandoAprobacion]);

  const rechazarPago = useCallback(() => {
    setEsperandoAprobacion(null);
    setMensajes((prev) => [...prev, { rol: 'asistente', texto: 'Operación cancelada por el usuario.' }]);
  }, []);

  return { mensajes, cargando, enviar, esperandoAprobacion, aprobarPago, rechazarPago };
}