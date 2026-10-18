import * as Sentry from '@sentry/nextjs';
import { after } from 'next/server';
import { SEVERITY } from '@/lib/alerts';
import { log, reportError } from '@/lib/log';

// Análisis en sombra (docs/SPEC.md §7): mide, sin mostrarle nada al usuario, si el
// dinero perdido se concentra en una parte de la campaña (grupo, conjunto, anuncio,
// palabra clave) o en la campaña entera. Sirve para decidir con datos si vale la pena
// mostrar ese detalle en la app.

/** Ejecuta `fn` cuando la respuesta ya salió: no agrega latencia ni puede romperla. */
export function runInShadow(name, fn) {
  after(async () => {
    try {
      await fn();
    } catch (error) {
      reportError('shadow', `Falló el análisis en sombra: ${name}`, error);
    } finally {
      // flushLogsAfterResponse puede terminar antes que este análisis.
      await Sentry.flush(2000);
    }
  });
}

const share = (part, total) => (total > 0 ? Number((part / total).toFixed(3)) : undefined);

/**
 * Concentración del gasto perdido (partes con gasto y sin resultados) dentro de una campaña.
 * @param {Array<{id, cost, results}>} children partes de una misma campaña
 */
export function wasteConcentration(children) {
  const withSpend = children.filter((c) => c.cost > 0);
  const cost = withSpend.reduce((acc, c) => acc + c.cost, 0);
  const wasted = withSpend.filter((c) => c.results === 0).sort((a, b) => b.cost - a.cost);
  const wastedCost = wasted.reduce((acc, c) => acc + c.cost, 0);
  return {
    parts: children.length,
    partsWithSpend: withSpend.length,
    wastedParts: wasted.length,
    wastedShare: share(wastedCost, cost),
    // Qué parte del gasto de la campaña se va en la peor parte, y en las dos peores.
    top1WastedShare: share(wasted[0]?.cost ?? 0, cost),
    top2WastedShare: share((wasted[0]?.cost ?? 0) + (wasted[1]?.cost ?? 0), cost),
  };
}

/**
 * Un log por campaña y nivel en el flujo `shadow`.
 * `isMeasured(campaign)`: si los resultados de esa campaña se miden; si no, sólo se registra la estructura.
 */
export function logWasteConcentration({ platform, level, accountId, evaluation, children, isMeasured }) {
  const byCampaign = Map.groupBy(children, (c) => c.campaignId);
  let campaigns = 0;
  let singlePart = 0;
  for (const c of evaluation.campaigns) {
    const parts = byCampaign.get(c.id) ?? [];
    if (c.cost <= 0 || parts.length === 0) continue;
    campaigns += 1;
    const stats = wasteConcentration(parts);
    if (stats.partsWithSpend <= 1) singlePart += 1;
    const measured = isMeasured(c);
    log('info', 'shadow', `${platform}: gasto perdido por ${level}`, {
      platform,
      level,
      accountId,
      campaignId: c.id,
      channel: c.channel,
      status: c.status,
      measured,
      campaignAlerts: c.alerts.map((a) => a.rule).join(',') || 'none',
      campaignFlaggedPause: c.alerts.some((a) => a.severity === SEVERITY.PAUSE),
      parts: stats.parts,
      partsWithSpend: stats.partsWithSpend,
      ...(measured && {
        wastedParts: stats.wastedParts,
        wastedShare: stats.wastedShare,
        top1WastedShare: stats.top1WastedShare,
        top2WastedShare: stats.top2WastedShare,
      }),
    });
  }
  log('info', 'shadow', `${platform}: estructura por ${level}`, { platform, level, accountId, campaigns, singlePart });
}
