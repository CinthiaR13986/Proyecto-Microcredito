// ... imports existentes ...

/**
 * Fragmentación inteligente: respeta la estructura del documento.
 * - Si el texto tiene preguntas (¿), fragmenta por cada pregunta/respuesta.
 * - Si tiene títulos de sección (líneas que terminan en : o son mayúsculas), fragmenta por sección.
 * - Si no, usa el solapamiento clásico por caracteres.
 */
function fragmentar(texto: string): string[] {
  // Limpiar metadata del inicio
  const limpio = texto
    .split('\n')
    .filter((l) => !l.match(/^\w+:\s*.+$/))
    .join('\n')
    .trim();

  // Estrategia 1: Detectar preguntas frecuentes (¿...?)
  if (limpio.includes('¿')) {
    const bloques = limpio.split(/(?=¿)/);
    return bloques.map(b => b.trim()).filter(b => b.length > 20);
  }

  // Estrategia 2: Detectar secciones por líneas que parecen títulos
  // (Líneas cortas seguidas de un salto de línea, o líneas en mayúsculas)
  const lineas = limpio.split('\n');
  const secciones: string[] = [];
  let buffer = '';
  
  for (const linea of lineas) {
    const esTitulo = linea.trim().length > 0 && linea.trim().length < 60 && 
                     (linea.trim() === linea.trim().toUpperCase() || linea.trim().endsWith(':'));
    
    if (esTitulo && buffer.length > 0) {
      secciones.push(buffer.trim());
      buffer = linea + '\n';
    } else {
      buffer += linea + '\n';
    }
  }
  if (buffer.trim().length > 0) secciones.push(buffer.trim());
  
  if (secciones.length > 1) return secciones;

  // Estrategia 3: Fallback por caracteres (para documentos largos sin estructura clara)
  const tamano = 500;
  const solapamiento = 100;
  const fragmentos: string[] = [];
  let inicio = 0;
  while (inicio < limpio.length) {
    const fin = Math.min(inicio + tamano, limpio.length);
    fragmentos.push(limpio.slice(inicio, fin));
    if (fin === limpio.length) break;
    inicio = fin - solapamiento;
  }
  return fragmentos;
}

// ... resto del archivo igual, pero llama a fragmentar(contenido) sin argumentos extra ...