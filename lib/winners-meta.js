// "Lo que te funcionó antes" (docs/SPEC.md §4d). Funciones puras: eligen la mejor
// campaña de cada objetivo en los últimos 12 meses y comparan su configuración con
// la de una campaña actual. No importa lib/alerts-meta.js (que importa este módulo):
// los tipos de resultado y los umbrales llegan como parámetros.

/**
 * ¿La campaña habría tenido alguna alerta en el año? Sólo las reglas que se pueden
 * calcular con el total del período (M2, M3, M7, M8); M1 no aplica porque se exigen
 * resultados y M4 necesita el detalle semanal.
 */
function hadAlerts(h, type, peerCostPerResult, config) {
  const costPerResult = h.cost / h.results;
  if (peerCostPerResult && costPerResult >= config.expensivePeersMultiplier * peerCostPerResult) return true;
  if (type.ctr && h.impressions >= config.lowCtrImpressions && h.linkClicks / h.impressions < config.minLinkCtr) return true;
  if (type.web && h.linkClicks >= config.landingMinClicks && h.landingPageViews > 0 && h.landingPageViews / h.linkClicks < config.minLandingRate) {
    return true;
  }
  if (h.resultType === 'purchase' && h.purchaseValue > 0 && h.results >= config.minRoasPurchases && h.purchaseValue / h.cost < config.minRoas) {
    return true;
  }
  return false;
}

/**
 * Mejor campaña de cada tipo de resultado: sin alertas, con al menos
 * `config.minWinnerResults` resultados y el menor costo por resultado.
 * @param yearHistory campañas de los últimos 12 meses (lib/meta-ads.js, `context.yearHistory`)
 * @returns {Object<string, object>} por tipo de resultado
 */
export function findWinners(yearHistory = [], { types, config }) {
  const winners = {};
  for (const [resultType, list] of Map.groupBy(yearHistory, (h) => h.resultType)) {
    const type = types[resultType];
    if (!type?.compare) continue;
    const withResults = list.filter((h) => h.results > 0);
    const totalCost = withResults.reduce((acc, h) => acc + h.cost, 0);
    const totalResults = withResults.reduce((acc, h) => acc + h.results, 0);
    const eligible = withResults.filter((h) => {
      if (h.results < config.minWinnerResults) return false;
      // Igual que M2: se compara contra las demás campañas con el mismo objetivo.
      const peerResults = totalResults - h.results;
      const peerCostPerResult = peerResults >= config.minReferenceResults ? (totalCost - h.cost) / peerResults : null;
      return !hadAlerts(h, type, peerCostPerResult, config);
    });
    const best = eligible.sort((a, b) => a.cost / a.results - b.cost / b.results)[0];
    if (best) winners[resultType] = { ...best, costPerResult: best.cost / best.results };
  }
  return winners;
}

const FORMAT_ARTICLE = { Video: 'un video', Carrusel: 'un carrusel', Foto: 'una foto' };
const joinWords = (list) => (list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} y ${list.at(-1)}`);
const formatLabel = (formats) => joinWords(formats.map((f, i) => (i === 0 ? f : f.toLowerCase())));

/**
 * Diferencias entre la configuración de la campaña ganadora y la actual: presupuesto
 * diario, ubicación, edad y formato. Sólo se comparan los datos que existen en las dos.
 * @param then configuración de la ganadora (lib/meta-ads.js, getMetaCampaignConfigs)
 * @param now configuración de la campaña actual
 */
export function compareConfigs(then, now, money) {
  if (!then || !now) return { rows: [], changes: [] };
  const rows = [];
  const changes = [];
  if (then.dailyBudget && now.dailyBudget) {
    const diff = Math.abs(now.dailyBudget - then.dailyBudget) / then.dailyBudget > 0.2;
    rows.push({ key: 'budget', label: 'Presupuesto diario', then: money(then.dailyBudget), now: money(now.dailyBudget), diff });
    // El foco es no perder plata: sólo se sugiere bajar el presupuesto, nunca subirlo.
    if (diff && now.dailyBudget > then.dailyBudget) changes.push(`baja el presupuesto diario a ${money(then.dailyBudget)}`);
  }
  if (then.location && now.location) {
    const diff = then.location !== now.location;
    rows.push({ key: 'location', label: 'Ubicación', then: then.location, now: now.location, diff });
    if (diff) {
      const country = then.location.match(/^Todo (.+)$/)?.[1];
      changes.push(country ? `muestra el anuncio en todo ${country}` : `muestra el anuncio sólo en ${then.location}`);
    }
  }
  if (then.age && now.age) {
    const diff = then.age !== now.age;
    rows.push({ key: 'age', label: 'Edad', then: then.age, now: now.age, diff });
    if (diff) changes.push(`apunta a personas de ${then.age} años`);
  }
  if (then.formats?.length && now.formats?.length) {
    const diff = then.formats.join() !== now.formats.join();
    rows.push({ key: 'format', label: 'Formato', then: formatLabel(then.formats), now: formatLabel(now.formats), diff });
    if (diff && then.formats.length === 1) changes.push(`usa ${FORMAT_ARTICLE[then.formats[0]]}`);
  }
  return { rows, changes };
}

/** Frase con los cambios sugeridos, p. ej. "muestra el anuncio sólo en Santiago y usa un video". */
export const changesSentence = (changes) => joinWords(changes);
