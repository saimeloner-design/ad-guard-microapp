import { flushLogsAfterResponse, log, reportError, requiredEnv } from '@/lib/log';
import { SPEND_OPTIONS, TRACKING_PARAMS } from '@/lib/leads';

const FLOW = 'leads';

// Debe superar el timeout de la llamada a la planilla (25 s) para que Vercel no corte antes.
export const maxDuration = 30;

const clean = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

const fail = (status, error) => Response.json({ error }, { status });

/**
 * Recibe los registros del formulario de /beta y los agrega como fila en la Google Sheet,
 * a través del Apps Script publicado como aplicación web (ver scripts/leads-sheet.gs).
 */
export async function POST(request) {
  flushLogsAfterResponse();

  const body = await request.json().catch(() => null);
  if (!body) return fail(400, 'Solicitud inválida.');

  // Campo trampa: las personas no lo ven, los bots lo llenan. Se responde "ok" para no darles pistas.
  if (clean(body.website, 200)) return Response.json({ ok: true });

  const contact = clean(body.contact, 120);
  const spend = clean(body.spend, 60);
  if (!contact || !SPEND_OPTIONS.includes(spend)) {
    return fail(400, 'Escribe tu email o WhatsApp y elige cuánto inviertes para que podamos contactarte.');
  }

  const tracking = Object.fromEntries(TRACKING_PARAMS.map((key) => [key, clean(body.tracking?.[key], 200)]));
  const lead = { createdAt: new Date().toISOString(), name: clean(body.name, 80), contact, spend, ...tracking };

  const url = requiredEnv('LEADS_SHEET_WEBHOOK_URL', FLOW);
  const secret = requiredEnv('LEADS_SHEET_SECRET', FLOW);
  if (!url || !secret) return fail(500, 'No pudimos guardar tus datos. Intenta de nuevo en unos minutos.');

  try {
    // Apps Script responde con una redirección a googleusercontent.com; fetch la sigue y trae el JSON.
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, lead }),
      // Apps Script puede tardar más de 10 s en arrancar en frío; cortar antes muestra error aunque la fila se guarde.
      signal: AbortSignal.timeout(25_000),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error(`La planilla respondió ${res.status}: ${data?.error ?? 'sin JSON'}`);
  } catch (error) {
    reportError(FLOW, 'No se pudo guardar el lead en la Google Sheet', error, { spend, utmSource: tracking.utm_source });
    return fail(502, 'No pudimos guardar tus datos. Intenta de nuevo en unos minutos.');
  }

  log('info', FLOW, 'Lead guardado', { spend, utmSource: tracking.utm_source, utmContent: tracking.utm_content });
  return Response.json({ ok: true });
}
