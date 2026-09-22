# Informe de impacto SOLID — Evolución del núcleo (E6, Proyecto 2)

## 1. Punto de partida
- Commit de entrega del Proyecto 1:`entrega-p1` → hash: [aeeeafeabcec70a84e72707e67d822bcbaa2c14c]
- Commit de entrega del Proyecto 2: HEAD → hash: [d4f5d71487d3f1512773864b321c441ee4b16615]
- Rango medido: `entrega-p1..HEAD`, limitado a `src/dominio/`.

## 2. Métricas del cambio (sección 8.1)

| Métrica | Valor | Evidencia |
|---|---|---|
| Archivos del núcleo creados | **7** | `politica-mora/politica-mora.ts`, `politica-plana.ts`, `politica-escalonada.ts`, `politica-retroactiva.ts`, `catalogo-politicas.ts`, `gasto-gestion-cobro.ts`, `devengo.ts` |
| Archivos del núcleo modificados (existentes en P1) | **2** (objetivo ≤ 2) | `estado-credito.ts` (+transición CP-04.1), `cartera.ts` (+desglose CP-04.3) |
| ¿Se modificó el motor de cálculo de mora? | **No** | `git diff entrega-p1..HEAD -- src/dominio/calculadora-mora.ts` → salida vacía |
| Pruebas del P1 que dejaron de pasar | **0** | Suite P1 completa: 40/40 en verde sobre el núcleo evolucionado |
| Pruebas del P1 reescritas | **0** | Ningún archivo de `tests/` del P1 fue modificado |
| Líneas netas añadidas al núcleo | 
106     49      src/dominio/cartera.ts
48      0       src/dominio/devengo.ts
8       15      src/dominio/estado-credito.ts
29      0       src/dominio/gasto-gestion-cobro.ts
14      0       src/dominio/politica-mora/catalogo-politicas.ts
101     0       src/dominio/politica-mora/politica-escalonada.ts
17      0       src/dominio/politica-mora/politica-mora.ts
26      0       src/dominio/politica-mora/politica-plana.ts
31      0       src/dominio/politica-mora/politica-retroactiva.ts

Salida de `git diff --stat entrega-p1..HEAD -- src/dominio`:

 src/dominio/cartera.ts                            | 155 +++++++++++++++-------
 src/dominio/devengo.ts                            |  48 +++++++
 src/dominio/estado-credito.ts                     |  23 ++--
 src/dominio/gasto-gestion-cobro.ts                |  29 ++++
 src/dominio/politica-mora/catalogo-politicas.ts   |  14 ++
 src/dominio/politica-mora/politica-escalonada.ts  | 101 ++++++++++++++
 src/dominio/politica-mora/politica-mora.ts        |  17 +++
 src/dominio/politica-mora/politica-plana.ts       |  26 ++++
 src/dominio/politica-mora/politica-retroactiva.ts |  31 +++++

 Salida del comando `npm test`:
  tests/cartera-por-tramo.test.ts [queued]
 ❯ tests/contrato-politica.test.ts [queued]
 ❯ tests/cp04-reglas.test.ts [queued]
 ✓ tests/mora.test.ts (7 tests) 9ms
 ✓ tests/prelacion.test.ts (6 tests) 10ms
 ✓ tests/dinero.test.ts (7 tests) 10ms
 ✓ tests/cp04-reglas.test.ts (6 tests) 9ms
 ✓ tests/cartera-por-tramo.test.ts (4 tests) 8ms


 ✓ tests/cartera.test.ts (6 tests) 10ms
 ✓ tests/contrato-politica.test.ts (13 tests) 18ms
 ✓ tests/plan-amortizacion.test.ts (6 tests) 16ms
 ✓ tests/estados.test.ts (8 tests) 10ms
 ✓ tests/politica-mora.test.ts (16 tests) 16ms

 Test Files  10 passed (10)
      Tests  79 passed (79)
   Start at  22:16:31
   Duration  618ms (transform 835ms, setup 0ms, import 1.37s, tests 116ms, environment 2ms)