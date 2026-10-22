import { cleanNumber, cleanOptionalId, cleanRules, recordEvent } from '@/lib/events';
import { flushLogsAfterResponse } from '@/lib/log';
import { cleanCampaignId, getMetaSession, MetaApiError, metaErrorResponse, setMetaCampaignStatus } from '@/lib/meta-ads';

// El panel usa los estados de Google Ads; en Meta "ENABLED" se llama "ACTIVE".
const META_STATUS = { PAUSED: 'PAUSED', ENABLED: 'ACTIVE' };

export async function POST(request, ctx) {
  flushLogsAfterResponse();
  try {
    const campaignId = cleanCampaignId((await ctx.params).campaignId);
    const body = await request.json().catch(() => ({}));
    const status = META_STATUS[body.status];
    if (!status) throw new MetaApiError('estado inválido', { status: 400, code: 'BAD_REQUEST' });

    const { accessToken, userId } = await getMetaSession(request);
    await setMetaCampaignStatus(accessToken, campaignId, status);
    // `alerts` y `cost`: lo que el usuario veía al confirmar (reglas y gasto de 30 días).
    recordEvent({
      userId,
      accountId: cleanOptionalId(body.accountId),
      campaignId,
      type: status === 'ACTIVE' ? 'enable' : 'pause',
      data: { alerts: cleanRules(body.alerts), cost: cleanNumber(body.cost) },
    });
    return Response.json({ ok: true, status: status === 'ACTIVE' ? 'active' : 'paused' });
  } catch (error) {
    return metaErrorResponse(error);
  }
}
