import { cleanOptionalId, recordEvent } from '@/lib/events';
import { flushLogsAfterResponse, log } from '@/lib/log';
import { cleanCampaignId, copyMetaCampaign, getMetaSession, metaErrorResponse } from '@/lib/meta-ads';

// "Crear una igual": copia en pausa una campaña que funcionó.
export async function POST(request, ctx) {
  flushLogsAfterResponse();
  try {
    const campaignId = cleanCampaignId((await ctx.params).campaignId);
    const body = await request.json().catch(() => ({}));
    const { accessToken, userId } = await getMetaSession(request);
    const copy = await copyMetaCampaign(accessToken, campaignId);
    log('info', 'meta-ads', 'Campaña copiada', { campaignId, copiedCampaignId: copy.campaignId });
    recordEvent({ userId, accountId: cleanOptionalId(body.accountId), campaignId, type: 'copy', data: { copiedCampaignId: copy.campaignId } });
    return Response.json(copy);
  } catch (error) {
    return metaErrorResponse(error);
  }
}
