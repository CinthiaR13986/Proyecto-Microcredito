# Matriz de trazabilidad — Requisito → Caso de uso → Clase/Módulo (E1)

| Requisito | Caso de uso | Clase / módulo |
|---|---|---|
| R1: Registrar y consultar clientes | Registrar cliente | `Cliente` · módulo Originación |
| R2: Otorgar créditos con plan de cuotas | Solicitar / Desembolsar crédito | `SolicitudCredito` · `Credito` · `PlanAmortizacion` · `Cuota` |
| R3: Dinero exacto, inmutable, sin mezclar monedas | Todos los casos con montos | `Dinero` (Value Object) |
| R4: Registrar pagos aplicando prelación normativa | Registrar pago de cuota | `Pago` · `EslabonPrelacion` (Chain of Responsibility) · `Movimiento` |
| R5: Mora e interés moratorio sin anatocismo | Calcular mora | `CalculadoraMora` · `PoliticaMoratoria` |
| R6: Ciclo de vida reversible, trazable y sin transiciones inválidas | (todos los eventos del crédito) | `Credito` · `RegistroEstado` (State) |
| R7: Políticas versionadas, no constantes | Evaluar/aprobar · Desembolsar | `MetodoAmortizacion`/`MetodoFrances` · `PoliticaMoratoria` (Strategy) |
| R8: Idempotencia: reintentar un pago no cobra dos veces | Registrar pago de cuota | `Pago.claveIdempotencia` · `RepositorioCreditos` |
| R9: Cierres y cartera en riesgo con ambos números | Generar cierre / Consultar cartera en riesgo | `Cierre` · módulo Cierres · `CalculadoraMora` |