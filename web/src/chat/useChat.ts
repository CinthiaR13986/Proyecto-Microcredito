import { useCallback, useState } from 'react';
import { agente, type FuenteCitada, type PropuestaPago, type TrazaHerramienta } from './agenteClient';

export interface MensajeChat {
  rol: 'usuario' | 'asistente' | 'sistema';
  texto: string;
  herramientas?: TrazaHerramienta[];
  fuentes?: FuenteCitada[];
  alertaSeguridad?: string;
}

const BIENVENIDA: MensajeChat = {
  rol: 'asistente',
  texto:
    'Hola, soy el asistente gerencial de Crédito Vecino. Consulto la cartera, cierres, créditos y mora a través del núcleo del sistema, explico las políticas citando su fuente y puedo proponer pagos, que siempre requieren tu aprobación.',
};

function describirResultado(r: unknown): string {
  const e = r as { error?: { codigo?: string; mensaje?: string } };
  if (e?.error) return `${e.error.codigo ?? 'ERROR'}: ${e.error.mensaje ?? ''}`;
  return JSON.stringify(r);
}

export function useChat() {
  // Sesión por pestaña: el servidor guarda la memoria de la conversación.
  const [sesion, setSesion] = useState(() => crypto.randomUUID());
  const [mensajes, setMensajes] = useState<MensajeChat[]>([BIENVENIDA]);
  const [cargando, setCargando] = useState(false);
  const [propuesta, setPropuesta] = useState<PropuestaPago | null>(null);

  const agregar = (m: MensajeChat) => setMensajes((prev) => [...prev, m]);

  const enviar = useCallback(
    async (texto: string) => {
      if (!texto.trim()) return;
      agregar({ rol: 'usuario', texto });
      setCargando(true);
      try {
        const r = await agente.conversar(sesion, texto);
        agregar({
          rol: 'asistente',
          texto: r.texto,
          herramientas: r.herramientas,
          fuentes: r.fuentes,
          ...(r.alertaSeguridad ? { alertaSeguridad: r.alertaSeguridad } : {}),
        });
        if (r.propuesta && r.propuesta.estado === 'pendiente') setPropuesta(r.propuesta);
      } catch (e) {
        agregar({ rol: 'sistema', texto: `Error: ${e instanceof Error ? e.message : 'desconocido'}` });
      } finally {
        setCargando(false);
      }
    },
    [sesion],
  );

  const aprobar = useCallback(async () => {
    if (!propuesta) return;
    setCargando(true);
    try {
      const r = await agente.aprobar(sesion, propuesta.id);
      if (r.ok) {
        const d = r.estadoDespues as { estado?: string; tramo?: string; diasAtraso?: number; saldoCapital?: { texto: string } } | undefined;
        agregar({
          rol: 'sistema',
          texto:
            `✅ Pago aprobado por una persona y registrado por el núcleo (clave ${propuesta.clave_idempotencia}).` +
            (d ? `\nEstado del crédito ${propuesta.id_credito} después del pago: ${d.estado}, ${d.diasAtraso} días de atraso, tramo ${d.tramo}, saldo de capital Q${d.saldoCapital?.texto}.` : ''),
          herramientas: r.traza,
        });
      } else {
        agregar({ rol: 'sistema', texto: `❌ El núcleo rechazó el pago — ${describirResultado(r.resultado)}`, herramientas: r.traza });
      }
    } catch (e) {
      agregar({ rol: 'sistema', texto: `❌ Error al registrar el pago: ${e instanceof Error ? e.message : 'desconocido'}` });
    } finally {
      setPropuesta(null);
      setCargando(false);
    }
  }, [propuesta, sesion]);

  const rechazar = useCallback(async () => {
    if (!propuesta) return;
    try {
      await agente.rechazar(sesion, propuesta.id);
    } finally {
      setPropuesta(null);
      agregar({ rol: 'sistema', texto: 'Operación cancelada por el usuario. No se registró ningún pago.' });
    }
  }, [propuesta, sesion]);

  const reiniciar = useCallback(async () => {
    await agente.reiniciar(sesion).catch(() => undefined);
    setSesion(crypto.randomUUID());
    setMensajes([BIENVENIDA]);
    setPropuesta(null);
  }, [sesion]);

  return { mensajes, cargando, enviar, propuesta, aprobar, rechazar, reiniciar };
}
