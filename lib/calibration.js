import { log } from '@/lib/log';

// Registro para calibrar los umbrales de las alertas con cuentas reales (docs/SPEC.md §7).
// Meta: un registro por campaña y día en la base de datos (§9). Google (oculto): un log por
// campaña en el flujo `calibration`. Sin nombres de campañas ni datos personales: sólo
// métricas, que se comparan como proporciones (sirven en cualquier moneda).

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
    setupProblems: c.setup?.problems ?? 'none',
  };
}

const alertRules = (alerts) => alerts.map((a) => a.rule);

/**
 * Guarda el resumen de la cuenta y las métricas de cada campaña del día (Meta).
 * `db`: cliente dentro de una transacción. `evaluation`: resultado de evaluateMetaAccount.
 */
export async function saveMetaCalibration(db, { accountId, day, evaluation }) {
  const { summary } = evaluation;
  await db.query(
    `insert into account_days (meta_account_id, day, campaigns, active_count, alert_count, total_cost, potential_savings, account_alerts)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (meta_account_id, day) do update set
       campaigns = excluded.campaigns, active_count = excluded.active_count, alert_count = excluded.alert_count,
       total_cost = excluded.total_cost, potential_savings = excluded.potential_savings,
       account_alerts = excluded.account_alerts, updated_at = now()`,
    [
      accountId,
      day,
      evaluation.campaigns.length,
      summary.activeCount,
      summary.alertCount,
      round(summary.totalCost, 2) ?? null,
      round(summary.potentialSavings, 2) ?? null,
      alertRules(evaluation.accountAlerts),
    ]
  );
  if (evaluation.campaigns.length === 0) return;

  const rows = evaluation.campaigns.map((c) => {
    // objective, resultType y results ya van como columnas.
    const { objective, resultType, results, ...metrics } = metaAttributes(c);
    return {
      meta_campaign_id: c.id,
      status: c.status,
      objective,
      result_type: resultType,
      cost: round(c.cost, 2),
      impressions: c.impressions,
      results,
      cost_per_result: round(c.costPerResult, 2),
      learning: c.learning,
      alerts: alertRules(c.alerts),
      metrics,
    };
  });
  // Todas las campañas en una sola consulta: el arreglo viaja como un único parámetro JSON.
  await db.query(
    `insert into campaign_days (meta_campaign_id, day, meta_account_id, status, objective, result_type, cost, impressions,
       results, cost_per_result, learning, alerts, metrics)
     select r.meta_campaign_id, $2, $3, r.status, r.objective, r.result_type, r.cost, r.impressions,
       r.results, r.cost_per_result, r.learning, coalesce(r.alerts, '{}'), coalesce(r.metrics, '{}')
     from jsonb_to_recordset($1::jsonb) as r(meta_campaign_id text, status text, objective text, result_type text, cost numeric,
       impressions bigint, results numeric, cost_per_result numeric, learning boolean, alerts text[], metrics jsonb)
     on conflict (meta_campaign_id, day) do update set
       meta_account_id = excluded.meta_account_id, status = excluded.status, objective = excluded.objective,
       result_type = excluded.result_type, cost = excluded.cost, impressions = excluded.impressions,
       results = excluded.results, cost_per_result = excluded.cost_per_result, learning = excluded.learning,
       alerts = excluded.alerts, metrics = excluded.metrics, updated_at = now()`,
    [JSON.stringify(rows), day, accountId]
  );
}

/** Google (oculto): logs en Sentry. `evaluation`: resultado de evaluateAccount. */
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
