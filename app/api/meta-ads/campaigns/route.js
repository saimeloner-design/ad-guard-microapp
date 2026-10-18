import { evaluateMetaAccount } from '@/lib/alerts-meta';
import { logCalibration } from '@/lib/calibration';
import { flushLogsAfterResponse } from '@/lib/log';
import { cleanAdAccountId, getMetaAccessToken, getMetaBreakdown, getMetaCampaigns, metaErrorResponse } from '@/lib/meta-ads';
import { logWasteConcentration, runInShadow } from '@/lib/shadow';

export async function GET(request) {
  flushLogsAfterResponse();
  try {
    const accountId = cleanAdAccountId(request.nextUrl.searchParams.get('accountId'));
    const accessToken = await getMetaAccessToken(request);
    const { account, campaigns, context } = await getMetaCampaigns(accessToken, accountId);
    const result = evaluateMetaAccount(campaigns, { currency: account.currency, context });

    logCalibration('meta', account, result);
    runInShadow('meta', async () => {
      const types = new Map(campaigns.map((c) => [c.id, c.resultType]));
      const levels = await getMetaBreakdown(accessToken, accountId, types);
      for (const [level, children] of Object.entries(levels)) {
        logWasteConcentration({ platform: 'meta', level, accountId, evaluation: result, children, isMeasured: (c) => c.measured });
      }
    });

    // `context` vuelve al navegador para reevaluar las alertas al pausar o activar.
    return Response.json({ account, context, ...result });
  } catch (error) {
    return metaErrorResponse(error);
  }
}
