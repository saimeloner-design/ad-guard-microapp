// Campañas que van bien y campañas aprendiendo (docs/SPEC.md §4f). Funciones puras,
// como las alertas: explican por qué una campaña sin alertas va bien y cuánto le
// falta a una que todavía aprende para que podamos evaluarla.

const fmt = (n, digits = 0) => n.toLocaleString('es-CL', { maximumFractionDigits: digits });
const pct = (n) => n.toLocaleString('es-CL', { style: 'percent', maximumFractionDigits: 1 });
const DAY = 86_400_000;

/** Resultados que Meta suele necesitar en una semana para terminar de aprender ("unos 50", según Meta). */
export const LEARNING_GOAL = 50;

const joinWords = (list) => (list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} y ${list.at(-1)}`);
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Revisiones que pasó una campaña sin alertas, con sus cifras. Sólo las que se pueden
 * calcular con sus datos (p. ej. "los clics llegan a tu web" sólo si el píxel mide visitas).
 * @param c campaña evaluada (con `measured`, `ctr`, `costPerResult`, `reference`)
 * @param steps recorrido de la gente (lib/diagnosis-meta.js, funnelSteps)
 * @param best el objetivo ("Ventas") si es la mejor campaña de su objetivo en 18 meses
 * @returns {{title, summary, checks: Array<{key, text}>, advice, headline, steps?} | null}
 */
export function healthOf(c, { type, config, money, steps, best }) {
  const checks = [];
  const shorts = [];
  const label = type.label.toLowerCase();

  if (type.conversion && c.measured) {
    checks.push({ key: 'results', text: `Consigue ${label}: ${fmt(c.results)} en 30 días` });
  }
  const cheaper = c.reference && c.costPerResult !== null && c.costPerResult <= 0.9 * c.reference.costPerResult;
  if (c.reference && c.costPerResult !== null) {
    const peers = c.reference.source === 'peers';
    checks.push({
      key: 'price',
      text: `${cheaper ? 'Buen precio' : 'Precio normal'}: ${money(c.costPerResult)} por ${type.one} (${peers ? 'otras' : 'el mes anterior'}: ${money(c.reference.costPerResult)})`,
    });
    shorts.push(`cada ${type.one} sale a buen precio`);
  } else if (checks.length) {
    shorts.push(`consigue ${label}`);
  }
  if (type.ctr && c.impressions >= config.lowCtrImpressions && c.ctr !== null) {
    checks.push({ key: 'ctr', text: `La gente hace clic: ${pct(c.ctr)}` });
    shorts.push('la gente hace clic');
  }
  if (type.web && c.linkClicks >= config.landingMinClicks && c.landingPageViews > 0) {
    checks.push({ key: 'web', text: `Los clics llegan a tu web: ${pct(Math.min(1, c.landingPageViews / c.linkClicks))}` });
    shorts.push('llega a tu web');
  }
  if (c.resultType !== 'reach' && c.last7?.frequency > 0) {
    checks.push({ key: 'fatigue', text: `No se desgasta: cada persona lo vio ${fmt(c.last7.frequency, 1)} veces esta semana` });
    shorts.push('el anuncio no se desgasta');
  }
  if (c.resultType === 'purchase' && c.measured && c.results >= config.minRoasPurchases && c.purchaseValue > 0) {
    checks.push({ key: 'roas', text: `Vende más de lo que gasta: ${fmt(c.purchaseValue / c.cost, 1)} veces` });
    shorts.push('vende más de lo que gasta');
  }
  if (!checks.length) return null;

  const n = checks.length;
  const suffix = best ? ` · tu mejor de ${type.objective.toLowerCase()}` : cheaper ? ` · más barato que ${c.reference.source === 'peers' ? 'tus otras' : 'el mes anterior'}` : '';
  return {
    title: `Va bien: pasó ${n === 1 ? 'la revisión' : `las ${n} revisiones`}`,
    summary: `${capitalize(joinWords(shorts.slice(0, 3)))}.`,
    checks,
    advice: 'Déjala como está: cambiarle el público o el anuncio puede hacer que Meta vuelva a aprender y suba el costo.',
    // Línea de la lista de campañas, p. ej. "34 compras a $4.200 · tu mejor de ventas".
    headline:
      c.costPerResult !== null && c.results > 0 && c.resultType !== 'reach'
        ? `${fmt(c.results)} ${c.results === 1 ? type.one : label} a ${money(c.costPerResult)}${suffix}`
        : null,
    ...(steps?.length > 1 && { steps }),
  };
}

/** Lo que se va a revisar cuando la campaña termine de aprender o junte datos. */
export function pendingChecks(c, type) {
  const list = [];
  if (type.conversion) list.push(`Que consiga ${type.label.toLowerCase()}`);
  if (type.compare) list.push(`Que cada ${type.one} no cueste mucho más que en tus otras campañas`);
  if (type.ctr) list.push('Que la gente haga clic');
  if (type.web) list.push('Que los clics lleguen a tu web');
  if (c.resultType !== 'reach') list.push('Que el anuncio no se desgaste');
  if (c.resultType === 'purchase') list.push('Que vendas más de lo que gastas');
  if (c.learningStatus === 'LEARNING') list.push('Que Meta no la marque con aprendizaje limitado');
  return list;
}

/**
 * Cuánto le falta a una campaña que todavía no se evalúa.
 * - meta: Meta está aprendiendo; `results` de ~`goal` en la semana desde el último cambio grande.
 * - data: le faltan impresiones o clics para nuestros datos mínimos; `daysLeft` al ritmo actual.
 */
export function learningProgress(c, { config, now = Date.now() }) {
  const ageDays = c.createdTime ? Math.max(1, Math.floor((now - new Date(c.createdTime).getTime()) / DAY)) : null;

  if (c.learningStatus === 'LEARNING') {
    const info = c.learningInfo ?? {};
    const results = Number.isFinite(info.conversions) ? info.conversions : null;
    const editDays = info.lastEdit ? Math.max(0, Math.floor((now - info.lastEdit) / DAY)) : null;
    // Al ritmo desde el último cambio grande, ¿junta las ~50 en la semana?
    const perDay = results !== null && editDays >= 1 ? results / editDays : null;
    const slow = perDay !== null && editDays < 7 && results + perDay * (7 - editDays) < LEARNING_GOAL;
    return {
      kind: 'meta',
      results,
      goal: LEARNING_GOAL,
      percent: results === null ? null : Math.min(1, results / LEARNING_GOAL),
      editDays,
      perDay,
      daysToWeek: slow ? 7 - editDays : null,
      slow,
      ageDays,
    };
  }

  const days = Math.min(30, ageDays ?? 30);
  const left = [
    [c.impressions, config.minImpressions],
    [c.linkClicks, config.minClicks],
  ]
    .filter(([value]) => value > 0)
    .map(([value, goal]) => (goal - value) / (value / days));
  return {
    kind: 'data',
    impressions: c.impressions,
    minImpressions: config.minImpressions,
    clicks: c.linkClicks,
    minClicks: config.minClicks,
    percent: Math.min(1, Math.max(c.impressions / config.minImpressions, c.linkClicks / config.minClicks)),
    daysLeft: left.length ? Math.max(1, Math.ceil(Math.min(...left))) : null,
    ageDays,
  };
}
