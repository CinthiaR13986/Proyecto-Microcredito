/**
 * estado-credito.ts — Ciclo de vida del crédito (sección 6.7).
 *
 * Reglas de negocio (6.7 / 6.7.1):
 *  - Tabla de transiciones completa como código (patrón State, GoF):
 *    cualquier par (estado, evento) no listado lanza error.
 *    Las transiciones inválidas son imposibles por diseño, no por un if.
 *  - Los tramos de mora NO son estados: son clasificación derivada de
 *    los días vigentes (se calcula con clasificarTramo, reversible).
 *  - Todo cambio queda en historial append-only con fecha, usuario y
 *    motivo; nunca se borra (trazabilidad de auditoría).
 *  - La reestructuración no borra el pasado: el crédito queda marcado
 *    y sigue contando en cartera en riesgo aunque vuelva a vigente (6.8).
 *  - Incobrable es baja CONTABLE: el crédito no regresa a cartera.
 */
import { clasificarTramo, type TramoMora } from './calculadora-mora';

export type EstadoCredito =
  | 'solicitado'
  | 'aprobado'
  | 'vigente'
  | 'en_mora'
  | 'reestructurado'
  | 'cancelado'
  | 'incobrable'
  | 'rechazado'
  | 'anulado';

export type EventoCredito =
  | { tipo: 'APROBAR' }
  | { tipo: 'RECHAZAR' }
  | { tipo: 'DESEMBOLSAR' }
  | { tipo: 'ANULAR' }
  | { tipo: 'ATRASO'; dias: number }
  | { tipo: 'PAGO'; nuevosDiasAtraso: number }
  | { tipo: 'PAGO_ULTIMA_CUOTA' }
  | { tipo: 'REESTRUCTURAR' }
  | { tipo: 'CUMPLE_PLAN' }
  | { tipo: 'DECLARAR_INCOBRABLE'; dias: number };

/** Estados de salida definitiva: no aceptan ningún evento. */
export const esTerminal = (e: EstadoCredito): boolean =>
  e === 'cancelado' || e === 'incobrable' || e === 'rechazado' || e === 'anulado';

/**
 * Tabla 6.7.1 hecha código. Si el par (estado, evento) no existe aquí,
 * la transición es inválida y se lanza error (invariante 6.10).
 */
export function siguienteEstado(
  estado: EstadoCredito,
  evento: EventoCredito,
): EstadoCredito {
  switch (estado) {
    case 'solicitado':
      if (evento.tipo === 'APROBAR') return 'aprobado';
      if (evento.tipo === 'RECHAZAR') return 'rechazado';
      break;
    case 'aprobado':
      if (evento.tipo === 'DESEMBOLSAR') return 'vigente';
      if (evento.tipo === 'ANULAR') return 'anulado';
      break;
    case 'vigente':
      if (evento.tipo === 'ATRASO' && evento.dias >= 1) return 'en_mora';
      if (evento.tipo === 'PAGO') return 'vigente'; // pago puntual: sigue vigente
      if (evento.tipo === 'PAGO_ULTIMA_CUOTA') return 'cancelado';
      break;
    case 'en_mora':
      if (evento.tipo === 'PAGO' && evento.nuevosDiasAtraso >= 0) {
        return evento.nuevosDiasAtraso === 0 ? 'vigente' : 'en_mora';
      }
      if (evento.tipo === 'ATRASO' && evento.dias >= 1) return 'en_mora';
      if (evento.tipo === 'REESTRUCTURAR') return 'reestructurado';
      if (evento.tipo === 'DECLARAR_INCOBRABLE' && evento.dias > 120) {
        return 'incobrable';
      }
      break;
    case 'reestructurado':
      if (evento.tipo === 'ATRASO' && evento.dias >= 1) return 'en_mora';
      if (evento.tipo === 'PAGO') return 'reestructurado';
      if (evento.tipo === 'CUMPLE_PLAN') return 'vigente';
      if (evento.tipo === 'PAGO_ULTIMA_CUOTA') return 'cancelado';
      break;
    default:
      break; // terminales: no aceptan eventos
  }
  throw new Error(
    `Transición inválida por diseño (6.7): '${estado}' no acepta el evento '${evento.tipo}'`,
  );
}

/** Registro de trazabilidad (6.7): fecha, usuario/proceso y motivo. */
export interface RegistroEstado {
  readonly estado: EstadoCredito;
  readonly fecha: string; // inyectada (puerto Reloj): el núcleo no lee el sistema
  readonly usuario: string;
  readonly motivo: string;
}

/**
 * Agregado inmutable del crédito: aplicar() devuelve un Credito NUEVO
 * con el historial extendido. El historial nunca se sobrescribe ni se borra.
 */
export class Credito {
  private constructor(
    readonly id: string,
    private readonly estado: EstadoCredito,
    private readonly diasAtraso: number,
    private readonly historial: readonly RegistroEstado[],
    readonly marcadoReestructurado: boolean,
  ) {}

  /** Punto de entrada del ciclo: todo crédito nace 'solicitado'. */
  static solicitar(id: string, fecha: string, usuario: string): Credito {
    return new Credito(
      id,
      'solicitado',
      0,
      [{ estado: 'solicitado', fecha, usuario, motivo: 'Solicitud registrada' }],
      false,
    );
  }

  get estadoActual(): EstadoCredito {
    return this.estado;
  }

  get diasDeAtraso(): number {
    return this.diasAtraso;
  }

  get esReestructurado(): boolean {
    return this.marcadoReestructurado;
  }

  get historialEstados(): readonly RegistroEstado[] {
    return this.historial;
  }

  /** El tramo es derivado, no estado (6.7): se calcula desde los días vigentes. */
  get tramo(): TramoMora {
    return this.estado === 'en_mora' ? clasificarTramo(this.diasAtraso) : 'AL_DIA';
  }

  /** Invariante 6.10: solo vigente / en_mora / reestructurado reciben pagos. */
  puedeRecibirPago(): boolean {
    return (
      this.estado === 'vigente' ||
      this.estado === 'en_mora' ||
      this.estado === 'reestructurado'
    );
  }

  /** Aplica un evento validado y devuelve el crédito en su nueva versión. */
  aplicar(evento: EventoCredito, fecha: string, usuario: string): Credito {
    const nuevoEstado = siguienteEstado(this.estado, evento);
    const registro: RegistroEstado = {
      estado: nuevoEstado,
      fecha,
      usuario,
      motivo: evento.tipo,
    };
    return new Credito(
      this.id,
      nuevoEstado,
      this.diasSegun(evento),
      [...this.historial, registro],
      this.marcadoReestructurado || evento.tipo === 'REESTRUCTURAR',
    );
  }

  private diasSegun(evento: EventoCredito): number {
    switch (evento.tipo) {
      case 'ATRASO':
        return evento.dias;
      case 'PAGO':
        return evento.nuevosDiasAtraso;
      case 'DECLARAR_INCOBRABLE':
        return evento.dias;
      default:
        return this.diasAtraso;
    }
  }
}