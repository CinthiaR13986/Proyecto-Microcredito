# E3 · Diseño de componentes y principios

## 1. Descomposición modular (sección 7.2)

| Módulo | Responsabilidad única | Interfaz pública (código/diseño) | NO le corresponde | Dependencias |
|---|---|---|---|---|
| Cálculo financiero | Amortización, interés corriente/moratorio, redondeo. Funciones puras | `PlanAmortizacion.generar`, `MetodoAmortizacion`, `CalculadoraMora.*`, `Dinero` | Persistir, consultar datos, definir política | Ninguna (puro) |
| Cartera y cobros | Pagos, prelación, saldos, estados, tramos, cartera en riesgo | `aplicarPago`, `EslabonPrelacion`, `Credito.aplicar`, `calcularCarteraEnRiesgo` | Definir tasas o políticas | Cálculo financiero (vía parámetros) |
| Originación | Cliente, solicitud, aprobación, desembolso | `Credito.solicitar`, caso de uso `DesembolsarCredito` | Calcular mora ni cierres | Cálculo financiero |
| Cierres | Cierre diario/mensual, congelamiento, cartera por tramo | `Cierre` (diseño, Template Method) | Modificar créditos | Cartera y cobros |
| Contratos/API | Exponer casos de uso al exterior | OpenAPI (E5) | Contener reglas de negocio | Puertos primarios |
| Puertos secundarios | Abstracciones de infraestructura | `Reloj`, `RepositorioCreditos`, `GeneradorIds` (`puertos.ts`) | Implementar infraestructura | Ninguna |

## 2. Diseño detallado del módulo Cálculo financiero

Ver `diagramas/modulo-calculo.puml`. El módulo es **puro**: entra capital+tasa+plazo+política, salen tablas y montos; no toca disco ni red.

## 3. SOLID aplicado (dónde y por qué)

| Principio | Dónde vive en este diseño | Por qué |
|---|---|---|
| **SRP** | `calculadora-mora.ts` solo calcula moratorio y tramos; `prelacion-pago.ts` solo el orden de aplicación; `cartera.ts` solo el indicador. | Un cambio regulatorio de mora no obliga a tocar la prelación. |
| **OCP** | `MetodoAmortizacion` y `PoliticaAdelanto` (Strategy). | Agregar el método "sobre saldos" o cambiar el destino del excedente = nueva implementación, sin modificar `PlanAmortizacion` ni `aplicarPago`. |
| **LSP** | Toda implementación de `MetodoAmortizacion` es sustituible por `MetodoFrances`. | El contrato es claro: devolver cuota base SIN redondear; los invariantes los verifica la Factory, no cada estrategia. |
| **ISP** | Puertos mínimos: `Reloj` solo `hoy()`; `GeneradorIds` solo `siguiente()`. | Ningún cliente se ve forzado a implementar métodos que no usa. |
| **DIP** | El dominio depende de `puertos.ts`; PostgreSQL (Proyecto Final) implementará `RepositorioCreditos`. | En pruebas se usa repositorio en memoria y reloj fijo sin tocar el dominio. |

## 4. GRASP aplicado

| Patrón GRASP | Aplicación concreta |
|---|---|
| **Experto en información** | `Dinero` posee monto y moneda, y por eso opera sobre ellos; `Credito` conoce su estado y deriva su tramo. |
| **Creator** | `PlanAmortizacion.generar()` crea sus `Cuota`; `Credito.solicitar()` crea el agregado. |
| **Controller** | Los casos de uso (`RegistrarPago`, `DesembolsarCredito`) coordinan el flujo; los adaptadores no contienen reglas. |
| **Bajo acoplamiento** | Cálculo financiero no depende de nada externo; Cartera depende de Cálculo solo por parámetros. |
| **Alta cohesión** | Cada clase agrupa responsabilidades fuertemente relacionadas (ver tabla 6). |
| **Polimorfismo** | Strategy y State sustituyen condicionales por implementaciones/transiciones intercambiables. |
| **Indirección** | Los puertos (`Reloj`, `RepositorioCreditos`) protegen al dominio de la variabilidad de infraestructura. |

## 5. Patrones aplicados (mínimo 4, ≥2 GoF) — con diagramas

1. **Objeto de Valor (Dinero)** — elimina flotantes, inmutable, prohíbe mezclar monedas (6.2).
2. **Strategy (GoF)** — `MetodoAmortizacion`/`MetodoFrances`; `PoliticaAdelanto`; `PoliticaMoratoria` → `diagramas/patron-strategy.puml`.
3. **Chain of Responsibility (GoF)** — `EslabonPrelacion`: cada rubro consume y pasa el remanente (6.6) → `diagramas/patron-chain.puml`.
4. **State (GoF)** — `siguienteEstado()` + `Credito.aplicar()`: transiciones inválidas imposibles por diseño (6.7) → `diagramas/patron-state.puml`.
5. **Factory (GoF)** — `PlanAmortizacion.generar()` con constructor privado y verificación de invariantes → `diagramas/patron-factory.puml`.
6. **Specification** — `clasificarTramo()` y `estaEnRiesgo()`: reglas componibles y verificables por separado.
7. **Template Method** (diseño) — cierre diario vs mensual: mismo esqueleto, pasos distintos.

## 6. Análisis de cohesión y acoplamiento por módulo

| Módulo | Cohesión | Acoplamiento | Justificación |
|---|---|---|---|
| Cálculo financiero | Funcional (cada función = un cálculo completo) | Muy bajo: solo parámetros de entrada | Funciones puras; testeable en milisegundos. |
| Cartera y cobros | Comunicacional (opera los mismos datos: pago/saldo/estado) | Bajo: usa Cálculo vía `Dinero` y políticas inyectadas | No conoce persistencia ni fechas del sistema. |
| Originación | Secuencial (solicitud → aprobación → desembolso) | Bajo: delega el plan al módulo de Cálculo | El desembolso no recalcula fórmulas. |
| Cierres | Secuencial (Template Method) | Bajo: lee saldos por puerto, nunca los muta | Congela cifras; idempotente. |