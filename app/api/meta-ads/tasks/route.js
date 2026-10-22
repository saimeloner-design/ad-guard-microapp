import { withTransaction } from '@/lib/db';
import { cleanTaskKey, saveDoneTasks } from '@/lib/events';
import { flushLogsAfterResponse } from '@/lib/log';
import { cleanAdAccountId, getMetaSession, MetaApiError, metaErrorResponse } from '@/lib/meta-ads';

// Tareas de Hoy marcadas como hechas (eventos `task_done`, docs/SPEC.md §9).
// Body: { accountId, keys: ['pausar:123', …] } — varias a la vez al subir las que había en el navegador.
export async function POST(request) {
  flushLogsAfterResponse();
  try {
    const body = await request.json().catch(() => ({}));
    const accountId = cleanAdAccountId(body.accountId);
    const keys = [...new Set((Array.isArray(body.keys) ? body.keys : []).map(cleanTaskKey).filter(Boolean))].slice(0, 200);
    if (keys.length === 0) throw new MetaApiError('sin tareas', { status: 400, code: 'BAD_REQUEST' });
    const { userId } = await getMetaSession(request);
    await withTransaction((db) => saveDoneTasks(db, { userId, accountId, keys }));
    return Response.json({ ok: true });
  } catch (error) {
    return metaErrorResponse(error);
  }
}
