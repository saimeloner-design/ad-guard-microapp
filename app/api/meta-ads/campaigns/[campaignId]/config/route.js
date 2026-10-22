import { flushLogsAfterResponse } from '@/lib/log';
import { cleanCampaignId, getMetaAccessToken, getMetaCampaignConfig, metaErrorResponse } from '@/lib/meta-ads';

// "Configuración de esta campaña": se pide sólo cuando el usuario abre esa sección (docs/SPEC.md §4f).
export async function GET(request, ctx) {
  flushLogsAfterResponse();
  try {
    const campaignId = cleanCampaignId((await ctx.params).campaignId);
    const currency = request.nextUrl.searchParams.get('currency');
    const accessToken = await getMetaAccessToken(request);
    const config = await getMetaCampaignConfig(accessToken, campaignId, /^[A-Z]{3}$/.test(currency ?? '') ? currency : 'CLP');
    return Response.json({ config });
  } catch (error) {
    return metaErrorResponse(error);
  }
}
