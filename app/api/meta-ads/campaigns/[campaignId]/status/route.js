import { flushLogsAfterResponse } from '@/lib/log';
import { cleanCampaignId, getMetaAccessToken, MetaApiError, metaErrorResponse, setMetaCampaignStatus } from '@/lib/meta-ads';

// El panel usa los estados de Google Ads; en Meta "ENABLED" se llama "ACTIVE".
const META_STATUS = { PAUSED: 'PAUSED', ENABLED: 'ACTIVE' };

export async function POST(request, ctx) {
  flushLogsAfterResponse();
  try {
    const campaignId = cleanCampaignId((await ctx.params).campaignId);
    const body = await request.json().catch(() => ({}));
    const status = META_STATUS[body.status];
    if (!status) throw new MetaApiError('estado inválido', { status: 400, code: 'BAD_REQUEST' });

    const accessToken = await getMetaAccessToken(request);
    await setMetaCampaignStatus(accessToken, campaignId, status);
    return Response.json({ ok: true, status: status === 'ACTIVE' ? 'active' : 'paused' });
  } catch (error) {
    return metaErrorResponse(error);
  }
}
