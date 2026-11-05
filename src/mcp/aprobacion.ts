/**
 * aprobacion.ts — E3 · Token de aprobación humana para registrar_pago.
 *
 * Menor privilegio: el servidor MCP es de SOLO LECTURA salvo que reciba un
 * secreto (CV_APROBACION_SECRETO) por variable de entorno. Aun con secreto,
 * registrar_pago solo se ejecuta si trae un token_aprobacion que es el
 * HMAC-SHA256 de exactamente ese pago (crédito, clave, monto y fecha).
 *
 * El token lo emite la API únicamente cuando una persona pulsa "Aprobar" en
 * la interfaz. El LLM nunca ve el secreto ni el token, así que no puede
 * aprobarse a sí mismo, y un token no sirve para otro monto u otro crédito.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface PagoFirmable {
  id_credito: string;
  clave_idempotencia: string;
  monto_centavos: number;
  fecha: string;
}

function mensaje(p: PagoFirmable): string {
  return `${p.id_credito}|${p.clave_idempotencia}|${p.monto_centavos}|${p.fecha}`;
}

export function firmarAprobacion(secreto: string, p: PagoFirmable): string {
  return createHmac('sha256', secreto).update(mensaje(p)).digest('hex');
}

export function verificarAprobacion(secreto: string, p: PagoFirmable, token: string): boolean {
  const esperado = Buffer.from(firmarAprobacion(secreto, p), 'hex');
  const recibido = Buffer.from(token, 'hex');
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
}
