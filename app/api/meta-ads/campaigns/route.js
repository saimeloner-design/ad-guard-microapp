import { evaluateMetaAccount, findMetaWinners } from '@/lib/alerts-meta';
import { saveMetaCalibration } from '@/lib/calibration';
import { saveAfterResponse, today } from '@/lib/db';
import { isNewCampaign } from '@/lib/setup-review-meta';
import { flushLogsAfterResponse, reportError } from '@/lib/log';
import {
  cleanAdAccountId,
  getMetaSession,
  getMetaBreakdownRows,
  getMetaCampaignConfigs,
  getMetaCampaigns,
  measureMetaLongHistory,
  metaErrorResponse,
  normalizeBreakdown,
} from '@/lib/meta-ads';
import { runInShadow, saveMetaWasteConcentration } from '@/lib/shadow';
import { saveMetaVisit } from '@/lib/users';

export async function GET(request) {
  flushLogsAfterResponse();
  try {
    const params = request.nextUrl.searchParams;
    const accountId = cleanAdAccountId(params.get('accountId'));
    // Uso interno para pruebas: ?inactivas=1 en la app muestra también las campañas antiguas sin gasto.
    const includeInactive = params.get('inactivas') === '1';
    // Uso interno: ?historial3=1 mide en sombra cuánto tarda y consume pedir 3 años de historial (flujo `usage`).
    const measureLongHistory = params.get('historial3') === '1';
    const { accessToken, userId, email } = await getMetaSession(request);
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
    let result = evaluateMetaAccount(campaigns, { currency: account.currency, context });

    // La configuración (presupuesto, ubicación, edad, formato) sólo se lee para las campañas que se
    // comparan en "Lo que te funcionó antes", las mejores de cada objetivo ("Lo que funciona")
    // y las campañas nuevas (revisión de campaña nueva).
    const ids = new Set([
      ...result.campaigns.filter((c) => c.diagnosis?.past).flatMap((c) => [c.id, c.diagnosis.past.winnerId]),
      ...result.best.map((b) => b.id),
      ...campaigns.filter((c) => isNewCampaign(c)).map((c) => c.id),
    ]);
    if (ids.size) {
      context.configs = await getMetaCampaignConfigs(accessToken, [...ids], account.currency);
      result = evaluateMetaAccount(campaigns, { currency: account.currency, context });
    }

    // Calibración y análisis en sombra (docs/SPEC.md §7 y §9), después de responder.
    saveAfterResponse('campañas de Meta', async (db) => {
      const day = today(account.timezone);
      await saveMetaVisit(db, { userId, email, account });
      await saveMetaCalibration(db, { accountId, day, evaluation: result });
      if (breakdown) await saveMetaWasteConcentration(db, { accountId, day, evaluation: result, breakdown });
    });

    if (measureLongHistory) {
      runInShadow('meta-historial-3-anios', () =>
        measureMetaLongHistory(accessToken, accountId, new Map(campaigns.map((c) => [c.id, c.resultType])), {
          findWinners: findMetaWinners,
          yearHistory: context.yearHistory,
        })
      );
    }

    // `context` vuelve al navegador para reevaluar las alertas al pausar o activar.
    return Response.json({ account, context, hiddenCount, ...result });
  } catch (error) {
    return metaErrorResponse(error);
  }
}
