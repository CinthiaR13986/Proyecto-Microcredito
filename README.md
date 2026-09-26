# Sistema de Gestión de Microcrédito (SGMC) — Crédito Vecino, S.A.

## 🎓 Información Académica

* **Institución:** Universidad Mariano Gálvez de Guatemala
* **Facultad:** Ingeniería en Sistemas
* **Curso:** Análisis de Sistemas II
* **Catedrático:** Ing. Ezequiel Urizar

---

## 👥 Equipo de Trabajo

* **Ezequiel Alexander Castro Martínez** — *Carné: 7690-21-7934*
* **Jermi Emanuel Pinto Patzan** — *Carné: 7690-20-11486*
* **Cinthia Yadira Robles Sotoj** — *Carné: 7690-16-13986*
* **Heldriss Mariel Yanes Paredes** — *Carné: 7690-17-7258*
* **Frederick Eduardo Montiel Tórtola** — *Carné: 7690-23-8975*

---

## 🔗 Enlaces del Proyecto

* **Repositorio de Código (GitHub):** https://github.com/CinthiaR13986/Proyecto-Microcredito
* **Prototipo Navegable (Figma):** https://dean-fixed-18677388.figma.site

---

## 📌 Resumen Ejecutivo

El **Sistema de Gestión de Microcrédito (SGMC)** es una solución tecnológica integral diseñada para optimizar y transparentar el ciclo operativo de los microcréditos otorgados por *Crédito Vecino, S.A.*

El proyecto aborda los desafíos actuales de la institución, tales como la consolidación manual de informes, errores en el cálculo de moras escalonadas, falta de visibilidad en la cartera en riesgo y las dificultades de conectividad intermitente que experimentan los asesores durante su trabajo de campo.

---

## 🎯 Objetivos del Sistema

1. **Optimización del Análisis Financiero y de Riesgo:** Proveer a la gerencia y al comité de crédito un tablero consolidado que distinga con claridad la *Cartera en Mora* de la *Cartera en Riesgo (PAR30)*, facilitando la toma de decisiones contables oportunas.
2. **Operatividad Continua en Campo:** Permitir a los asesores financieros registrar solicitudes y cobros aun sin señal de internet, garantizando la integridad de los datos mediante almacenamiento local y resguardo de duplicidad.
3. **Transparencia hacia el Cliente:** Proporcionar desgloses didácticos y comprensibles sobre la aplicación de pagos, recargos moratorios por tramos y estados de cuenta.

---

## 👥 Perfiles de Usuario y Experiencia (UX)

La concepción del sistema se fundamentó en la investigación de usuarios y la metodología de mapas de experiencia (*Journey Maps*), identificando tres perfiles centrales:

* **Gerencia de Riesgos y Comité de Crédito (Mauricio):** Requiere un tablero densamente informativo con desglose estricto por tramos de mora, indicadores de liquidez y reportes de cierres consolidados.
* **Asesor de Crédito (Rafael):** Opera desde dispositivos móviles en zonas rurales con señal inestable. Requiere navegación ágil, cobros claros y seguridad de que sus registros no se duplicarán.
* **Cliente de Microcrédito (Romana):** Requiere un lenguaje accesible, explicaciones claras sobre los recargos y transparencia total sobre los saldos restantes tras realizar un pago.

---

## 🏗️ Aspectos Clave de Arquitectura y Diseño

* **Arquitectura PWA (Progressive Web App):** Se seleccionó un modelo de aplicación web progresiva que permite contar con una única base de código responsiva, adaptable tanto a la vista móvil de campo como a la vista gerencial de escritorio.
* **Estrategia Mobile-First:** La interfaz fue estructurada priorizando las pantallas móviles para el trabajo operativo, expandiendo gradualmente la densidad informativa hacia pantallas de escritorio.
* **Estrategia ante Pérdida de Conexión (Offline-First):** Las operaciones capturadas en campo sin señal se almacenan localmente en IndexedDB y se sincronizan al recuperar la conexión mediante claves de idempotencia (`X-Idempotency-Key`), evitando cobros dobles.
* **Accesibilidad y Usabilidad:** El prototipo fue diseñado e inspeccionado bajo las 10 heurísticas de Nielsen y los criterios de accesibilidad WCAG 2.2 Nivel AA, asegurando contrastes adecuados, áreas de toque accesibles y claridad conceptual.

---

## 🧪 Pruebas y Demostración

Para validar el funcionamiento del sistema se incluyen pruebas automatizadas y una demostración específica del cálculo y comportamiento de la mora.

### Ejecutar las pruebas

Para ejecutar el conjunto de pruebas automatizadas del proyecto, desde la terminal ubicada en el directorio correspondiente del proyecto, utilizar:

```bash
npm test
```

Este comando permite ejecutar las pruebas configuradas para verificar el comportamiento de los componentes y funcionalidades implementadas.

### Generar demostración de mora

Para generar en consola la demostración relacionada con el cálculo de la mora, ejecutar:

```bash
npm run demo:mora
```

Este comando permite visualizar en la consola el resultado de la demostración de la lógica de mora implementada en el sistema.

> **Nota:** Antes de ejecutar los comandos, asegúrese de haber instalado las dependencias del proyecto mediante `npm install`.

---

## 🤖 Declaración de Uso de Inteligencia Artificial

En concordancia con los principios de transparencia académica y ética profesional, el equipo de trabajo declara la utilización de herramientas de Inteligencia Artificial Generativa durante las fases de análisis, síntesis y documentación del proyecto.

### Herramientas Utilizadas y Ámbitos de Apoyo

1. **Google Gemini:**

   * Apoyo en la consolidación analítica del documento técnico y la evaluación de hallazgos de usabilidad.
   * Verificación académica de principios de arquitectura de software (SOLID y GRASP).
   * Asistencia en la estructuración de la auditoría de accesibilidad WCAG 2.2.

2. **ChatGPT (OpenAI):**

   * Redacción y refinamiento estilístico de las narrativas para los perfiles de usuario (*Personas*).
   * Elaboración de borradores para la creación de prompts de apoyo en herramientas de maquetado.
   * Revisión ortográfica y gramatical del contenido general.

3.  **Qwen:**

    * Apoyo en el análisis y revisión de requerimientos funcionales y técnicos del sistema.
    * Generación de sugerencias para pruebas, validaciones y documentación técnica del proyecto.


### Compromiso y Responsabilidad Humana

La Inteligencia Artificial fue empleada exclusivamente como un complemento metodológico para la organización de ideas y la redacción. Todas las decisiones arquitectónicas, validaciones financieras, reglas de negocio, diseños de interfaz e integraciones del sistema fueron concebidas, revisadas y validadas críticamente por los estudiantes integrantes del proyecto.

---

## 🛠️ Herramientas y Metodologías

* **Diseño y Prototipado:** Figma
* **Enfoque Tecnológico:** PWA (Progressive Web App), TypeScript, React, Tailwind CSS
* **Metodologías:** Evaluación Heurística de Nielsen, Guías de Accesibilidad WCAG 2.2 AA, Principios SOLID y GRASP
* **Pruebas:** `npm test`
* **Demostración de mora:** `npm run demo:mora`
