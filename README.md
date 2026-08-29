# Sistema de Gestión de Microcrédito — Crédito Vecino, S. A.

**Proyecto 1 — Arquitectura y diseño de componentes**
Análisis de Sistemas II (037) · Universidad Mariano Gálvez de Guatemala · Segundo semestre 2026

**Autores:** Cinthia Robles, Jermy Pinto, Ezequiel Castro, Frederick Montiel, Heldris Yanes
**Carné:** 7690-16-13986 · **Sección:** 037 · Modalidad sabatina

**Repositorio:** [https://github.com/tu-usuario/Proyecto-Microcredito]

---

## Requisitos previos

Antes de ejecutar el proyecto es necesario tener instaladas las siguientes herramientas:

| Herramienta    | Uso                                 |
| -------------- | ----------------------------------- |
| Git            | Clonar y administrar el repositorio |
| Node.js        | Ejecutar el proyecto TypeScript     |
| npm            | Administración de dependencias      |
| TypeScript     | Compilación del proyecto            |
| Java           | Ejecución local de PlantUML         |
| PlantUML       | Generación de diagramas             |
| VS Code        | Editor recomendado                  |
| Docker         | Requerido para fases posteriores    |
| Docker Compose | Levantar servicios como PostgreSQL  |

Se recomienda utilizar una versión estable/LTS de Node.js.

Para comprobar las instalaciones:

```bash
git --version
node --version
npm --version
java --version
docker --version
```

## 📥 Clonar el repositorio

Primero se debe clonar el repositorio desde GitHub.

```bash
git clone URL_DEL_REPOSITORIO
```

Después ingresar al directorio del proyecto:

```bash
cd nombre-del-repositorio
```

Ejemplo:

```bash
git clone https://github.com/usuario/credito-vecino.git
cd credito-vecino
```

Debe sustituirse la URL anterior por la URL real del repositorio.

## 📦 Instalar dependencias

Una vez clonado el proyecto, instalar las dependencias de Node.js:

```bash
npm install
```

Este comando utilizará el archivo:

```text
package.json
```

para instalar las dependencias necesarias.

Al finalizar se generará el directorio:

```text
node_modules/
```

Este directorio no debe subirse al repositorio Git.

## Compilar TypeScript

Para comprobar que el proyecto puede compilarse correctamente:

```bash
npm run build
```

El código TypeScript será transformado a JavaScript.

Generalmente los archivos compilados se almacenarán en:

```text
dist/
```

Una configuración típica del archivo `package.json` podría contener:

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "test": "vitest"
  }
}
```

## 🚀 Ejecutar en modo desarrollo

Durante el desarrollo se recomienda ejecutar:

```bash
npm run dev
```

Este modo permite ejecutar directamente el proyecto TypeScript y reiniciar automáticamente la aplicación cuando se detectan cambios.

Dependiendo de las herramientas configuradas puede utilizarse:

```text
tsx
```

o:

```text
ts-node
```

## ▶️ Ejecutar versión compilada

Para ejecutar la aplicación a partir del código compilado:

```bash
npm run build
```

Después:

```bash
npm start
```

El flujo sería:

```text
Código TypeScript
       │
       ▼
npm run build
       │
       ▼
     dist/
       │
       ▼
npm start
```

