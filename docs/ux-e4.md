# E4 · Decisión de arquitectura móvil/web y diseño responsivo

## 4.1 Decisión: PWA (Progressive Web App)

### Comparación contra el contexto real de cada perfil

| Criterio | Nativa | Híbrida (Capacitor/RN) | **PWA (elegida)** |
|---|---|---|---|
| Trabajo sin señal intermitente (asesor en campo) | Completa | Completa | **Completa**: Service Worker + IndexedDB |
| Instalación en Android gama media (2 GB RAM, poco almacenamiento) | Pesada (tienda, decenas de MB) | Media | **Ligera**: manifest + caché, pocos MB |
| Actualizaciones con 8–12 visitas/día (sin tiempo para actualizar) | Por tienda (lento, fricción) | Por tienda o mixto | **Silenciosa** al recargar (Service Worker) |
| Un solo código con el escritorio de gerencia | No (segundo frontend) | Parcial | **Sí**: misma app React responsiva |
| Proyecto Final (4 semanas, React + Vite + Tailwind) | Inviable | Viable con sobrecoste | **Directo**: la misma app + manifest/SW |
| Hardware necesario (cámara para DPI/documentos) | Completo | Completo | **Suficiente**: `input capture` / `getUserMedia` |
| Notificaciones push | Completas | Completas | Android sí; iOS solo PWA instalada (16.4+): limitación aceptada y documentada |
| Riesgo/costo para el equipo | Alto | Medio | **Bajo** |

### Decisión y trade-offs asumidos
Se adopta **PWA**: una única base de código React que sirve al asesor (móvil,
offline-first) y a la gerencia (escritorio, densidad alta), instalable desde el
navegador y actualizable sin tienda. Se aceptan dos limitaciones conscientes:
(1) push en iOS requiere PWA instalada — mitigado con recordatorios dentro de la
app y por WhatsApp operacional; (2) cuota de almacenamiento offline limitada —
mitigado sincronizando y purgando la cola tras cada envío exitoso.
Se descarta nativa por coste y doble código; se descarta híbrida porque no añade
nada que el contexto exija (no hay uso intensivo de hardware) y sí añade
distribución por tienda y fricción de actualización en campo.

## 4.2 Estrategia responsiva mobile-first

Breakpoints: base **360–430 px** (campo), **≥768 px** (tableta/ventanilla),
**≥1280 px** (gerencia). Se diseña primero el móvil y se **agrega** densidad hacia
arriba; nunca al revés.

### Transformación del tablero gerencial

| Elemento | Móvil (360–430) | Escritorio (≥1280) |
|---|---|---|
| Cartera en riesgo 7.00% | KPI grande primero: % + Q56,000 "de Q800,000" | KPI + barras comparativas por tramo |
| Desglose por tramo | Acordeón colapsable, una barra por tramo con monto y % | Tabla completa de tramos con créditos y saldos |
| Incobrable del período (Q15,000) | Fila de alerta bajo el KPI (nunca oculta) | Tarjeta contigua al KPI |
| Cartera en mora 21.75% | Bloque ámbar separado, con su definición en subtítulo | Bloque separado con definición y color propio |
| Desembolsos / recuperaciones | Dos tarjetas apiladas | Dos columnas |
| Asistente (Proyecto Final) | Botón flotante que abre hoja inferior | Panel lateral derecho fijo que no cubre KPI (WCAG 2.4.11) |
| Navegación | Barra inferior fija, 4 destinos + ayuda siempre en el mismo lugar (WCAG 3.2.6) | Menú lateral |

### Qué se sacrifica en la pantalla pequeña (decisión explícita)
1. Gráficas comparativas entre tramos y el histórico del período (quedan en escritorio).
2. Densidad tabular: las tablas se vuelven acordeones/tarjetas (legibilidad bajo sol antes que densidad).
3. El panel lateral del asistente pasa a hoja inferior.
4. Exportar/imprimir reportes (uso de oficina).
Nada de lo sacrificado es información de decisión: el % con su numerador, el
desglose y el incobrable **siempre** están visibles también en móvil.

## 4.3 Estrategia ante pérdida de conexión

Regla de experiencia: **el asesor nunca pierde un pago por falta de señal, y el
cliente nunca es cobrado dos veces por el mismo pago.**

1. Sin señal, el asesor captura el pago. La app calcula los rubros con
   **fechaCorte = fecha de captura** (el Reloj del dispositivo se usa solo como
   *parámetro*, nunca como "hoy" del núcleo).
2. La transacción se guarda en cola local (IndexedDB) con
   **clave de idempotencia UUID generada en la captura** y estado `EN_COLA`.
3. Feedback visible (heurística 1): banner *"Sin señal: pago guardado. Se enviará
   al reconectar."* El asesor sigue su ruta.
4. Al reconectar, el Service Worker reintenta `POST /pagos` con
   `X-Idempotency-Key: <uuid>` y la **fechaCorte viajando en el cuerpo** (P1: la
   fecha de corte es un parámetro, puerto Reloj). Reintentar con la misma clave
   **no cobra dos veces** (invariante 6.10 del P1); misma clave con cuerpo
   distinto → 409 y el asesor resuelve el conflicto.
5. Confirmación: estado `REGISTRADO` + comprobante con la prelación aplicada.

### La fecha de corte viaja con el pago (segunda decisión del P1)
Si el dispositivo calculó la mora con los días de ayer y sincroniza hoy, el
cálculo **no cambia**: el núcleo recalcula con la fechaCorte recibida, no con la
de llegada. Si entre captura y sincronización el crédito cruzó un tramo
(p. ej. capturado el día 30, sincronizado el 32), se honra el monto que el cliente
vio en el comprobante y la diferencia se registra como **línea de ajuste en el
cierre siguiente**, documentada en el mayor. El cliente nunca ve cambiar un monto
ya recibido.

### Qué puede ir en cola y qué no
| Operación | Offline | Por qué |
|---|---|---|
| Registrar pago | ✅ en cola con clave de idempotencia | Reducir deuda nunca es irreversible contra el cliente |
| Alta de cliente / solicitud | ✅ en cola | Datos capturables en campo |
| Desembolso | ❌ requiere conexión | Transacción financiera irreversible: exige confirmación y validación del servidor (WCAG 3.3.4) |
| Cierres | ❌ requiere conexión | Proceso de gerencia, en escritorio, con cifras congeladas |

## 4.4 Trazabilidad a decisiones del Proyecto 1
- `api/openapi.yaml`: header `X-Idempotency-Key` obligatorio en `POST /pagos` → sostiene el reintento sin doble cobro.
- `src/dominio/puertos.ts`: puerto `Reloj` → la fechaCorte es parámetro; por eso puede viajar con el pago y el núcleo la respeta.
- Núcleo sin `Date.now()`: el tramo depende de la fecha, así que esta decisión de experiencia **solo es viable porque el P1 ya inyectaba la fecha**.