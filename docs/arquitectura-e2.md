# E2 · Decisión y Justificación de la Arquitectura
**Sistema de Gestión de Microcrédito — Crédito Vecino, S.A.**

## 1. Priorización de Atributos de Calidad (ISO/IEC 25010)

En un dominio financiero donde un centavo mal redondeado es un defecto de severidad alta, los atributos de calidad no son un lujo, sino el contrato del sistema. Se priorizan de la siguiente manera:

1. **Adecuación Funcional (Exactitud Funcional) - [CRÍTICO]**
   - *Justificación:* El sistema calcula dinero. Las fórmulas de amortización, mora y prelación deben ser exactas y auditables. Un error aquí implica consecuencias contables y legales (usura, anatocismo).
2. **Mantenibilidad (Testabilidad y Modificabilidad) - [ALTO]**
   - *Justificación:* Las políticas (tasas, tramos de mora) cambian por regulación (SIB / JM-47-2022). El núcleo debe ser 100% testeable con funciones puras en milisegundos (sin BD) y las políticas deben poder actualizarse sin reescribir el motor de cálculo.
3. **Confiabilidad (Integridad y Tolerancia a fallos) - [ALTO]**
   - *Justificación:* Los pagos deben ser idempotentes (reintentar no cobra dos veces) y el mayor contable debe ser *append-only* (los saldos no se sobrescriben, se acumulan movimientos).
4. **Compatibilidad (Interoperabilidad) - [MEDIO-ALTO]**
   - *Justificación:* El sistema debe exponer sus casos de uso de forma uniforme a futuros adaptadores: una API REST, un servidor MCP (Model Context Protocol) y un asistente conversacional (Proyecto Final).

## 2. Estilo Arquitectónico: Hexagonal + Monolito Modular

**Decisión:** Arquitectura Hexagonal (Puertos y Adaptadores) empaquetada como un Monolito Modular.

**Argumentación frente a la evolución (Proyecto Final):**
El núcleo de dominio (E4) no tiene dependencias de infraestructura (ni HTTP, ni BD). Esto garantiza que en el Proyecto Final, agregar un **Servidor MCP** o un **Chat con RAG** no requiera reescribir la lógica de negocio; simplemente serán *nuevos adaptadores primarios* que invocan los mismos puertos (casos de uso) que ya usa la API REST. Hay una sola fuente de verdad para los cálculos.

**¿Por qué NO Microservicios?**
Repartir un desembolso y su asiento contable entre dos servicios convierte una transacción local en un problema de consistencia distribuida (SAGA / Two-Phase Commit). En microfinanzas, la consistencia fuerte del dinero es innegociable. Un monolito modular con fronteras explícitas (Originación, Cálculo, Cartera, Cierres) permite escalar módulos específicos en el futuro si fuera necesario, sin la sobrecarga de red y latencia de los microservicios.

## 3. Modelo 4+1 de Kruchten

### 3.1 Vista Lógica
Muestra los módulos del dominio y sus responsabilidades.
- **Originación:** Clientes, solicitudes, aprobación.
- **Cálculo Financiero:** Funciones puras (Amortización, Mora).
- **Cartera y Cobros:** Pagos, prelación, saldos.
- **Cierres:** Consolidación, cartera en riesgo, mayor contable.

### 3.2 Vista de Desarrollo (Implementación)
Refleja la estructura del repositorio y cómo TypeScript (`strict: true`) impone las fronteras:
- `src/dominio/`: Núcleo puro (Value Objects, Entities, Domain Services). Cero imports a `express` o `pg`.
- `tests/`: Pruebas unitarias que validan los invariantes (E4).
- *Futuro:* `src/infraestructura/` (Adaptadores secundarios: Postgres, Reloj real).
- *Futuro:* `src/api/` y `src/mcp/` (Adaptadores primarios).

### 3.3 Vista de Escenarios (Casos de Uso)
Valida que la arquitectura soporta los flujos críticos. (Ver diagramas de secuencia en E1: "Registrar Pago" demuestra cómo el Caso de Uso orquesta el Cálculo de Mora, la Prelación y el Repositorio sin acoplarlos).

## 4. Modelo C4

### Nivel 1: Contexto del Sistema
