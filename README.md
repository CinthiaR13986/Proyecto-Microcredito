# Crédito Vecino, S. A. — Sistema de microcrédito con asistente gerencial inteligente

**Proyecto Final · Análisis de Sistemas II (037) · Segundo semestre 2026**
Grupo No. **[4]** · Integrantes: **[Cinthia Robles] · [Frederick Montiel] · [Heldris Yanes] · [Ezequiel Castro] · [Jermy Pinto]**

El mismo sistema y el mismo repositorio del Proyecto 1 y del Proyecto 2.
El núcleo de cálculo **no se reescribió**: se le agregaron la interfaz implementada,
la persistencia con carga canónica, el servidor MCP, el RAG con citación y el chat
gerencial (regla de incrementalidad del enunciado).

---

## 1. Qué es

Cartera de microcrédito al **31 de octubre de 2026** (paquete canónico: 60 clientes,
75 créditos, 228 pagos) operada por una aplicación React + API + núcleo TypeScript,
con un asistente gerencial que:

- consulta cifras **solo** a través del núcleo del P1 (vía herramientas MCP),
- explica políticas **citando el documento** del corpus (RAG),
- **nunca** ejecuta una acción sensible sin aprobación humana visible,
- trata todo contenido recuperado como **dato, nunca como instrucción** (OP-7).

## 2. Estructura del repositorio (Anexo C)

```
credito-vecino/                  el mismo repositorio desde el Proyecto 1
├─ src/dominio/                  núcleo del P1, evolucionado en el P2 — NO se reescribe
│  └─ politica-mora/             catálogo de políticas del P2 (CP-01 a CP-04)
├─ src/api/                      puertos primarios expuestos como API REST (Express 5 + Zod)
├─ src/persistencia/             E2 — esquema PostgreSQL y cargador canónico
├─ src/mcp/                      E3 — servidor MCP sobre los puertos del P1
├─ src/rag/                      E4 — ingesta, recuperación y citación (pgvector)
├─ src/servicios/                E1 — reconstructor de cartera y reportes de gerencia
├─ tests/                        suite del P1 y del P2 — sigue pasando intacta
│  ├─ carga.test.ts              E6 — conteos, idempotencia y huella SHA-256
│  ├─ mcp.test.ts                E6 — el MCP devuelve lo mismo que el núcleo
│  └─ evals/asistente.test.ts    E6 — preguntas con respuesta esperada (oráculo)
├─ web/                          E1 — interfaz React (las 7 pantallas del P2)
│  └─ src/chat/                  E5 — chat gerencial dentro de la interfaz
└─ datos/                        paquete canónico, sin modificar
```

## 3. Requisitos

| Herramienta | Versión | Para qué |
|---|---|---|
| Node.js | 22 LTS | runtime único de API, MCP, cargador y pruebas |
| PostgreSQL | 16+ con extensión **pgvector** | base del sistema + vectores del RAG |
| Ollama | cualquier versión reciente | embeddings locales (`nomic-embed-text`) |

> Decisión de stack: se eligió **PostgreSQL + pgvector** (permitido por el enunciado)
> porque la variante embebida disponible no incluía la extensión `vector` compilada.
> El núcleo no depende del motor: solo el adaptador `src/persistencia/conexion.ts` lo conoce.

## 4. Instalación

```bash
git clone <url-del-repo> && cd credito-vecino
npm install                 # backend, núcleo y pruebas
cd web && npm install && cd ..

# Base de datos (una sola vez)
createdb credito_vecino
psql -d credito_vecino -c "CREATE EXTENSION IF NOT EXISTS vector;"
createdb credito_vecino_test   # solo para pruebas de fixtures

# Embeddings locales (una sola vez)
ollama pull nomic-embed-text
```

## 5. Carga canónica (E2)

```bash
export CV_DATA_DIR=datos        # en PowerShell: $env:CV_DATA_DIR = "datos"
npm run cargar
```

Salida esperada:

```
✔ SHA-256 verificado: e2d46283de8578f19ea2eb14ace283573ebb729aaa0e9b0e65f80a348e4b9d50
✔ Carga canónica completa: 60 clientes, 75 créditos, 228 pagos en bitácora
  (226 aplicados; 2 reintentos ignorados por idempotencia).
```

- El cargador **verifica la huella SHA-256 de `eventos.jsonl` antes de cargar** y se detiene si no coincide.
- Es **idempotente**: ejecutarlo dos veces no duplica la cartera (tabla `carga_meta`).
- Los pagos con `clave_idempotencia` repetida se conservan en la bitácora (mayor
  append-only, P1 6.9) pero **su efecto se ignora** (P1 6.10): 228 filas, 226 aplicados.
- **Después de la carga el paquete no se toca nunca más**: todo cambio entra por la interfaz.

## 6. Ingesta del corpus (E4)

```bash
npm run rag:ingerir
```

- **Fragmentación:** semántica por bloques lógicos. Los documentos con preguntas
  (`FAQ-CLIENTES-01`) se fragmentan **una pregunta = un fragmento**; el resto por
  secciones y, como último recurso, por ventana de 500 caracteres con solapamiento
  de 100. Razón: cortar un FAQ por caracteres devuelve respuestas vecinas
  irrelevantes; por pregunta, la cita es exacta.
- **Embeddings:** `nomic-embed-text` (768 dimensiones) vía **Ollama local**.
  Razón: gratuito, corre en la máquina del equipo y no envía documentos de la
  empresa a la nube; suficiente para un corpus acotado de dominio. (`bge-m3`
  maneja mejor el español y queda como mejora documentada.)
- **Recuperación:** similitud coseno sobre `pgvector`, top-k = 3; la respuesta cita
  `doc_id` y título del fragmento usado.
- **Seguridad:** el contenido recuperado se trata como **dato, nunca como
  instrucción**. `NOTA-CAMPO-07.md` (instrucciones incrustadas, caso OP-7) se
  ingiere como cualquier documento; el recuperador marca `advertencia_seguridad`
  y el asistente rehúsa obedecer y no revela datos personales.

## 7. Levantar la aplicación

```bash
# Terminal 1 — API + proxy de herramientas MCP
npm run api            # http://localhost:8080

# Terminal 2 — interfaz React (las 7 pantallas + chat)
cd web && npm run dev  # http://localhost:5173

# Terminal 3 — embeddings (si aún no corre)
ollama serve
```

Perfiles: **Asesor** (móvil: solicitud, detalle, mora, pago, plan) y
**Gerencia** (escritorio: tablero, cierres, chat). La fecha de corte visible en
pantalla es siempre **2026-10-31**; el sistema nunca lee el reloj (puerto Reloj del P1).

## 8. Variables de entorno

| Variable | Por defecto | Uso |
|---|---|---|
| `CV_DATA_DIR` | — (obligatoria para cargar) | Ruta al paquete canónico; nunca incrustada en código |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/credito_vecino` | Base del sistema y del RAG |
| `TEST_DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/credito_vecino_test` | Base aislada para pruebas de fixtures |

## 9. Scripts

| Script | Qué hace |
|---|---|
| `npm test` | Suite completa: P1 + P2 + cargador + MCP + RAG + evals del asistente |
| `npm run cargar` | Carga canónica con verificación SHA-256 e idempotencia |
| `npm run rag:ingerir` | Ingesta de los 7 documentos del corpus al almacén vectorial |
| `npm run api` | API REST (Express 5) sobre los puertos del P1 |
| `npm run mcp` | Servidor MCP standalone (stdio) |
| `npm run verificar` | Imprime el estado de créditos clave al corte (sanity check) |
| `npm run db:reset` | Borra la base embebida de desarrollo |
| `npm run demo` / `demo:mora` / `reporte` | Consolas de demostración del núcleo (P1/P2) |

## 10. Correspondencia pantalla ↔ caso de uso (Proyecto 2, sección 6.1 — actualizada)

| Pantalla implementada (React) | Caso de uso / puerto primario (P1) | Perfil | Formato |
|---|---|---|---|
| Solicitud de crédito (alta de cliente como paso 1) | SolicitarCredito · DesembolsarCredito | Asesor | Móvil |
| Detalle del crédito | RegistrarPago (consulta de saldo, tramo y estado) | Asesor/Cliente | Móvil |
| Registro de pago + comprobante con prelación | RegistrarPago | Asesor | Móvil |
| Plan de amortización (cuota 12 ajustada, explicada) | SolicitarCredito (simulación) · DesembolsarCredito (confirmación) | Asesor/Cliente | Móvil |
| Detalle de la mora (tramos recorridos) | CalcularMora (incluido en RegistrarPago y GenerarCierre) | Cliente/Asesor | Móvil |
| Tablero gerencial (activa, mora, riesgo por tramo, incobrable) | ConsultarCarteraEnRiesgo | Gerencia | Escritorio |
| Cierre diario / mensual (recuperaciones por concepto) | GenerarCierre | Gerencia | Escritorio |

Flujos navegables reales: **originación**, **cobro en campo** y **consulta gerencial**.
Ninguna cifra se calcula en la interfaz: todas vienen de la API, que las pide al núcleo.

## 11. Servidor MCP (E3) — menor privilegio y aprobación humana

Ocho capacidades sobre los puertos del P1, con esquemas Zod compartidos con la API:

| Herramienta | Devuelve | Se ejercita en |
|---|---|---|
| `consultar_credito` | Estado, saldo, días, tramo, cuotas, próxima cuota | G-5 |
| `calcular_deuda` | Desglose gastos/moratorio/corriente/capital y total exigible | OP-1, OP-2 |
| `explicar_mora` | Capital en mora y tramos recorridos con días y tasa | G-5, G-7 |
| `listar_morosos` | Créditos con días, tramo y saldo; filtrable por tramo | G-4 |
| `ver_vencimientos` | Cuotas en ventana de días; total y monto | G-6 |
| `consultar_cartera` | Activa, mora, riesgo por tramo, incobrable del período | G-1 |
| `consultar_cierre` | Desembolsos y recuperaciones por concepto (diario/mensual) | G-2, G-3 |
| `registrar_pago` (**sensible**) | Aplica prelación e idempotencia; **exige aprobación humana** | OP-1 a OP-6 |

Solo lectura por defecto. Toda herramienta recibe la **fecha de corte como
parámetro**. Errores uniformes: `CREDITO_INEXISTENTE`, `CUOTA_YA_PAGADA`,
`CREDITO_INCOBRABLE`, `MONTO_NO_EXACTO` (con el monto correcto), `PAGO_DUPLICADO`,
`FECHA_INVALIDA`, `APROBACION_REQUERIDA`.

## 12. Chat gerencial (E5)

Vive **dentro** de la aplicación (panel del tablero gerencial), mantiene memoria de
sesión y orquesta: RAG para políticas y procedimientos (con cita), herramientas MCP
para cifras, y modal de **aprobación humana** para cualquier pago. Las consultas
G-1 a G-5 coinciden exactamente con sus pantallas porque ambas leen del mismo
núcleo (doble verificación). G-6, G-7 y G-8 solo existen en el chat.

## 13. Pruebas y evals (E6)

`npm test` ejecuta: la suite heredada del P1/P2 **intacta**, las pruebas del
cargador (conteos 60/75/228, idempotencia, huella), las del servidor MCP (devuelve
lo mismo que el núcleo y rechaza lo que debe), las del RAG (7 documentos, cita
correcta en G-8, OP-7 detectado) y `tests/evals/asistente.test.ts`: un conjunto de
preguntas de gerencia con **respuesta esperada** (oráculo del núcleo) que se corre
de forma repetible.

## 14. Modelo de lenguaje y herramientas de IA usadas

- **Embeddings:** `nomic-embed-text` vía Ollama, 100 % local.
- **Generación de respuestas:** orquestador **determinista en TypeScript**
  (`web/src/chat/orchestrator.ts`): reglas explícitas deciden si la pregunta va al
  RAG o a una herramienta MCP; las cifras las pone siempre el núcleo del P1.
  Razón: en un dominio financiero, una cifra alucinada es un defecto grave; la
  determinística garantiza reproducibilidad y coincidencia tablero ↔ chat.
  Limitación conocida: menor flexibilidad conversacional que un LLM generativo.
- **Apoyo al equipo:** Qwen3.8 (planificación, revisión de código y borradores de
  documentación). Todo el código entregado fue comprendido y puede ser defendido
  por los cuatro integrantes (sección 11 del enunciado).

## 15. Limitaciones conocidas

- Orquestador determinista (sin LLM generativo redactando): ver sección 14.
- Embeddings `nomic-embed-text`: para corpus más amplios en español conviene `bge-m3`.
- Sin autenticación empresarial: solo se distinguen los perfiles asesor y gerencia (fuera de alcance, 3.1).
- El sistema corre en la máquina del equipo; no hay despliegue en la nube (fuera de alcance, 3.1).