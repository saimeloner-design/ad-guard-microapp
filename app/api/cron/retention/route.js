import { withTransaction } from '@/lib/db';
import { flushLogsAfterResponse, log, reportError, requiredEnv } from '@/lib/log';
import { deleteExpired } from '@/lib/retention';

// Cron semanal de Vercel (vercel.json): borra los registros vencidos (docs/SPEC.md §9).
// Vercel lo llama con `Authorization: Bearer $CRON_SECRET`; sin eso no hace nada.
export async function GET(request) {
  flushLogsAfterResponse();
  const secret = requiredEnv('CRON_SECRET', 'retention');
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('No autorizado', { status: 401 });
  }
  try {
    const deleted = await withTransaction(deleteExpired);
    log('info', 'retention', 'Registros vencidos borrados', deleted);
    return Response.json({ ok: true, deleted });
  } catch (error) {
    reportError('retention', 'No se pudieron borrar los registros vencidos', error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
