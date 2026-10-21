import { flushLogsAfterResponse } from '@/lib/log';
import { cleanObjectId, getMetaAccessToken, MetaApiError, metaErrorResponse, setMetaObjectStatus } from '@/lib/meta-ads';

// "Pausa solo esta parte": pausa o reactiva un anuncio o un conjunto de anuncios.
const META_STATUS = { PAUSED: 'PAUSED', ENABLED: 'ACTIVE' };

export async function POST(request, ctx) {
  flushLogsAfterResponse();
  try {
    const partId = cleanObjectId((await ctx.params).partId);
    const body = await request.json().catch(() => ({}));
    const status = META_STATUS[body.status];
    if (!status) throw new MetaApiError('estado inválido', { status: 400, code: 'BAD_REQUEST' });

    const accessToken = await getMetaAccessToken(request);
    await setMetaObjectStatus(accessToken, partId, status, 'cambio de estado de anuncio o conjunto');
    return Response.json({ ok: true, status: status === 'ACTIVE' ? 'active' : 'paused' });
  } catch (error) {
    return metaErrorResponse(error);
  }
}
