import { evaluateMetaAccount } from '@/lib/alerts-meta';
import { logCalibration } from '@/lib/calibration';
import { flushLogsAfterResponse, reportError } from '@/lib/log';
import {
  cleanAdAccountId,
  getMetaAccessToken,
  getMetaBreakdownRows,
  getMetaCampaigns,
  metaErrorResponse,
  normalizeBreakdown,
} from '@/lib/meta-ads';
import { logWasteConcentration, runInShadow } from '@/lib/shadow';

export async function GET(request) {
  flushLogsAfterResponse();
  try {
    const params = request.nextUrl.searchParams;
    const accountId = cleanAdAccountId(params.get('accountId'));
    // Uso interno para pruebas: ?inactivas=1 en la app muestra también las campañas antiguas sin gasto.
    const includeInactive = params.get('inactivas') === '1';
    const accessToken = await getMetaAccessToken(request);
    // El detalle por anuncio y conjunto se pide en paralelo. Si falla, el panel se muestra igual, sin "Pausa solo esta parte".
    const breakdownRows = getMetaBreakdownRows(accessToken, accountId).catch((error) => {
      reportError('meta-ads', 'No se pudo leer el detalle por conjunto y anuncio', error);
      return null;
    });
    const { account, campaigns, hiddenCount, context } = await getMetaCampaigns(accessToken, accountId, { includeInactive });

    const rows = await breakdownRows;
    const breakdown = rows && normalizeBreakdown(rows, new Map(campaigns.map((c) => [c.id, c.resultType])));
    if (breakdown) {
      const ads = Map.groupBy(breakdown.ad, (p) => p.campaignId);
      const adsets = Map.groupBy(breakdown.adset, (p) => p.campaignId);
      for (const c of campaigns) c.parts = { ad: ads.get(c.id) ?? [], adset: adsets.get(c.id) ?? [] };
    }
    const result = evaluateMetaAccount(campaigns, { currency: account.currency, context });

    logCalibration('meta', account, result);
    if (breakdown) {
      runInShadow('meta', async () => {
        for (const [level, children] of Object.entries(breakdown)) {
          logWasteConcentration({ platform: 'meta', level, accountId, evaluation: result, children, isMeasured: (c) => c.measured });
        }
      });
    }

    // `context` vuelve al navegador para reevaluar las alertas al pausar o activar.
    return Response.json({ account, context, hiddenCount, ...result });
  } catch (error) {
    return metaErrorResponse(error);
  }
}
