import { handleMetaDeletion } from '@/lib/data-deletion';
import { flushLogsAfterResponse, reportError } from '@/lib/log';

// "URL de devolución de llamada para desautorizar" de la app de Meta (docs/SPEC.md §9).
// Meta avisa cuando el usuario quita la app desde Facebook: se borran sus datos igual que
// en un pedido de borrado. Meta no lee la respuesta.
export async function POST(request) {
  flushLogsAfterResponse();
  try {
    const code = await handleMetaDeletion(request, 'deauthorize');
    if (!code) return Response.json({ error: 'signed_request inválido' }, { status: 400 });
    return Response.json({ ok: true });
  } catch (error) {
    reportError('data-deletion', 'No se pudo atender la desautorización de Meta', error);
    return Response.json({ error: 'Error inesperado del servidor.' }, { status: 500 });
  }
}
