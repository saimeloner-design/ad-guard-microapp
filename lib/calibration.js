import { log } from '@/lib/log';

// Registro para calibrar los umbrales de las alertas con cuentas reales (docs/SPEC.md §7).
// Un log por campaña evaluada en el flujo `calibration`. Sin nombres de campañas ni
// datos personales: sólo métricas, que se comparan como proporciones (sirven en cualquier moneda).

const round = (v, digits = 4) => (v === null || v === undefined || !Number.isFinite(v) ? undefined : Number(v.toFixed(digits)));

function googleAttributes(c, summary) {
  return {
    channel: c.channel,
    clicks: c.clicks,
    conversions: round(c.conversions, 2),
    ctr: round(c.ctr),
    cpc: round(c.cpc, 2),
    cpa: round(c.cpa, 2),
    accountCpa: round(summary.accountCpa, 2),
    cpaVsAccount: round(c.cpa && summary.accountCpa ? c.cpa / summary.accountCpa : null, 2),
    measuring: summary.measuring,
  };
}

function metaAttributes(c) {
  return {
    objective: c.objective,
    resultType: c.resultType,
    delivering: c.delivering,
    reach: c.reach,
    frequency: round(c.frequency, 2),
    frequency7: round(c.last7?.frequency, 2),
    linkClicks: c.linkClicks,
    ctr: round(c.ctr),
    ctrDrop: round(c.ctrDrop, 3),
    landingRate: round(c.linkClicks > 0 && c.landingPageViews > 0 ? c.landingPageViews / c.linkClicks : null, 3),
    results: round(c.results, 2),
    costPerResult: round(c.costPerResult, 2),
    referenceSource: c.reference?.source ?? 'none',
    referenceCostPerResult: round(c.reference?.costPerResult, 2),
    costVsReference: round(c.costPerResult && c.reference ? c.costPerResult / c.reference.costPerResult : null, 2),
    roas: round(c.purchaseValue > 0 && c.cost > 0 ? c.purchaseValue / c.cost : null, 2),
    learningStatus: c.learningStatus ?? 'none',
    rejectedAds: c.rejectedAds?.length ?? 0,
    measured: c.measured,
    funnelBreak: c.diagnosis?.breakStep ?? 'none',
    cutLevel: c.diagnosis?.cut?.level ?? 'none',
    cutParts: c.diagnosis?.cut?.count ?? 0,
    pastShown: Boolean(c.diagnosis?.past),
    pastCompared: c.diagnosis?.past?.rows.length ?? 0,
  };
}

/** `platform`: 'google' | 'meta'. `evaluation`: resultado de evaluateAccount / evaluateMetaAccount. */
export function logCalibration(platform, account, evaluation) {
  for (const c of evaluation.campaigns) {
    log('info', 'calibration', `${platform}: métricas de campaña`, {
      platform,
      accountId: account.id,
      campaignId: c.id,
      currency: account.currency,
      status: c.status,
      cost: round(c.cost, 2),
      impressions: c.impressions,
      learning: c.learning,
      alerts: c.alerts.map((a) => a.rule).join(',') || 'none',
      ...(platform === 'meta' ? metaAttributes(c) : googleAttributes(c, evaluation.summary)),
    });
  }
  log('info', 'calibration', `${platform}: resumen de cuenta`, {
    platform,
    accountId: account.id,
    currency: account.currency,
    campaigns: evaluation.campaigns.length,
    activeCount: evaluation.summary.activeCount,
    alertCount: evaluation.summary.alertCount,
    totalCost: round(evaluation.summary.totalCost, 2),
    potentialSavings: round(evaluation.summary.potentialSavings, 2),
    accountAlerts: evaluation.accountAlerts.map((a) => a.rule).join(',') || 'none',
  });
}
