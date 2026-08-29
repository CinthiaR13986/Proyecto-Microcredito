Requisitos previos

Antes de ejecutar el proyecto es necesario tener instaladas las siguientes herramientas:

Herramienta	Uso
Git	Clonar y administrar el repositorio
Node.js	Ejecutar el proyecto TypeScript
npm	Administración de dependencias
TypeScript	Compilación del proyecto
Java	Ejecución local de PlantUML
PlantUML	Generación de diagramas
VS Code	Editor recomendado
Docker	Requerido para fases posteriores
Docker Compose	Levantar servicios como PostgreSQL

Se recomienda utilizar una versión estable/LTS de Node.js.

Para comprobar las instalaciones:

git --version
node --version
npm --version
java --version
docker --version
📥 Clonar el repositorio

Primero se debe clonar el repositorio desde GitHub.

git clone URL_DEL_REPOSITORIO

Después ingresar al directorio del proyecto:

cd nombre-del-repositorio

Ejemplo:

git clone https://github.com/usuario/credito-vecino.git
cd credito-vecino

Debe sustituirse la URL anterior por la URL real del repositorio.

📦 Instalar dependencias

Una vez clonado el proyecto, instalar las dependencias de Node.js:

npm install

Este comando utilizará el archivo:

package.json

para instalar las dependencias necesarias.

Al finalizar se generará el directorio:

node_modules/

Este directorio no debe subirse al repositorio Git.

Compilar TypeScript

Para comprobar que el proyecto puede compilarse correctamente:

npm run build

El código TypeScript será transformado a JavaScript.

Generalmente los archivos compilados se almacenarán en:

dist/

Una configuración típica del archivo package.json podría contener:

{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "test": "vitest"
  }
}
🚀 Ejecutar en modo desarrollo

Durante el desarrollo se recomienda ejecutar:

npm run dev

Este modo permite ejecutar directamente el proyecto TypeScript y reiniciar automáticamente la aplicación cuando se detectan cambios.

Dependiendo de las herramientas configuradas puede utilizarse:

tsx

o:

ts-node
▶️ Ejecutar versión compilada

Para ejecutar la aplicación a partir del código compilado:

npm run build

Después:

npm start

El flujo sería:

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
