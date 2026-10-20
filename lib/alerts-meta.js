// Motor de alertas para Meta Ads. Funciones puras, como lib/alerts.js, pero con
// criterios propios de Meta: el resultado que importa depende del objetivo de la
// campaña y hay señales que Google no tiene (aprendizaje, frecuencia, rechazos).
// Criterios documentados en docs/SPEC.md §4b.

import { compareBySeverity, formatMoney, SEVERITY } from '@/lib/alerts';
import { diagnoseMetaCampaign } from '@/lib/diagnosis-meta';

export const META_ALERT_CONFIG = {
  minImpressions: 1000, // datos mínimos para evaluar una campaña...
  minClicks: 30, // ...basta con cumplir uno de los dos (clics en el enlace)
  minReferenceResults: 5, // resultados mínimos para que una referencia sirva para comparar
  noResultsClicks: 50, // M1: clics en el enlace sin ningún resultado
  noResultsCostMultiplier: 2, // M1: gasto ≥ 2× el costo por resultado de referencia
  noResultsMessageImpressions: 5000, // M1: mensajes casi no generan clics en el enlace; se usan impresiones
  expensivePeersMultiplier: 2.5, // M2: contra otras campañas con el mismo objetivo
  expensiveHistoryMultiplier: 2, // M2: contra la misma campaña el mes anterior
  minRoasPurchases: 5, // M3
  minRoas: 1, // M3
  fatigueFrequency: 3, // M4: veces promedio que cada persona vio el anuncio en 7 días
  fatigueCtrDrop: 0.3, // M4: caída del CTR de los últimos 7 días contra los 23 anteriores
  fatigueMinImpressions: 1000, // M4: impresiones mínimas en cada uno de los dos períodos
  landingMinClicks: 100, // M7
  minLandingRate: 0.5, // M7: visitas a la página / clics en el enlace
  lowCtrImpressions: 3000, // M8
  minLinkCtr: 0.004, // M8
  wastedPartCostMultiplier: 2, // Diagnóstico: anuncio o conjunto sin resultados que gastó ≥ 2× el costo por resultado de la campaña
};

/**
 * Qué cuenta como resultado según el objetivo.
 * - conversion: un resultado concreto (venta, contacto…); M1 aplica.
 * - pixel: se mide con el píxel de Meta en la web; A1 aplica.
 * - compare: tiene sentido comparar su costo por resultado (M2).
 * - ctr / web: aplican M8 y M7.
 */
export const RESULT_TYPES = {
  purchase: { one: 'compra', none: 'ninguna compra', label: 'Compras', costLabel: 'Costo por compra', conversion: true, pixel: true, compare: true, ctr: true, web: true },
  lead: { one: 'contacto', none: 'ningún contacto', label: 'Contactos', costLabel: 'Costo por contacto', conversion: true, pixel: true, compare: true, ctr: true, web: true },
  message: { one: 'conversación', none: 'ninguna conversación', label: 'Conversaciones', costLabel: 'Costo por conversación', conversion: true, compare: true },
  app_install: { one: 'instalación', none: 'ninguna instalación', label: 'Instalaciones', costLabel: 'Costo por instalación', conversion: true, compare: true, ctr: true },
  traffic: { one: 'clic', none: 'ningún clic', label: 'Clics al enlace', costLabel: 'Costo por clic', compare: true, ctr: true, web: true },
  engagement: { one: 'interacción', none: 'ninguna interacción', label: 'Interacciones', costLabel: 'Costo por interacción', compare: true },
  reach: { one: 'persona', none: 'nadie', label: 'Personas alcanzadas', costLabel: 'Costo por 1.000 personas' },
};

// Incluye objetivos antiguos que siguen apareciendo en campañas creadas antes de 2023.
const OBJECTIVE_RESULT = {
  OUTCOME_SALES: 'purchase',
  CONVERSIONS: 'purchase',
  PRODUCT_CATALOG_SALES: 'purchase',
  OUTCOME_LEADS: 'lead',
  LEAD_GENERATION: 'lead',
  MESSAGES: 'message',
  OUTCOME_APP_PROMOTION: 'app_install',
  APP_INSTALLS: 'app_install',
  OUTCOME_TRAFFIC: 'traffic',
  LINK_CLICKS: 'traffic',
  OUTCOME_ENGAGEMENT: 'engagement',
  POST_ENGAGEMENT: 'engagement',
  PAGE_LIKES: 'engagement',
  VIDEO_VIEWS: 'engagement',
  EVENT_RESPONSES: 'engagement',
  OUTCOME_AWARENESS: 'reach',
  BRAND_AWARENESS: 'reach',
  REACH: 'reach',
};

/** Las campañas de mensajes se crean con objetivo Ventas, Clientes potenciales o Interacción: se reconocen por el conjunto de anuncios. */
export function resultTypeFor(objective, optimizationGoals = []) {
  if (optimizationGoals.includes('CONVERSATIONS')) return 'message';
  return OBJECTIVE_RESULT[objective] ?? 'traffic';
}

// Meta reporta la misma conversión con varios nombres: de cada grupo se toma
// sólo el primero que aparezca para no contarla dos veces.
const RESULT_ACTIONS = {
  purchase: [['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase']],
  lead: [
    ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'],
    ['contact_total', 'offsite_conversion.fb_pixel_contact'],
    ['complete_registration', 'offsite_conversion.fb_pixel_complete_registration'],
  ],
  message: [['onsite_conversion.messaging_conversation_started_7d']],
  app_install: [['omni_app_install', 'mobile_app_install', 'app_install']],
  engagement: [['post_engagement']],
};

function sumActions(actions = [], groups) {
  const byType = new Map(actions.map((a) => [a.action_type, Number(a.value || 0)]));
  return groups.reduce((sum, group) => sum + (byType.get(group.find((t) => byType.has(t))) ?? 0), 0);
}

/** Resultados de una fila de insights de Meta según el tipo de resultado de la campaña. */
export function countResults(type, row = {}) {
  if (type === 'traffic') return Number(row.inline_link_clicks || 0);
  if (type === 'reach') return Number(row.reach || 0);
  return sumActions(row.actions, RESULT_ACTIONS[type]);
}

export const purchaseValue = (row = {}) => sumActions(row.action_values, RESULT_ACTIONS.purchase);
export const landingPageViews = (row = {}) => sumActions(row.actions, [['landing_page_view', 'omni_landing_page_view']]);

const ratio = (a, b) => (b > 0 ? a / b : null);
const sumBy = (list, key) => list.reduce((acc, c) => acc + (c[key] || 0), 0);
const fmt = (n, digits = 0) => n.toLocaleString('es-CL', { maximumFractionDigits: digits });
const pct = (n) => n.toLocaleString('es-CL', { style: 'percent', maximumFractionDigits: 1 });

/**
 * Con qué comparar el costo por resultado, en orden:
 * 1. otras campañas con el mismo tipo de resultado en los últimos 90 días (incluye pausadas y terminadas);
 * 2. la misma campaña en los 30 días anteriores;
 * 3. nada: no se juzga si es "caro".
 */
export function referenceFor(c, history = [], config = META_ALERT_CONFIG) {
  const peers = history.filter((h) => h.campaignId !== c.id && h.resultType === c.resultType && h.results > 0);
  const peerResults = sumBy(peers, 'results');
  if (peerResults >= config.minReferenceResults) {
    return { source: 'peers', costPerResult: sumBy(peers, 'cost') / peerResults };
  }
  if (c.previous?.results >= config.minReferenceResults) {
    return { source: 'history', costPerResult: c.previous.cost / c.previous.results };
  }
  return null;
}

// Estados de la cuenta publicitaria que detienen o ponen en riesgo los anuncios.
const ACCOUNT_STATUS_ALERTS = {
  3: {
    title: 'Tienes un pago pendiente con Meta',
    message: 'Tus anuncios están detenidos hasta que pagues el saldo pendiente. Revísalo en la sección de facturación de Meta.',
  },
  7: {
    title: 'Meta está revisando tu cuenta',
    message: 'Mientras dure la revisión es posible que tus anuncios no se muestren.',
  },
  9: {
    title: 'Un pago a Meta falló',
    message: 'Tu cuenta está en período de gracia: si no actualizas el medio de pago, tus anuncios se detendrán.',
  },
};

function campaignKpis(c, type, costPerResult, money) {
  const kpis = [
    { label: 'Gasto', value: money(c.cost) },
    { label: type.label, value: fmt(c.results) },
    { label: type.costLabel, value: costPerResult === null ? '—' : money(costPerResult) },
  ];
  const details = [];
  if (c.reach > 0) details.push(`Llegó a ${fmt(c.reach)} personas, que lo vieron ${fmt(c.frequency, 1)} veces en promedio.`);
  if (c.resultType === 'purchase' && c.purchaseValue > 0 && c.cost > 0) {
    details.push(`Tus ventas registradas suman ${money(c.purchaseValue)} (${fmt(c.purchaseValue / c.cost, 1)} veces lo que gastaste).`);
  }
  return { kpis, detail: details.join(' ') || undefined };
}

/**
 * @param {Array} campaigns campañas armadas por lib/meta-ads.js (getMetaCampaigns)
 * @param {{currency?: string, context?: {accountStatus?: number, reach?: number, history?: Array}, config?: object}} options
 */
export function evaluateMetaAccount(campaigns, { currency = 'CLP', context = {}, config = META_ALERT_CONFIG } = {}) {
  const money = (v) => formatMoney(v, currency);
  const totalCost = sumBy(campaigns, 'cost');

  const accountAlerts = [];
  const statusAlert = ACCOUNT_STATUS_ALERTS[context.accountStatus];
  if (statusAlert) accountAlerts.push({ rule: 'A2', severity: SEVERITY.REVIEW, ...statusAlert });

  // A1 — Campañas que dependen del píxel sin ninguna conversión: probablemente no se está midiendo.
  const pixelCampaigns = campaigns.filter((c) => RESULT_TYPES[c.resultType].pixel);
  const pixelCost = sumBy(pixelCampaigns, 'cost');
  const pixelMissing = pixelCost > 0 && sumBy(pixelCampaigns, 'results') === 0;
  if (pixelMissing) {
    accountAlerts.push({
      rule: 'A1',
      severity: SEVERITY.REVIEW,
      title: 'No estamos viendo ventas ni contactos',
      message: `Tus campañas de ventas y contactos gastaron ${money(pixelCost)} en 30 días y Meta no registra ningún resultado. Puede que no tengas instalado el píxel de Meta en tu web, así que no podemos saber cuáles te traen clientes.`,
    });
  }

  const evaluated = campaigns.map((c) => {
    const type = RESULT_TYPES[c.resultType];
    const costPerResult = c.results > 0 ? (c.cost / c.results) * (c.resultType === 'reach' ? 1000 : 1) : null;
    const ctr = ratio(c.linkClicks, c.impressions);
    const reference = type.compare ? referenceFor(c, context.history, config) : null;
    const measured = Boolean(type.conversion) && !(type.pixel && pixelMissing);

    // Fatiga: CTR de los últimos 7 días contra el de los 23 días anteriores.
    const before = { impressions: c.impressions - (c.last7?.impressions ?? 0), linkClicks: c.linkClicks - (c.last7?.linkClicks ?? 0) };
    const ctr7 = c.last7?.impressions >= config.fatigueMinImpressions ? ratio(c.last7.linkClicks, c.last7.impressions) : null;
    const ctrBefore = before.impressions >= config.fatigueMinImpressions ? ratio(before.linkClicks, before.impressions) : null;
    const ctrDrop = ctr7 !== null && ctrBefore ? 1 - ctr7 / ctrBefore : null;

    const base = {
      ...c,
      channel: c.resultType === 'message' ? 'MESSAGES' : c.objective,
      ctr,
      costPerResult,
      reference,
      measured,
      ctrDrop,
      ...campaignKpis(c, type, costPerResult, money),
      alerts: [],
      // Al reevaluar en el navegador `c` ya trae el diagnóstico anterior: se recalcula siempre.
      diagnosis: null,
      learning: false,
    };
    if (c.status !== 'active') return base;

    const alerts = [];

    // M6 — Anuncios rechazados: se avisa siempre, explica por qué una campaña no se muestra.
    if (c.rejectedAds?.length) {
      const n = c.rejectedAds.length;
      const names = c.rejectedAds.slice(0, 3).join(', ') + (n > 3 ? '…' : '');
      alerts.push({
        rule: 'M6',
        severity: SEVERITY.REVIEW,
        title: 'Meta rechazó anuncios de esta campaña',
        message: `${n === 1 ? 'Un anuncio' : `${n} anuncios`} (${names}) no se ${n === 1 ? 'está mostrando' : 'están mostrando'} por un rechazo o un problema. ${n === 1 ? 'Revísalo' : 'Revísalos'} en el Administrador de anuncios.`,
      });
    }

    // Activa pero sin conjuntos de anuncios publicando: hoy no gasta, no tiene sentido recomendar pausarla.
    if (c.delivering === false) return { ...base, alerts };

    if (c.learningStatus === 'LEARNING') {
      return {
        ...base,
        alerts,
        learning: true,
        learningMessage: 'Aprendiendo: Meta todavía está aprendiendo a quién mostrarla. Espera unos días antes de juzgarla.',
      };
    }
    if (c.impressions < config.minImpressions && c.linkClicks < config.minClicks) return { ...base, alerts, learning: true };

    // M5 — Aprendizaje limitado
    if (c.learningStatus === 'FAIL') {
      alerts.push({
        rule: 'M5',
        severity: SEVERITY.REVIEW,
        title: 'Meta no logra optimizar esta campaña',
        message:
          'No junta suficientes resultados para que Meta aprenda a quién mostrarla (aprendizaje limitado). Prueba con más presupuesto, juntando conjuntos de anuncios o con un objetivo más simple.',
      });
    }

    // M1 — Gasto sin resultados
    if (measured && c.results === 0 && c.cost > 0) {
      const overReference = reference && c.cost >= config.noResultsCostMultiplier * reference.costPerResult;
      const manyClicks = c.linkClicks >= config.noResultsClicks;
      const unansweredMessages = c.resultType === 'message' && c.impressions >= config.noResultsMessageImpressions;
      if (overReference || manyClicks || unansweredMessages) {
        const comparison = overReference
          ? reference.source === 'peers'
            ? `En tus otras campañas con el mismo objetivo, cada ${type.one} te costó ${money(reference.costPerResult)}.`
            : `El mes anterior, en esta misma campaña, cada ${type.one} te costaba ${money(reference.costPerResult)}.`
          : manyClicks
            ? `${fmt(c.linkClicks)} personas hicieron clic, pero ninguna terminó en ${type.one === 'contacto' ? 'un contacto' : `una ${type.one}`}.`
            : `Tu anuncio se mostró ${fmt(c.impressions)} veces y nadie te escribió.`;
        alerts.push({
          rule: 'M1',
          severity: SEVERITY.PAUSE,
          title: 'Gasta dinero sin traer resultados',
          message: `Gastaste ${money(c.cost)} y no conseguiste ${type.none}. ${comparison}`,
        });
      }
    }

    // M2 — Resultado caro contra la referencia
    if (reference && c.results > 0 && (measured || !type.conversion)) {
      const peers = reference.source === 'peers';
      const multiplier = peers ? config.expensivePeersMultiplier : config.expensiveHistoryMultiplier;
      if (costPerResult >= multiplier * reference.costPerResult) {
        alerts.push({
          rule: 'M2',
          severity: SEVERITY.REVIEW,
          title: peers ? 'Cada resultado te sale muy caro' : 'Tus resultados te salen más caros que antes',
          message: peers
            ? `Cada ${type.one} te cuesta ${money(costPerResult)}; en tus otras campañas con el mismo objetivo cuesta ${money(reference.costPerResult)}.`
            : `Cada ${type.one} te cuesta ${money(costPerResult)}; el mes anterior te costaba ${money(reference.costPerResult)}.`,
        });
      }
    }

    // M3 — Vende menos de lo que gasta (sólo si Meta mide el valor de las ventas)
    if (c.resultType === 'purchase' && measured && c.results >= config.minRoasPurchases && c.purchaseValue > 0) {
      const roas = c.purchaseValue / c.cost;
      if (roas < config.minRoas) {
        alerts.push({
          rule: 'M3',
          severity: SEVERITY.REVIEW,
          title: 'Vendes menos de lo que gastas',
          message: `Gastaste ${money(c.cost)} y tus ventas registradas suman ${money(c.purchaseValue)}: recuperas ${Math.round(roas * 100)}% de lo que inviertes. Si tus clientes no vuelven a comprar, estás perdiendo dinero.`,
        });
      }
    }

    // M4 — Anuncio desgastado: las mismas personas lo ven muchas veces y cada vez hacen menos clic.
    if (c.resultType !== 'reach' && c.last7?.frequency >= config.fatigueFrequency && ctrDrop !== null && ctrDrop >= config.fatigueCtrDrop) {
      alerts.push({
        rule: 'M4',
        severity: SEVERITY.REVIEW,
        title: 'Tu anuncio se está desgastando',
        message: `En los últimos 7 días cada persona vio tus anuncios ${fmt(c.last7.frequency, 1)} veces en promedio y los clics bajaron ${Math.round(ctrDrop * 100)}%. Cambia la imagen o el texto para volver a llamar la atención.`,
      });
    }

    // M7 — Clics que no llegan a la web (sólo si el píxel mide las visitas)
    if (type.web && c.linkClicks >= config.landingMinClicks && c.landingPageViews > 0) {
      const rate = c.landingPageViews / c.linkClicks;
      if (rate < config.minLandingRate) {
        alerts.push({
          rule: 'M7',
          severity: SEVERITY.REVIEW,
          title: 'Muchos clics no llegan a tu web',
          message: `${fmt(c.linkClicks)} personas hicieron clic, pero sólo ${fmt(c.landingPageViews)} llegaron a ver tu página. Puede que tu web cargue lento o que el enlace esté mal.`,
        });
      }
    }

    // M8 — Casi nadie hace clic
    if (type.ctr && c.impressions >= config.lowCtrImpressions && ctr !== null && ctr < config.minLinkCtr) {
      alerts.push({
        rule: 'M8',
        severity: SEVERITY.REVIEW,
        title: 'Casi nadie hace clic en tu anuncio',
        message: `Tu anuncio se mostró ${fmt(c.impressions)} veces y sólo ${fmt(c.linkClicks)} personas hicieron clic (${pct(ctr)}). Prueba con otra imagen o texto.`,
      });
    }

    return { ...base, alerts, diagnosis: diagnoseMetaCampaign(base, alerts, { type, config, money }) };
  });

  const active = evaluated.filter((c) => c.status === 'active');
  const toPause = active.filter((c) => c.delivering !== false && c.alerts.some((a) => a.severity === SEVERITY.PAUSE));

  return {
    campaigns: evaluated.sort(compareBySeverity),
    summary: {
      totalCost,
      reach: context.reach,
      activeCount: active.length,
      alertCount: active.filter((c) => c.alerts.length > 0).length,
      potentialSavings: sumBy(toPause, 'cost'),
    },
    accountAlerts,
  };
}
