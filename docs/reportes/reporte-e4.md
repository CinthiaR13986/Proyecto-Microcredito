# Reporte E4 — Evidencia del núcleo de cálculo

Fecha de corte fija (puerto Reloj): 2026-08-19 · Generado por: src/demo/reporte.ts

## 1) Tabla de amortización — caso 6.4.1
P = Q10,000.00 · TNA nominal 36% (i = 3% mensual) · 12 cuotas

| N | Saldo inicial | Cuota | Interés | Amortización | Saldo final |
| --: | --: | --: | --: | --: | --: |
| 1 | 10000.00 | 1004.62 | 300.00 | 704.62 | 9295.38 |
| 2 | 9295.38 | 1004.62 | 278.86 | 725.76 | 8569.62 |
| 3 | 8569.62 | 1004.62 | 257.09 | 747.53 | 7822.09 |
| 4 | 7822.09 | 1004.62 | 234.66 | 769.96 | 7052.13 |
| 5 | 7052.13 | 1004.62 | 211.56 | 793.06 | 6259.07 |
| 6 | 6259.07 | 1004.62 | 187.77 | 816.85 | 5442.22 |
| 7 | 5442.22 | 1004.62 | 163.27 | 841.35 | 4600.87 |
| 8 | 4600.87 | 1004.62 | 138.03 | 866.59 | 3734.28 |
| 9 | 3734.28 | 1004.62 | 112.03 | 892.59 | 2841.69 |
| 10 | 2841.69 | 1004.62 | 85.25 | 919.37 | 1922.32 |
| 11 | 1922.32 | 1004.62 | 57.67 | 946.95 | 975.37 |
| 12 | 975.37 | 1004.63 | 29.26 | 975.37 | 0.00 |
| **Total** | | **12055.45** | **2055.45** | **10000.00** | |

Invariantes (6.10): Σ amortizaciones = 10000.00 (esperado 10000.00) · saldo final = 0.00 (esperado 0.00)

## 2) Interés moratorio — ejemplo 6.5
Capital en mora (cuota 2): 725.76 · TNA moratoria 24% · base A/360 · 15 días
Interés moratorio: 7.26 (esperado 7.26)

## 3) Aplicación de pagos — prelación (6.6)

Escenario A exacto — pago 1011.88:
  gastos 0.00 · moratorio 7.26 · corriente 278.86 · capital 725.76
  cuota saldada: SÍ · capital pendiente: 0.00 · excedente: 0.00 (A_CAPITAL)

Escenario B parcial — pago 500.00:
  gastos 0.00 · moratorio 7.26 · corriente 278.86 · capital 213.88
  cuota saldada: NO · capital pendiente: 511.88 · excedente: 0.00 (A_CAPITAL)

Escenario C de más — pago 3000.00:
  gastos 0.00 · moratorio 7.26 · corriente 278.86 · capital 725.76
  cuota saldada: SÍ · capital pendiente: 0.00 · excedente: 1988.12 (A_CAPITAL)

## 4) Ciclo de vida — reversibilidad y transición inválida (6.7)
Atraso 45 días        → estado: en_mora · tramo: MORA_2 (esperado MORA_2)
Paga y baja a 10 días → estado: en_mora · tramo: MORA_1 (esperado MORA_1)
Paga todo lo vencido  → estado: vigente · tramo: AL_DIA (esperado AL_DIA)
Transición inválida rechazada por diseño: Transición inválida por diseño (6.7): 'solicitado' no acepta el evento 'PAGO'

## 5) Cartera en riesgo — caso 6.8.1
Cartera activa: 800000.00 · en riesgo: 56000.00 · indicador: 7.00% (esperado 7.00%)
Si C-005 se da por incobrable: indicador 6.06% (esperado 6.06%) · incobrables: 23000.00
El porcentaje nunca se reporta solo: se acompaña de lo dado por incobrable.

