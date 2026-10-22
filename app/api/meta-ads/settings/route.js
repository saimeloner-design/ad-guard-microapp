import { withTransaction } from '@/lib/db';
import { flushLogsAfterResponse } from '@/lib/log';
import { cleanAdAccountId, getMetaSession, MetaApiError, metaErrorResponse } from '@/lib/meta-ads';
import { ensureUserAccount, getAccountSettings, saveProfitPerSale } from '@/lib/users';

// Ganancia por venta y tareas de Hoy hechas de esta cuenta (docs/SPEC.md §9).
// Si la base de datos falla, el navegador sigue con lo que tenga guardado.

export async function GET(request) {
  flushLogsAfterResponse();
  try {
    const accountId = cleanAdAccountId(request.nextUrl.searchParams.get('accountId'));
    const { userId } = await getMetaSession(request);
    return Response.json(await withTransaction((db) => getAccountSettings(db, { userId, accountId })));
  } catch (error) {
    return metaErrorResponse(error);
  }
}

// Body: { accountId, profitPerSale } — profitPerSale 0 o vacío la borra.
export async function POST(request) {
  flushLogsAfterResponse();
  try {
    const body = await request.json().catch(() => ({}));
    const accountId = cleanAdAccountId(body.accountId);
    const value = Number(body.profitPerSale || 0);
    if (!Number.isFinite(value) || value < 0) throw new MetaApiError('ganancia inválida', { status: 400, code: 'BAD_REQUEST' });
    const { userId, email } = await getMetaSession(request);
    await withTransaction(async (db) => {
      await ensureUserAccount(db, { userId, email, accountId });
      await saveProfitPerSale(db, { userId, accountId, profitPerSale: value > 0 ? value : null });
    });
    return Response.json({ ok: true });
  } catch (error) {
    return metaErrorResponse(error);
  }
}
