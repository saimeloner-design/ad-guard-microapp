import { cleanNumber, cleanOptionalId, cleanRules, recordEvent } from '@/lib/events';
import { flushLogsAfterResponse } from '@/lib/log';
import { cleanObjectId, getMetaSession, MetaApiError, metaErrorResponse, setMetaObjectStatus } from '@/lib/meta-ads';

// "Pausa solo esta parte": pausa o reactiva un anuncio o un conjunto de anuncios.
const META_STATUS = { PAUSED: 'PAUSED', ENABLED: 'ACTIVE' };

export async function POST(request, ctx) {
  flushLogsAfterResponse();
  try {
    const partId = cleanObjectId((await ctx.params).partId);
    const body = await request.json().catch(() => ({}));
    const status = META_STATUS[body.status];
    if (!status) throw new MetaApiError('estado inválido', { status: 400, code: 'BAD_REQUEST' });

    const { accessToken, userId } = await getMetaSession(request);
    await setMetaObjectStatus(accessToken, partId, status, 'cambio de estado de anuncio o conjunto');
    recordEvent({
      userId,
      accountId: cleanOptionalId(body.accountId),
      campaignId: cleanOptionalId(body.campaignId),
      type: status === 'ACTIVE' ? 'part_enable' : 'part_pause',
      data: {
        partId,
        level: body.level === 'adset' ? 'adset' : 'ad',
        alerts: cleanRules(body.alerts),
        cost: cleanNumber(body.cost),
      },
    });
    return Response.json({ ok: true, status: status === 'ACTIVE' ? 'active' : 'paused' });
  } catch (error) {
    return metaErrorResponse(error);
  }
}
