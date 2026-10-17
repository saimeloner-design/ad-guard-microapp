import * as Sentry from '@sentry/nextjs';
import { getToken } from 'next-auth/jwt';
import { log, maskEmail, reportError, requiredEnv } from '@/lib/log';

// Versiones: https://developers.facebook.com/docs/graph-api/changelog/versions
export const META_GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v26.0';
export const META_GRAPH_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

// Permisos de la configuración de "Inicio de sesión con Facebook para empresas"
// (META_LOGIN_CONFIG_ID). public_profile se concede siempre.
export const META_ADS_PERMISSIONS = ['email', 'ads_read', 'ads_management'];

export class MetaApiError extends Error {
  constructor(message, { status, code, metaError } = {}) {
    super(message);
    this.name = 'MetaApiError';
    this.status = status;
    this.code = code;
    this.metaError = metaError;
  }
}

/** Datos del error de Meta útiles para diagnosticar. No incluye el cuerpo completo ni datos del usuario. */
function metaErrorSummary(error) {
  const e = error?.metaError;
  return {
    httpStatus: error?.status,
    metaMessage: e?.message,
    metaType: e?.type,
    metaCode: e?.code,
    metaSubcode: e?.error_subcode,
    fbtraceId: e?.fbtrace_id,
  };
}

/** Llama a la Graph API y lanza MetaApiError ante cualquier fallo (red, HTTP o respuesta no JSON). */
async function graphFetch(step, path, { method = 'GET', accessToken, body, flow = 'login' } = {}) {
  const startedAt = Date.now();
  let res;
  try {
    res = await fetch(`${META_GRAPH_URL}${path}`, {
      method,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      body,
    });
  } catch (cause) {
    throw new MetaApiError(`${step}: no se pudo conectar con Meta (${cause.message})`, { status: 0 });
  }
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new MetaApiError(`${step}: Meta respondió algo que no es JSON (HTTP ${res.status}, ${text.length} bytes)`, { status: res.status });
  }
  log('info', flow, `Meta respondió: ${step}`, { path: path.split('?')[0], httpStatus: res.status, durationMs: Date.now() - startedAt });
  if (!res.ok || data.error) {
    throw new MetaApiError(`${step}: ${data.error?.message ?? `HTTP ${res.status}`}`, { status: res.status, metaError: data.error });
  }
  return data;
}

/**
 * El token que entrega el login dura ~1-2 horas y Meta no da refresh token:
 * se cambia por uno de larga duración (~60 días). Va por POST para que el
 * secreto y el token no queden en la URL (ni en spans o breadcrumbs de Sentry).
 * Si falla, se reporta a Sentry y se devuelve null: el login sigue con el token corto.
 */
export async function exchangeForLongLivedToken(shortLivedToken) {
  const body = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: requiredEnv('META_APP_ID', 'login') ?? '',
    client_secret: requiredEnv('META_APP_SECRET', 'login') ?? '',
    fb_exchange_token: shortLivedToken,
  });
  try {
    const data = await graphFetch('canje por token de larga duración', '/oauth/access_token', { method: 'POST', body });
    if (!data.access_token) {
      throw new MetaApiError('canje por token de larga duración: la respuesta no trae access_token', { status: 200 });
    }
    return {
      accessToken: data.access_token,
      // Meta a veces omite expires_in en tokens de larga duración.
      expiresAt: data.expires_in ? Math.floor(Date.now() / 1000) + data.expires_in : undefined,
    };
  } catch (error) {
    reportError('login', 'No se pudo obtener el token de larga duración de Meta; se usa el token corto', error, metaErrorSummary(error));
    return null;
  }
}

/**
 * Permisos concedidos y rechazados (el usuario puede desmarcarlos en el diálogo de Meta).
 * Si no se pueden leer, se reporta a Sentry y se devuelve null: "desconocido", no "ninguno".
 */
export async function getPermissions(accessToken) {
  try {
    const data = await graphFetch('lectura de permisos concedidos', '/me/permissions', { accessToken });
    const byStatus = (status) => (data.data ?? []).filter((p) => p.status === status).map((p) => p.permission);
    return { granted: byStatus('granted'), declined: byStatus('declined') };
  } catch (error) {
    reportError('login', 'No se pudieron leer los permisos concedidos en Meta', error, metaErrorSummary(error));
    return null;
  }
}

// ── API de marketing (cuentas, campañas y métricas) ──────────────────────────

const REAUTH_MESSAGE = 'Tu sesión con Meta expiró o se quitó el acceso. Vuelve a conectar tu cuenta.';
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80000, 80004]);
// Desactivada, pendiente de cierre y cerrada: no pueden publicar anuncios.
const CLOSED_ACCOUNT_STATUS = new Set([2, 100, 101]);

/** Token de Meta del usuario de la request. Meta no entrega refresh token: si venció, hay que volver a conectar. */
export async function getMetaAccessToken(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (token) Sentry.setUser({ id: token.sub, email: maskEmail(token.email) });
  const expired = Boolean(token?.metaExpiresAt && token.metaExpiresAt * 1000 <= Date.now());
  if (!token?.metaAccessToken || expired) {
    log('warn', 'meta-ads', 'Sesión sin token de Meta válido', {
      hasSession: Boolean(token),
      hasToken: Boolean(token?.metaAccessToken),
      expired,
      email: maskEmail(token?.email),
    });
    throw new MetaApiError('sesión sin token de Meta válido', { status: 401, code: 'REAUTH' });
  }
  return token.metaAccessToken;
}

/** Recorre todas las páginas de un listado de la Graph API usando el cursor `after`. */
async function graphList(step, path, accessToken) {
  const items = [];
  let after;
  do {
    const page = after ? `${path}&after=${encodeURIComponent(after)}` : path;
    const data = await graphFetch(step, page, { accessToken, flow: 'meta-ads' });
    items.push(...(data.data ?? []));
    after = data.paging?.next ? data.paging.cursors?.after : undefined;
  } while (after);
  return items;
}

function cleanNumericId(id, label) {
  const clean = String(id || '').replace(/^act_/, '');
  if (!/^\d{1,20}$/.test(clean)) {
    throw new MetaApiError(`${label} inválido`, { status: 400, code: 'BAD_REQUEST' });
  }
  return clean;
}

export const cleanAdAccountId = (id) => cleanNumericId(id, 'identificador de cuenta publicitaria');
export const cleanCampaignId = (id) => cleanNumericId(id, 'identificador de campaña');

/** Cuentas publicitarias del usuario que pueden publicar anuncios. */
export async function listAdAccounts(accessToken) {
  const rows = await graphList('cuentas publicitarias', '/me/adaccounts?fields=account_id,name,currency,account_status&limit=100', accessToken);
  const open = rows.filter((a) => !CLOSED_ACCOUNT_STATUS.has(a.account_status));
  log(open.length === 0 ? 'warn' : 'info', 'accounts', `Meta: ${open.length} cuentas publicitarias utilizables`, {
    total: rows.length,
    closed: rows.length - open.length,
    accounts: open.map((a) => a.account_id).join(','),
  });
  return {
    accounts: open.map((a) => ({ id: a.account_id, name: a.name || `Cuenta ${a.account_id}`, currency: a.currency })),
    notice:
      open.length === 0 && rows.length > 0
        ? 'Tus cuentas publicitarias de Meta están desactivadas o cerradas. Revísalas en el Administrador de anuncios.'
        : undefined,
  };
}

// Acciones que cuentan como "resultado" (venta o contacto). Meta reporta la misma
// conversión con varios nombres, así que de cada grupo se toma sólo el primero que aparezca.
const RESULT_ACTIONS = [
  ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'],
  ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'],
  ['onsite_conversion.messaging_conversation_started_7d'],
  ['contact_total', 'offsite_conversion.fb_pixel_contact'],
  ['complete_registration', 'offsite_conversion.fb_pixel_complete_registration'],
];

function countResults(actions = []) {
  const byType = new Map(actions.map((a) => [a.action_type, Number(a.value || 0)]));
  return RESULT_ACTIONS.reduce((sum, group) => sum + (byType.get(group.find((t) => byType.has(t))) ?? 0), 0);
}

/** Campañas activas y pausadas con métricas de los últimos 30 días, con la misma forma que las de Google Ads. */
export async function getMetaCampaigns(accessToken, accountId) {
  const [account, campaigns, insights] = await Promise.all([
    graphFetch('datos de la cuenta publicitaria', `/act_${accountId}?fields=name,currency`, { accessToken, flow: 'meta-ads' }),
    graphList('campañas', `/act_${accountId}/campaigns?fields=id,name,status,objective&limit=200`, accessToken),
    // Las campañas sin actividad en el período no aparecen aquí; por eso se cruzan con la lista de campañas.
    graphList(
      'métricas de 30 días',
      `/act_${accountId}/insights?level=campaign&date_preset=last_30d&fields=campaign_id,spend,impressions,inline_link_clicks,actions&limit=200`,
      accessToken
    ),
  ]);

  const metricsById = new Map(insights.map((r) => [r.campaign_id, r]));
  const list = campaigns
    .filter((c) => c.status === 'ACTIVE' || c.status === 'PAUSED')
    .map((c) => {
      const m = metricsById.get(c.id) ?? {};
      return {
        id: c.id,
        name: c.name,
        status: c.status === 'ACTIVE' ? 'active' : 'paused',
        channel: c.objective,
        cost: Number(m.spend || 0),
        // Clics en el enlace: los "clics" totales de Meta incluyen me gusta y comentarios.
        clicks: Number(m.inline_link_clicks || 0),
        impressions: Number(m.impressions || 0),
        conversions: countResults(m.actions),
      };
    });
  log('info', 'meta-ads', `Cuenta ${accountId}: ${list.length} campañas`, {
    accountId,
    campaigns: list.length,
    withMetrics: insights.length,
  });

  return { account: { id: accountId, name: account.name, currency: account.currency || 'CLP' }, campaigns: list };
}

/** `status`: 'ACTIVE' | 'PAUSED'. Requiere el permiso ads_management. */
export async function setMetaCampaignStatus(accessToken, campaignId, status) {
  await graphFetch('cambio de estado de campaña', `/${campaignId}`, {
    method: 'POST',
    accessToken,
    body: new URLSearchParams({ status }),
    flow: 'meta-ads',
  });
}

function friendlyError(error) {
  const code = error.metaError?.code;
  if (error.code === 'REAUTH' || code === 190) return { status: 401, code: 'REAUTH', message: REAUTH_MESSAGE };
  if (error.code === 'BAD_REQUEST') return { status: 400, message: 'Solicitud inválida.' };
  if (code === 10 || (code >= 200 && code < 300)) {
    return {
      status: 403,
      message:
        'Meta no nos dio permiso sobre esta cuenta publicitaria. Revisa que tu usuario tenga acceso a ella y vuelve a conectar aceptando todos los permisos.',
    };
  }
  if (RATE_LIMIT_CODES.has(code)) {
    return { status: 429, message: 'Meta está recibiendo demasiadas consultas de tu cuenta. Espera unos minutos y vuelve a intentarlo.' };
  }
  return { status: 502, message: 'Meta respondió con un error. Intenta de nuevo en unos minutos.' };
}

export function metaErrorResponse(error) {
  if (!(error instanceof MetaApiError)) {
    // Las rutas capturan sus errores, así que onRequestError no los ve: se reportan aquí.
    Sentry.captureException(error);
    log('error', 'meta-ads', `Error inesperado: ${error?.message}`, { stack: error?.stack?.slice(0, 4000) });
    return Response.json({ error: 'Error inesperado del servidor.' }, { status: 500 });
  }
  const { status, code, message } = friendlyError(error);
  const summary = { ...metaErrorSummary(error), internalMessage: error.message, code };
  if (status >= 500) reportError('meta-ads', `Respuesta de error al cliente: ${message}`, error, summary);
  else log('warn', 'meta-ads', `Respuesta de error al cliente: ${message}`, summary);
  return Response.json({ error: message, code }, { status });
}
