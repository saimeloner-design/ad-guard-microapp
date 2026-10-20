// Diagnóstico de campañas de Meta (docs/SPEC.md §4c). Funciones puras, como las
// alertas: no agregan ni quitan alertas, sólo explican en qué paso del recorrido
// se pierde la plata y qué parte de la campaña conviene pausar.

const fmt = (n, digits = 0) => n.toLocaleString('es-CL', { maximumFractionDigits: digits });

const RESULT_STEP = {
  purchase: 'te compraron',
  lead: 'dejaron sus datos',
  message: 'te escribieron',
  app_install: 'instalaron tu app',
};

/** Pasos del recorrido que se pueden medir según el tipo de resultado. */
function funnelSteps(c, type) {
  const steps = [{ key: 'seen', label: 'personas lo vieron', value: c.reach || c.impressions }];
  if (type.ctr) steps.push({ key: 'click', label: 'hicieron clic', value: c.linkClicks });
  // Las visitas a la página sólo existen si el píxel las mide.
  if (type.web && c.landingPageViews > 0) steps.push({ key: 'web', label: 'llegaron a tu web', value: c.landingPageViews });
  if (RESULT_STEP[c.resultType] && c.measured) steps.push({ key: 'result', label: RESULT_STEP[c.resultType], value: c.results });
  return steps;
}

const CHANGE_AD_DETAIL =
  'Muestra el producto y el precio en la imagen, y di en la primera línea qué gana la persona al tocar. Si el público es muy amplio, acótalo a quienes de verdad te compran.';
const NOT_THE_AD = 'Cambiar el anuncio no va a solucionar esto: el anuncio sí está trayendo gente.';

/** Qué decir cuando el resultado falla, según el tipo de resultado. `arrived`: hasta dónde llega la gente. */
function resultFix(c, rules, arrived) {
  const none = c.results === 0;
  switch (c.resultType) {
    case 'purchase':
      if (!rules.has('M1') && !rules.has('M2')) {
        return {
          title: 'Tus ventas no alcanzan a cubrir lo que gastas',
          detail:
            'El anuncio trae compradores, pero lo que compran vale menos de lo que pagas por traerlos. Destaca productos de mayor precio o arma packs para que cada compra valga más.',
        };
      }
      return {
        title: `Revisa tu página: la gente ${arrived} pero ${none ? 'no compra' : 'compra poco'}`,
        detail: `Revisa que el precio se vea claro, que el botón de compra sea fácil de encontrar y que pagar funcione bien en el celular. ${NOT_THE_AD}`,
      };
    case 'lead':
      return {
        title: `Revisa tu formulario: la gente ${arrived} pero ${none ? 'no lo completa' : 'pocos lo completan'}`,
        detail: `Revisa que se vea bien en el celular, que pida pocos datos y que el botón para enviarlo sea fácil de encontrar. ${NOT_THE_AD}`,
      };
    case 'message':
      return {
        title: none ? 'Tu anuncio no invita a escribirte' : 'Pocas personas te escriben',
        detail:
          'Di claramente en la imagen o el texto por qué conviene escribirte: precio, disponibilidad o una promoción. Revisa también que el botón del anuncio abra la conversación correcta (WhatsApp, Messenger o Instagram).',
      };
    case 'app_install':
      return {
        title: 'Revisa la página de tu app en la tienda: la gente llega pero no instala',
        detail:
          'Revisa las imágenes, la descripción y las opiniones de tu app en la tienda, y que el anuncio lleve a la tienda correcta (Android o iPhone).',
      };
    default:
      return null;
  }
}

/**
 * Primer paso del recorrido que falla, según las alertas que ya salieron: se arregla
 * primero la fuga más temprana (si casi nadie hace clic, revisar la web no sirve todavía).
 */
function findBreak(c, rules, steps) {
  const has = (key) => steps.some((s) => s.key === key);
  if (rules.has('M4') && has('click')) {
    return {
      step: 'click',
      fix: {
        title: 'Cambia la imagen o el video del anuncio',
        detail: `Las mismas personas ya lo vieron ${fmt(c.last7?.frequency ?? c.frequency, 1)} veces esta semana y cada vez tocan menos. Sube una imagen o un video nuevo dentro de la misma campaña, o amplía el público para llegar a gente que todavía no lo ha visto.`,
      },
    };
  }
  if (rules.has('M8') && has('click')) {
    return { step: 'click', fix: { title: 'Cambia la imagen o el texto: casi nadie se detiene a mirarlo', detail: CHANGE_AD_DETAIL } };
  }
  if (rules.has('M7') && has('web')) {
    const outOfTen = Math.round((c.landingPageViews / c.linkClicks) * 10);
    return {
      step: 'web',
      fix: {
        title: 'Revisa tu web: muchos se van antes de que cargue',
        detail: `De cada 10 personas que tocan el anuncio, ${outOfTen < 1 ? 'menos de 1 llega' : `sólo ${outOfTen} ${outOfTen === 1 ? 'llega' : 'llegan'}`} a ver tu página. Abre el enlace del anuncio desde tu celular con datos móviles: si demora más de 3 segundos o el enlace está mal, ahí está el problema.`,
      },
    };
  }
  if (!['M1', 'M2', 'M3'].some((r) => rules.has(r))) return null;
  // En tráfico el resultado es el clic: si sale caro, el problema está en el anuncio.
  if (c.resultType === 'traffic' && has('click')) {
    return {
      step: 'click',
      fix: { title: 'Cada clic te sale caro: prueba otra imagen o un público más acotado', detail: CHANGE_AD_DETAIL },
    };
  }
  if (!has('result')) return null;
  const fix = resultFix(c, rules, has('web') ? 'llega a tu web' : 'toca el anuncio');
  return fix && { step: 'result', fix };
}

const LEVELS = {
  ad: { one: 'El anuncio', many: 'anuncios' },
  adset: { one: 'El conjunto de anuncios', many: 'conjuntos de anuncios' },
};

/**
 * Partes (anuncios o, si no hay caso claro, conjuntos) que hoy publican, gastaron
 * ≥ N× el costo por resultado de la campaña y no trajeron ninguno, mientras otra
 * parte de la misma campaña sí trae resultados.
 */
function findCut(c, type, config, money) {
  if (!type.conversion || !c.measured || !(c.results > 0) || !c.parts) return null;
  const costPerResult = c.cost / c.results;
  for (const level of ['ad', 'adset']) {
    const parts = c.parts[level] ?? [];
    const wasted = parts
      .filter((p) => p.active && p.results === 0 && p.cost >= config.wastedPartCostMultiplier * costPerResult)
      .sort((a, b) => b.cost - a.cost);
    const good = parts.filter((p) => p.results > 0).sort((a, b) => b.results - a.results);
    if (wasted.length === 0 || good.length === 0) continue;

    const words = LEVELS[level];
    const wastedCost = wasted.reduce((acc, p) => acc + p.cost, 0);
    const resultLabel = (n) => `${fmt(n)} ${n === 1 ? type.one : type.label.toLowerCase()}`;
    return {
      level,
      count: wasted.length,
      title:
        wasted.length === 1
          ? `${words.one} "${wasted[0].name}" gastó ${money(wastedCost)} sin ${type.none}`
          : `${wasted.length} ${words.many} gastaron ${money(wastedCost)} sin ${type.none}`,
      detail: `${wasted.length === 1 ? 'Páusalo' : 'Páusalos'} desde el Administrador de anuncios de Meta y deja el resto de la campaña andando.`,
      parts: [...good.slice(0, 3), ...wasted].map((p) => ({
        id: p.id,
        name: p.name,
        wasted: p.results === 0,
        cost: money(p.cost),
        results: resultLabel(p.results),
      })),
    };
  }
  return null;
}

/**
 * @param c campaña ya evaluada (con `measured`, `parts` opcional, etc.)
 * @param alerts alertas de la campaña
 * @returns {{breakStep?, steps?, fix?, cut?} | null}
 */
export function diagnoseMetaCampaign(c, alerts, { type, config, money }) {
  const rules = new Set(alerts.map((a) => a.rule));
  const steps = funnelSteps(c, type);
  const found = steps.length > 1 ? findBreak(c, rules, steps) : null;
  const cut = findCut(c, type, config, money);
  if (!found && !cut) return null;
  return {
    ...(found && {
      breakStep: found.step,
      steps: steps.map((s) => ({ ...s, bad: s.key === found.step })),
      fix: found.fix,
    }),
    cut,
  };
}
