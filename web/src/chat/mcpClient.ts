export async function ejecutarMcp(
  herramienta: string,
  argumentos: Record<string, unknown>,
  aprobacionHumana = false
): Promise<unknown> {
  const r = await fetch('/api/mcp/ejecutar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ herramienta, argumentos, aprobacionHumana }),
  });
  
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('El servidor no respondió con JSON. ¿Está corriendo npm run api?');
  }

  if (!r.ok) throw new Error(data.error?.mensaje || 'Error ejecutando MCP');
  return data;
}