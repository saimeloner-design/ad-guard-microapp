// Revisión de campaña nueva (docs/SPEC.md §4e). Función pura: revisa cómo se
// configuró una campaña creada hace pocos días, antes de que gaste mucho, y la
// compara con la campaña que mejor funcionó con el mismo objetivo.

/** Días desde la creación en que una campaña cuenta como nueva. */
export const NEW_CAMPAIGN_DAYS = 7;

export const isNewCampaign = (c, now = Date.now()) =>
  c.status === 'active' && Boolean(c.createdTime) && now - new Date(c.createdTime).getTime() < NEW_CAMPAIGN_DAYS * 86_400_000;

/** Objetivos que buscan que la gente compre, deje sus datos o escriba. */
const SEEKS_CUSTOMERS = new Set(['purchase', 'lead', 'message', 'app_install']);

/**
 * @param c campaña evaluada (con `resultType`, `createdTime`)
 * @param type RESULT_TYPES[c.resultType]
 * @param winners mejor campaña por tipo de resultado (lib/winners-meta.js)
 * @param configs configuraciones leídas (lib/meta-ads.js, getMetaCampaignConfigs)
 * @param pixelWorks true si alguna campaña de ventas o contactos registró resultados en 90 días
 * @returns {{checks: Array<{key, status: 'bad'|'warn'|'ok', title, detail}>, problems: number}}
 */
export function reviewNewCampaign(c, { type, winners = {}, configs = {}, pixelWorks, money }) {
  const checks = [];
  const now = configs[c.id];
  const winner = winners[c.resultType];
  const then = winner && winner.campaignId !== c.id ? configs[winner.campaignId] : null;

  if (SEEKS_CUSTOMERS.has(c.resultType)) {
    checks.push({ key: 'objective', status: 'ok', title: `El objetivo es ${type.objective}`, detail: 'Meta va a buscar gente que te compre o te escriba, no sólo que vea el anuncio.' });
  } else {
    checks.push({
      key: 'objective',
      status: 'warn',
      title: `El objetivo es ${type.objective}`,
      detail:
        'Meta va a buscar gente que vea o toque el anuncio, no que te compre. Si lo que quieres es vender o que te escriban, crea la campaña con el objetivo Ventas, Clientes potenciales o Mensajes.',
    });
  }

  if (now?.location && then?.location) {
    if (now.location !== then.location) {
      const wholeCountry = /^Todo /.test(now.location);
      checks.push({
        key: 'location',
        status: 'bad',
        title: `Se muestra en ${now.location.replace(/^Todo /, 'todo ')}`,
        detail: `Tu campaña que mejor funcionó ("${winner.name}") se mostraba en ${then.location}.${wholeCountry ? ' Si no vendes ni despachas a todo el país, vas a pagar por gente que no te puede comprar.' : ''}`,
      });
    } else {
      checks.push({ key: 'location', status: 'ok', title: `Se muestra en ${now.location}`, detail: `Igual que "${winner.name}", tu campaña que mejor funcionó.` });
    }
  }

  if (now?.dailyBudget && then?.dailyBudget) {
    if (now.dailyBudget > 1.5 * then.dailyBudget) {
      checks.push({
        key: 'budget',
        status: 'bad',
        title: `Presupuesto de ${money(now.dailyBudget)} al día`,
        detail: `Tu mejor campaña de ${type.objective.toLowerCase()} funcionó con ${money(then.dailyBudget)} al día. Parte con menos y súbelo cuando veas resultados.`,
      });
    } else {
      checks.push({ key: 'budget', status: 'ok', title: `Presupuesto de ${money(now.dailyBudget)} al día`, detail: 'Parecido al de tu campaña que mejor funcionó.' });
    }
  }

  if (type.pixel) {
    const what = c.resultType === 'purchase' ? 'alguien compra' : 'alguien deja sus datos';
    checks.push(
      pixelWorks
        ? { key: 'pixel', status: 'ok', title: `Tu web avisa a Meta cuando ${what}`, detail: 'Vamos a poder decirte cuánto te cuesta cada resultado.' }
        : {
            key: 'pixel',
            status: 'warn',
            title: `No sabemos si tu web avisa a Meta cuando ${what}`,
            detail:
              'En los últimos 90 días ninguna campaña registró ventas ni contactos. Revisa que el píxel de Meta esté instalado en tu web; si no, no vamos a poder decirte si esta campaña funciona.',
          }
    );
  }

  const order = { bad: 0, warn: 1, ok: 2 };
  checks.sort((a, b) => order[a.status] - order[b.status]);
  return { checks, problems: checks.filter((ch) => ch.status !== 'ok').length };
}
