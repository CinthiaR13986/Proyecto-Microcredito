# Sistema de Gestión de Microcrédito — Crédito Vecino, S. A.

**Proyecto 1 — Arquitectura y diseño de componentes**
Análisis de Sistemas II (037) · Universidad Mariano Gálvez de Guatemala · Segundo semestre 2026

**Autora:** Cinthia Robles, Jermy Pinto, Ezequiel Castro, Frederick Montiel, Heldris Yanes"· **Carné:** 7690-16-13986 · **Sección:** 037 · Modalidad sabatina
**Repositorio:** [https://github.com/tu-usuario/Proyecto-Microcredito]

---

## Descripción

Diseño arquitectónico y **núcleo de cálculo ejecutable** (*walking skeleton*) para un
sistema de gestión de microcréditos (Q1,000–Q25,000 · 3–24 meses). El núcleo implementa,
como **funciones puras en TypeScript**, las reglas financieras del dominio y reproduce
**exactamente** los casos de referencia obligatorios del enunciado:

| Caso | Qué verifica | Resultado esperado |
|---|---|---|
| 6.4.1 | Tabla de amortización francesa (12 filas, celda por celda) | Cuota Q1,004.62 y cuota 12 Q1,004.63 (ajuste de cuadre) |
| 6.4 / 6.10 | Invariantes | Σ amortizaciones = P exacto · saldo final = 0.00 exacto |
| 6.5 | Interés moratorio (solo capital en mora, sin anatocismo) | Q7.26 |
| 6.6 | Prelación de pagos (escenarios A, B y C) | Q1,011.88 · Q500.00 · Q3,000.00 |
| 6.7 | Ciclo de vida reversible + transiciones inválidas imposibles | Mora 2 → Mora 1 → vigente |
| 6.8.1 | Cartera en riesgo | 7.00% y 6.06% tras incobrable |

## Stack tecnológico

| Capa | Herramienta |
|---|---|
| Runtime | Node.js 20 LTS o superior |
| Lenguaje | TypeScript (`"strict": true` obligatorio, sin `any` en el dominio) |
| Pruebas | Vitest |
| Dinero | decimal.js (Value Object inmutable `Dinero`; nunca `Number` flotante) |
| Validación | Zod (esquemas derivados del contrato OpenAPI) |
| Diagramas | PlantUML (editables en `diagramas/`) |
| API | OpenAPI 3.0 (`api/openapi.yaml`, validado en Swagger Editor) |

## Cómo ejecutar

### Requisitos previos
- Node.js 20 LTS+ (`node --version`) y npm.

### Instalación y pruebas (aceptación de E4)

```bash
npm install
npm test          # 40 pruebas en verde; imprime tablas 6.4.1 y 6.8.1 en consola
```

> El núcleo **no requiere servidor ni base de datos**: corre con funciones puras
> y reloj fijo (puerto `Reloj`). Ningún archivo de `src/dominio/` importa
> `express`, `pg` ni `http`, y ninguno lee la fecha del sistema.

### Otros scripts

| Comando | Qué hace |
|---|---|
| `npm run lint` | Verificación de tipos sin emitir archivos (`tsc --noEmit`) |
| `npm run build` | Compila el proyecto (`tsc`) |
| `npm run demo` | Simulación guiada en consola (plan, mora, prelación, ciclo de vida, cartera) |
| `npm run demo -- 90` | Idem, simulando 90 días de atraso |
| `npm run reporte` | Imprime el reporte completo **y** genera `docs/reportes/reporte-e4.md` |
| `npm run interactivo` | Consola interactiva: el usuario ingresa sus propios datos |

### Ver los diagramas
Los archivos `.puml` de `diagramas/` se renderizan en https://www.plantuml.com/plantuml
(las imágenes para el PDF están en `docs/img/`).

### Validar el contrato de API
Pegue `api/openapi.yaml` en https://editor.swagger.io/ → despliega sin errores.

## Estructura del repositorio (Anexo C)

```
Proyecto-Microcredito/
├── README.md                  → este archivo (descripción, ejecución, IA usada)
├── package.json               → scripts: test, lint, build, demo, reporte, interactivo
├── tsconfig.json              → "strict": true (obligatorio)
├── vitest.config.ts
├── src/
│   ├── dominio/               → núcleo puro (E4), sin infraestructura
│   │   ├── dinero.ts          → Value Object Dinero (6.2)
│   │   ├── plan-amortizacion.ts → Strategy francés + ajuste última cuota (6.4)
│   │   ├── calculadora-mora.ts  → interés moratorio y tramos (6.5)
│   │   ├── prelacion-pago.ts    → Chain of Responsibility (6.6)
│   │   ├── cartera.ts           → cartera en riesgo (6.8)
│   │   ├── estado-credito.ts    → State: ciclo de vida y trazabilidad (6.7)
│   │   ├── puertos.ts           → puertos secundarios: Reloj, Repositorio, Ids
│   │   └── index.ts             → barril de exportación
│   └── demo/                  → adaptadores primarios de demostración
│       ├── consola.ts         → npm run demo
│       ├── reporte.ts         → npm run reporte (consola + archivo)
│       └── interactivo.ts     → npm run interactivo
├── tests/                     → pruebas unitarias con los casos de referencia
│   ├── dinero.test.ts
│   ├── plan-amortizacion.test.ts  → caso 6.4.1 + invariantes 6.10
│   ├── mora.test.ts               → Q7.26 (6.5)
│   ├── prelacion.test.ts          → escenarios A/B/C (6.6)
│   ├── cartera.test.ts            → 7.00% y 6.06% (6.8.1)
│   └── estados.test.ts            → reversibilidad + transición inválida (6.7)
├── docs/
│   ├── arquitectura-e2.md     → E2: ISO/IEC 25010, 4+1, C4 (N1–N3)
│   ├── diseno-e3.md           → E3: módulos, SOLID, GRASP, patrones, cohesión
│   ├── matriz-trazabilidad.md → E1: requisito → caso de uso → clase
│   ├── img/                   → PNG de diagramas para el PDF (E6)
│   └── reportes/reporte-e4.md → evidencia generada (npm run reporte)
├── diagramas/                 → UML y C4 editables (E1/E2)
│   ├── casos-de-uso.puml · clases-dominio.puml
│   ├── secuencia-pago.puml · secuencia-desembolso.puml
│   ├── estados-credito.puml · actividad-cierre-mensual.puml
│   ├── c4-nivel1-contexto.puml · c4-nivel2-contenedores.puml · c4-nivel3-componentes.puml
│   └── modulo-calculo.puml · patron-strategy.puml · patron-chain.puml
│       · patron-state.puml · patron-factory.puml
├── adr/
│   ├── ADR-001.md             → Arquitectura hexagonal + monolito modular
│   └── ADR-002.md             → Dinero sobre decimal.js (nunca Number)
└── api/
    └── openapi.yaml           → E5: contratos con idempotencia y errores uniformes
```

## Reglas de negocio implementadas (contrato del dominio, sección 6)

- **Dinero (6.2):** Value Object inmutable con moneda; prohíbe mezclar GTQ/USD;
  redondeo 2 decimales medio hacia arriba **por cuota**, no al final.
- **Tasas (6.3/6.3.1):** TNA nominal con `i = TNA ÷ 12`; mora base Actual/360;
  las políticas son **parámetros versionados** (Strategy), nunca constantes.
- **Amortización francesa (6.4):** última cuota ajusta el cuadre
  (`amortización_n = saldo_{n-1}`); invariantes verificados por la Factory y por prueba.
- **Mora (6.5):** interés moratorio **exclusivamente sobre capital en mora**
  (prohibición de anatocismo, Código Civil Decreto-Ley 106); cálculo por cuota vencida;
  tramos como **clasificación derivada y reversible**, no como estados.
- **Prelación (6.6):** gastos → moratorio → corriente → capital (Chain of Responsibility);
  pago parcial nunca se rechaza ni regulariza; excedente a favor del cliente
  (política de adelanto: amortización a capital).
- **Ciclo de vida (6.7):** transiciones inválidas imposibles por diseño (State);
  regularización en ambas direcciones; historial **append-only** con fecha, usuario y
  motivo; reestructuración no borra el pasado; incobrable = baja contable.
- **Cartera en riesgo (6.8):** saldo completo de créditos >30 días + reestructurados,
  sobre cartera activa (excluye incobrables); el porcentaje **nunca se reporta solo**:
  se acompaña de lo dado por incobrable.
- **Cierres (6.9):** idempotentes, con fecha de corte; mayor append-only.
- **Idempotencia de pagos (6.10):** `X-Idempotency-Key` en `POST /pagos`; reintentar
  no cobra dos veces.

### Marco legal citado (sección 6.1 y 6.3.1)
- Ley de Entidades de Microfinanzas (Decreto 25-2016) · supervisión SIB.
- Reglamento para la Administración del Riesgo de Crédito (Resolución JM-47-2022).
- Libre pactación (art. 42, Decreto 19-2002) · usura (art. 276, Código Penal).
- Anatocismo prohibido (Código Civil, Decreto-Ley 106).

## Arquitectura (resumen)

**Hexagonal (puertos y adaptadores) + monolito modular** — ver `adr/ADR-001`.
El núcleo no depende de infraestructura; en el Proyecto Final, la API REST, el chat y el
servidor MCP serán **adaptadores primarios nuevos** que invocan los mismos puertos
(punto de extensión de IA visible en el C4 Nivel 2/3). Se rechazan los microservicios:
la consistencia fuerte del dinero no se distribuye.

**Patrones aplicados (≥4, ≥2 GoF):** Value Object (Dinero) · Strategy (método de interés,
política de adelanto, política moratoria) · Chain of Responsibility (prelación) ·
State (ciclo de vida) · Factory (PlanAmortizacion) · Specification (tramos) ·
Repository (puerto de persistencia) · Template Method (cierres, diseño).

## Herramientas de IA utilizadas (sección 13)

Se utilizó el asistente de IA **Qwen** como apoyo para planificar el trabajo, organizar
pasos de configuración y revisar dudas conceptuales. **Todo el diseño, el código y las
decisiones de este proyecto fueron comprendidos por la autora y pueden ser explicados y
defendidos en su totalidad.**
