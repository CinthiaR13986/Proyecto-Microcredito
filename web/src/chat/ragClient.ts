export interface FuenteRag {
  doc_id: string;
  titulo: string;
  texto: string;
}

export interface RespuestaRag {
  respuesta: string;
  fuentes: FuenteRag[];
  advertencia_seguridad?: string;
}

export async function consultarRag(pregunta: string): Promise<RespuestaRag> {
  const r = await fetch('/api/rag/consultar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pregunta }),
  });
  
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('El servidor no respondió con JSON. ¿Está corriendo npm run api?');
  }

  if (!r.ok) throw new Error(data.error?.mensaje || 'Error consultando RAG');
  return data;
}