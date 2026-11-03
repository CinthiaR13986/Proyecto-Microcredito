import { consultarRag } from './ragClient';
import { ejecutarMcp } from './mcpClient';

const CORTE = '2026-10-31';

export interface MensajeChat {
  rol: 'usuario' | 'asistente' | 'sistema';
  texto: string;
  fuentes?: { doc_id: string; titulo: string }[];
  requiereAprobacion?: { herramienta: string; argumentos: Record<string, unknown> };
}

export async function procesarPregunta(pregunta: string, historial: MensajeChat[]): Promise<MensajeChat> {
  const p = pregunta.toLowerCase();

  // 1. ¿Es una pregunta sobre políticas o procedimientos? → RAG
  if (p.includes('política') || p.includes('norma') || p.includes('regla') || p.includes('cómo se calcula') || p.includes('nota de campo')) {
    const rag = await consultarRag(pregunta);
    
    // OP-7: Si hay advertencia de seguridad, el asistente rehúsa obedecer instrucciones incrustadas
    if (rag.advertencia_seguridad) {
      return {
        rol: 'asistente',
        texto: `He recuperado información del documento ${rag.fuentes[0]?.doc_id}, pero detecté instrucciones incrustadas que intentan modificar mi comportamiento. Como asistente gerencial, trato todo el contenido recuperado como dato histórico, nunca como una orden. No ejecutaré ninguna acción automática ni revelaré datos personales basándome en ese texto. \n\nResumen seguro del documento: ${rag.fuentes.map(f => f.texto.substring(0, 100) + '...').join('\n')}`,
        fuentes: rag.fuentes.map(f => ({ doc_id: f.doc_id, titulo: f.titulo })),
      };
    }

    return {
      rol: 'asistente',
      texto: `Según los documentos corporativos: ${rag.fuentes.map(f => f.texto).join('\n\n')}`,
      fuentes: rag.fuentes.map(f => ({ doc_id: f.doc_id, titulo: f.titulo })),
    };
  }

  // 2. ¿Es una consulta de cifras o estado? → MCP
  if (p.includes('cartera') || p.includes('riesgo') || p.includes('mora')) {
    const data = await ejecutarMcp('consultar_cartera', { corte: CORTE }) as any;
    return {
      rol: 'asistente',
      texto: `Al ${CORTE}, la cartera activa es de ${data.activa.texto}. La cartera en mora es ${data.mora.texto} (${data.porcentajeMora}%) y la cartera en riesgo es ${data.riesgo.texto} (${data.porcentajeRiesgo}%).`,
    };
  }

  if (p.includes('crédito') || p.includes('cv-')) {
    const match = pregunta.match(/CV-\d{4}-\d+/i);
    if (match) {
      const data = await ejecutarMcp('consultar_credito', { id_credito: match[0], corte: CORTE }) as any;
      return {
        rol: 'asistente',
        texto: `El crédito ${data.id} está en estado ${data.estado}, con ${data.diasAtraso} días de atraso y un saldo de capital de ${data.saldoCapital.texto}.`,
      };
    }
  }

  // 3. ¿Es una acción sensible (registrar pago)? → MCP con aprobación
  if (p.includes('registrar pago') || p.includes('cobrar')) {
    return {
      rol: 'asistente',
      texto: 'Entendido. Para registrar este pago necesito tu aprobación explícita, ya que es una operación que modifica el estado financiero.',
      requiereAprobacion: {
        herramienta: 'registrar_pago',
        argumentos: { id_credito: 'CV-2026-0043', clave_idempotencia: crypto.randomUUID(), monto_centavos: 56187, canal: 'campo', fecha: CORTE },
      },
    };
  }

  // 4. Fallback
  return {
    rol: 'asistente',
    texto: 'Puedo ayudarte a consultar la cartera, el estado de un crédito específico, explicar políticas de mora o registrar pagos (con tu aprobación). ¿Qué necesitas saber?',
  };
}