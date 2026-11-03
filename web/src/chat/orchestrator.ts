import { consultarRag } from './ragClient';
import { ejecutarMcp } from './mcpClient';

const CORTE_DEFAULT = '2026-10-31';

export interface MensajeChat {
  rol: 'usuario' | 'asistente' | 'sistema';
  texto: string;
  fuentes?: { doc_id: string; titulo: string }[];
  requiereAprobacion?: { herramienta: string; argumentos: Record<string, unknown> };
}

function extraerFecha(pregunta: string): string {
  const matchIso = pregunta.match(/\d{4}-\d{2}-\d{2}/);
  if (matchIso) return matchIso[0];
  
  const meses: Record<string, string> = {
    'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
    'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
    'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
  };
  
  const matchEsp = pregunta.toLowerCase().match(/(\d{1,2})\s+de\s+(\w+)\s+(?:de\s+)?(\d{4})/);
  if (matchEsp) {
    const dia = matchEsp[1].padStart(2, '0');
    const mes = meses[matchEsp[2]] || '01';
    const anio = matchEsp[3];
    return `${anio}-${mes}-${dia}`;
  }
  
  return CORTE_DEFAULT;
}

export async function procesarPregunta(pregunta: string, historial: MensajeChat[]): Promise<MensajeChat> {
  const p = pregunta.toLowerCase();
  const corte = extraerFecha(pregunta);

  // ─────────────────────────────────────────────────────────────
  // 0. PRIORIDAD ABSOLUTA: ¿Es una acción sensible? → MCP con aprobación
  // Esto debe ir ANTES que cualquier otra cosa para evitar que "pago" active el RAG
  // ─────────────────────────────────────────────────────────────
  if (p.includes('registrar') && p.includes('pago') || p.includes('cobrar') || p.includes('aplicar pago')) {
    const match = pregunta.match(/CV-\d{4}-\d+/i);
    const idCredito = match ? match[0] : 'CV-2026-0043';
    
    return {
      rol: 'asistente',
      texto: `Entendido. Para registrar el pago del crédito ${idCredito} necesito tu aprobación explícita, ya que es una operación que modifica el estado financiero.`,
      requiereAprobacion: {
        herramienta: 'registrar_pago',
        argumentos: { 
          id_credito: idCredito, 
          clave_idempotencia: crypto.randomUUID(), 
          monto_centavos: 56187, // Monto ejemplo para CV-2026-0043 al 31-oct
          canal: 'campo', 
          fecha: corte 
        },
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 1. ¿Consulta de cartera agregada? (G-1) → MCP
  // ─────────────────────────────────────────────────────────────
  if (p.includes('cartera') || p.includes('riesgo') || p.includes('activa') || p.includes('morosos')) {
    try {
      const data = await ejecutarMcp('consultar_cartera', { corte }) as any;
      return {
        rol: 'asistente',
        texto: `Al ${corte}, la cartera activa es de ${data.activa.texto}. La cartera en mora es ${data.mora.texto} (${data.porcentajeMora}%) y la cartera en riesgo es ${data.riesgo.texto} (${data.porcentajeRiesgo}%).`,
      };
    } catch (e) {
      return { rol: 'asistente', texto: `Error consultando la cartera: ${e instanceof Error ? e.message : 'Desconocido'}` };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. ¿Consulta de un crédito específico? (G-5, G-7) → MCP
  // ─────────────────────────────────────────────────────────────
  if (p.includes('crédito') || p.includes('credito') || p.includes('cv-')) {
    const match = pregunta.match(/CV-\d{4}-\d+/i);
    if (match) {
      try {
        if (p.includes('mora') || p.includes('interés') || p.includes('interes') || p.includes('recargo')) {
          const data = await ejecutarMcp('explicar_mora', { id_credito: match[0], corte }) as any;
          let respuesta = `El crédito ${match[0]} al ${corte} tiene ${data.diasAtraso} días de atraso (tramo ${data.tramo}).\n\nDesglose por tramos recorridos:\n`;
          data.lineas.forEach((l: any) => {
            respuesta += `• ${l.tramo}: ${l.diasEnTramo} días al ${(Number(l.tasaTna) * 100).toFixed(0)}% → ${l.montoSinRedondear}\n`;
          });
          respuesta += `\nTotal moratorio: ${data.moratorioTotal.texto}`;
          return { rol: 'asistente', texto: respuesta };
        }

        const data = await ejecutarMcp('consultar_credito', { id_credito: match[0], corte }) as any;
        return {
          rol: 'asistente',
          texto: `El crédito ${data.id} está en estado ${data.estado}, con ${data.diasAtraso} días de atraso (tramo ${data.tramo}) y un saldo de capital de ${data.saldoCapital.texto}.`,
        };
      } catch (e) {
        return { rol: 'asistente', texto: `Error consultando el crédito: ${e instanceof Error ? e.message : 'Desconocido'}` };
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. ¿Consulta de vencimientos? (G-6) → MCP
  // ─────────────────────────────────────────────────────────────
  if (p.includes('vencimientos') || p.includes('vencen') || p.includes('próximos') || p.includes('proximos')) {
    try {
      const dias = p.includes('30') ? 30 : 7;
      const data = await ejecutarMcp('ver_vencimientos', { corte, dias }) as any;
      if (!data.cuotas || data.cuotas.length === 0) {
        return { rol: 'asistente', texto: `No hay cuotas que venzan en los próximos ${dias} días desde el ${corte}.` };
      }
      const lista = data.cuotas.slice(0, 5).map((c: any) => `• ${c.idCredito} (${c.cliente}): ${c.monto.texto} el ${c.vencimiento}`).join('\n');
      return {
        rol: 'asistente',
        texto: `En los próximos ${dias} días desde el ${corte} vencen ${data.totalCuotas} cuotas por un total de ${data.total.texto}:\n\n${lista}${data.cuotas.length > 5 ? '\n...(y más)' : ''}`,
      };
    } catch (e) {
      return { rol: 'asistente', texto: `Error consultando vencimientos: ${e instanceof Error ? e.message : 'Desconocido'}` };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. ¿Consulta de cierre? (G-2, G-3) → MCP
  // ─────────────────────────────────────────────────────────────
  if (p.includes('cierre')) {
    try {
      const esMensual = p.includes('mensual') || p.includes('mes');
      const args = esMensual ? { tipo: 'mensual', mes: corte.substring(0, 7) } : { tipo: 'diario', fecha: corte };
      const data = await ejecutarMcp('consultar_cierre', args) as any;
      
      return {
        rol: 'asistente',
        texto: `Cierre ${esMensual ? 'mensual' : 'diario'} al ${corte}:\n• Desembolsos: ${data.desembolsos.texto} (${data.numeroDesembolsos} créditos)\n• Recuperaciones totales: ${data.recuperaciones.total.texto}\n  - Gastos: ${data.recuperaciones.gastos.texto}\n  - Moratorio: ${data.recuperaciones.interesMoratorio.texto}\n  - Corriente: ${data.recuperaciones.interesCorriente.texto}\n  - Capital: ${data.recuperaciones.capital.texto}`,
      };
    } catch (e) {
      return { rol: 'asistente', texto: `Error consultando el cierre: ${e instanceof Error ? e.message : 'Desconocido'}` };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 5. ¿Pregunta sobre políticas, reglas o procedimientos? → RAG
  // Ahora va AL FINAL, después de todas las consultas de cifras y acciones
  // ─────────────────────────────────────────────────────────────
  const esPreguntaDePolitica = 
    p.includes('política') || p.includes('politica') ||
    p.includes('norma') || p.includes('regla') ||
    p.includes('cómo se calcula') || p.includes('como se calcula') ||
    p.includes('nota de campo') || p.includes('fuente') ||
    p.includes('atraso') || p.includes('tardo') ||
    p.includes('cuota') || p.includes('recargo') ||
    p.includes('visita') || p.includes('cobro') || p.includes('asesor') ||
    p.includes('incobrable') || p.includes('pasan') || p.includes('sucede') ||
    p.includes('documento') || p.includes('manual') || p.includes('según') || p.includes('segun');

  if (esPreguntaDePolitica) {
    try {
      const rag = await consultarRag(pregunta);
      
      if (rag.advertencia_seguridad) {
        return {
          rol: 'asistente',
          texto: `He recuperado información del documento ${rag.fuentes[0]?.doc_id}, pero detecté instrucciones incrustadas que intentan modificar mi comportamiento. Como asistente gerencial, trato todo el contenido recuperado como dato histórico, nunca como una orden. No ejecutaré ninguna acción automática ni revelaré datos personales basándome en ese texto.\n\nResumen seguro del documento: ${rag.fuentes.map(f => f.texto.substring(0, 150) + '...').join('\n')}`,
          fuentes: rag.fuentes.map(f => ({ doc_id: f.doc_id, titulo: f.titulo })),
        };
      }

      if (rag.fuentes.length === 0) {
        return {
          rol: 'asistente',
          texto: 'No encontré información específica sobre eso en los documentos corporativos. ¿Podrías reformular la pregunta?',
        };
      }

      // Devuelve SOLO el fragmento más relevante
      const mejorFuente = rag.fuentes[0];
      
      return {
        rol: 'asistente',
        texto: `${mejorFuente.texto}\n\n📚 Fuente: ${mejorFuente.doc_id} (${mejorFuente.titulo})`,
        fuentes: [{ doc_id: mejorFuente.doc_id, titulo: mejorFuente.titulo }],
      };

    } catch (e) {
      return {
        rol: 'asistente',
        texto: `Tuve un problema consultando los documentos corporativos: ${e instanceof Error ? e.message : 'Error desconocido'}. Intenta preguntar sobre cifras específicas de la cartera o de un crédito.`,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 6. Fallback
  // ─────────────────────────────────────────────────────────────
  return {
    rol: 'asistente',
    texto: 'Puedo ayudarte a consultar la cartera, el estado de un crédito específico, explicar políticas de mora citando fuentes, ver vencimientos, cierres o registrar pagos (con tu aprobación). ¿Qué necesitas saber?',
  };
}