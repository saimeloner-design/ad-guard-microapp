import { handleMetaDeletion } from '@/lib/data-deletion';
import { flushLogsAfterResponse, reportError } from '@/lib/log';

// "URL de devolución de llamada para eliminación de datos" de la app de Meta (docs/SPEC.md §9).
// Meta manda `signed_request` cuando el usuario pide borrar sus datos y le muestra al usuario
// el código y la URL que respondemos.
export async function POST(request) {
  flushLogsAfterResponse();
  try {
    const code = await handleMetaDeletion(request, 'data_deletion');
    if (!code) return Response.json({ error: 'signed_request inválido' }, { status: 400 });
    const url = new URL(`/borrado-de-datos?codigo=${code}`, request.nextUrl.origin).toString();
    return Response.json({ url, confirmation_code: code });
  } catch (error) {
    reportError('data-deletion', 'No se pudo atender el pedido de borrado de Meta', error);
    return Response.json({ error: 'Error inesperado del servidor.' }, { status: 500 });
  }
}
