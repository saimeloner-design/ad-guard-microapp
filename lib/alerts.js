// Motor de alertas. Funciones puras: reciben métricas de 30 días y devuelven
// alertas en lenguaje simple. Criterios documentados en docs/SPEC.md §4.

export const ALERT_CONFIG = {
  minImpressions: 1000, // datos mínimos para evaluar una campaña...
  minClicks: 30, // ...basta con cumplir uno de los dos
  noResultsClicks: 50, // R1: clics sin ninguna conversión
  noResultsCpaMultiplier: 2, // R1: gasto ≥ 2× costo por resultado de la cuenta
  expensiveCpaMultiplier: 2.5, // R2
  expensiveCpcMultiplier: 3, // R4
  minCtrByChannel: { SEARCH: 0.01, SHOPPING: 0.005 }, // R3
  minCtrDefault: 0.001, // R3: Display, Video, Performance Max, etc.
};

export const SEVERITY = { PAUSE: 'pause', REVIEW: 'review' };

export function formatMoney(amount, currency = 'CLP') {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    maximumFractionDigits: amount >= 100 || currency === 'CLP' ? 0 : 2,
  }).format(amount);
}

const ratio = (a, b) => (b > 0 ? a / b : null);

function sumBy(list, key) {
  return list.reduce((acc, c) => acc + c[key], 0);
}

function hasEnoughData(c, cfg) {
  return c.impressions >= cfg.minImpressions || c.clicks >= cfg.minClicks;
}

/**
 * @param {Array<{id,name,status,channel,cost,clicks,impressions,conversions}>} campaigns
 * @param {{currency?: string, platform?: string, config?: object}} options
 */
export function evaluateAccount(campaigns, { currency = 'CLP', platform = 'Google', config = ALERT_CONFIG } = {}) {
  const money = (v) => formatMoney(v, currency);

  const totalCost = sumBy(campaigns, 'cost');
  const totalClicks = sumBy(campaigns, 'clicks');
  const totalConversions = sumBy(campaigns, 'conversions');
  const measuring = totalConversions > 0;
  const accountCpa = ratio(totalCost, totalConversions);

  const accountAlerts = [];
  if (!measuring && totalCost > 0) {
    accountAlerts.push({
      rule: 'A1',
      severity: SEVERITY.REVIEW,
      title: 'No estamos viendo ventas ni contactos',
      message: `Gastaste ${money(totalCost)} en 30 días y ${platform} no registra ningún resultado. Puede que no tengas configurada la medición de conversiones, así que no podemos saber qué campañas te traen clientes.`,
    });
  }

  const evaluated = campaigns.map((c) => {
    const ctr = ratio(c.clicks, c.impressions);
    const cpc = ratio(c.cost, c.clicks);
    const cpa = ratio(c.cost, c.conversions);
    const base = { ...c, ctr, cpc, cpa, alerts: [], learning: false };

    if (c.status !== 'active') return base;
    if (!hasEnoughData(c, config)) return { ...base, learning: true };

    const others = campaigns.filter((o) => o.id !== c.id);
    const alerts = [];

    // R1 — Gasto sin resultados
    if (measuring && c.conversions === 0 && c.cost > 0) {
      const overCpa = accountCpa && c.cost >= config.noResultsCpaMultiplier * accountCpa;
      if (overCpa || c.clicks >= config.noResultsClicks) {
        alerts.push({
          rule: 'R1',
          severity: SEVERITY.PAUSE,
          title: 'Gasta dinero sin traer resultados',
          message: `Gastaste ${money(c.cost)} y recibiste ${c.clicks} clics, pero ninguno terminó en una venta o contacto.`,
        });
      }
    }

    // R2 — Resultados muy caros comparado con las otras campañas
    if (measuring && c.conversions > 0) {
      const peers = others.filter((o) => o.conversions > 0);
      const peerCpa = ratio(sumBy(peers, 'cost'), sumBy(peers, 'conversions'));
      if (peerCpa && cpa >= config.expensiveCpaMultiplier * peerCpa) {
        alerts.push({
          rule: 'R2',
          severity: SEVERITY.REVIEW,
          title: 'Cada resultado te sale muy caro',
          message: `Cada venta o contacto te cuesta ${money(cpa)}; en tus otras campañas cuesta ${money(peerCpa)}.`,
        });
      }
    }

    // R3 — CTR bajo según el tipo de campaña
    const minCtr = config.minCtrByChannel[c.channel] ?? config.minCtrDefault;
    if (c.impressions >= config.minImpressions && ctr !== null && ctr < minCtr) {
      alerts.push({
        rule: 'R3',
        severity: SEVERITY.REVIEW,
        title: 'Casi nadie hace clic en tu anuncio',
        message: `Tu anuncio se mostró ${c.impressions.toLocaleString('es-CL')} veces y sólo ${c.clicks} personas hicieron clic. Prueba con otro texto o imagen.`,
      });
    }

    // R4 — Clics muy caros comparado con las otras campañas
    if (cpc !== null) {
      const peers = others.filter((o) => o.clicks > 0);
      const peerCpc = ratio(sumBy(peers, 'cost'), sumBy(peers, 'clicks'));
      if (peerCpc && cpc >= config.expensiveCpcMultiplier * peerCpc) {
        alerts.push({
          rule: 'R4',
          severity: SEVERITY.REVIEW,
          title: 'Los clics te salen muy caros',
          message: `Cada clic te cuesta ${money(cpc)}; en tus otras campañas cuesta ${money(peerCpc)}.`,
        });
      }
    }

    return { ...base, alerts };
  });

  const active = evaluated.filter((c) => c.status === 'active');
  const toPause = active.filter((c) => c.alerts.some((a) => a.severity === SEVERITY.PAUSE));

  return {
    campaigns: evaluated.sort(compareBySeverity),
    summary: {
      totalCost,
      totalClicks,
      totalConversions,
      accountCpa,
      measuring,
      activeCount: active.length,
      alertCount: active.filter((c) => c.alerts.length > 0).length,
      potentialSavings: sumBy(toPause, 'cost'),
    },
    accountAlerts,
  };
}

function severityRank(c) {
  if (c.status !== 'active') return 3;
  if (c.alerts.some((a) => a.severity === SEVERITY.PAUSE)) return 0;
  if (c.alerts.length > 0) return 1;
  return 2;
}

function compareBySeverity(a, b) {
  return severityRank(a) - severityRank(b) || b.cost - a.cost;
}
