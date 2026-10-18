import { evaluateMetaAccount } from '@/lib/alerts-meta';
import { logCalibration } from '@/lib/calibration';
import { flushLogsAfterResponse } from '@/lib/log';
import { cleanAdAccountId, getMetaAccessToken, getMetaBreakdown, getMetaCampaigns, metaErrorResponse } from '@/lib/meta-ads';
import { logWasteConcentration, runInShadow } from '@/lib/shadow';

export async function GET(request) {
  flushLogsAfterResponse();
  try {
    const params = request.nextUrl.searchParams;
    const accountId = cleanAdAccountId(params.get('accountId'));
    // Uso interno para pruebas: ?inactivas=1 en la app muestra también las campañas antiguas sin gasto.
    const includeInactive = params.get('inactivas') === '1';
    const accessToken = await getMetaAccessToken(request);
    const { account, campaigns, hiddenCount, context } = await getMetaCampaigns(accessToken, accountId, { includeInactive });
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
    return Response.json({ account, context, hiddenCount, ...result });
  } catch (error) {
    return metaErrorResponse(error);
  }
}
