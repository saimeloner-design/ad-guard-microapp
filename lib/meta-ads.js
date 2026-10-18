import * as Sentry from '@sentry/nextjs';
import { getToken } from 'next-auth/jwt';
import { countResults, landingPageViews, purchaseValue, resultTypeFor } from '@/lib/alerts-meta';
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
/**
 * Diagnóstico: qué negocios, cuentas publicitarias y páginas autorizó realmente el
 * usuario en el diálogo de Meta (granular_scopes). Un permiso sin `target_ids`
 * aplica a todo lo que el usuario puede ver. Va por POST con `method=GET` para que
 * el token y el secreto no queden en la URL. Sólo registra; nunca rompe el login.
 */
export async function logGrantedAssets(accessToken) {
  const body = new URLSearchParams({
    method: 'GET',
    input_token: accessToken,
    access_token: `${requiredEnv('META_APP_ID', 'login') ?? ''}|${requiredEnv('META_APP_SECRET', 'login') ?? ''}`,
  });
  try {
    const { data } = await graphFetch('alcance de los permisos', '/debug_token', { method: 'POST', body });
    const scopes = Object.fromEntries(
      (data?.granular_scopes ?? []).map((g) => [`scope_${g.scope}`, g.target_ids?.length ? g.target_ids.join(',') : 'all'])
    );
    log('info', 'login', 'Diagnóstico: recursos autorizados en Meta', {
      scopes: (data?.scopes ?? []).join(','),
      hasGranularScopes: Boolean(data?.granular_scopes?.length),
      ...scopes,
    });
  } catch (error) {
    reportError('login', 'Diagnóstico: no se pudo leer el alcance de los permisos de Meta', error, metaErrorSummary(error));
  }
}

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
  const rows = await graphList('cuentas publicitarias', '/me/adaccounts?fields=account_id,name,currency,account_status,business{id,name}&limit=100', accessToken);
  const open = rows.filter((a) => !CLOSED_ACCOUNT_STATUS.has(a.account_status));
  // Diagnóstico: sin negocio dueño es la cuenta publicitaria personal del usuario.
  for (const a of rows) {
    log('info', 'accounts', `Diagnóstico: cuenta publicitaria ${a.account_id}`, {
      accountId: a.account_id,
      accountStatus: a.account_status,
      ownership: a.business ? 'business' : 'personal',
      businessId: a.business?.id,
      businessName: a.business?.name,
    });
  }
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

const INSIGHTS_FIELDS = 'campaign_id,spend,impressions,reach,frequency,inline_link_clicks,actions,action_values';

/** Fecha YYYY-MM-DD de hace `days` días (UTC; Meta usa la zona horaria de la cuenta, la diferencia es de horas). */
const daysAgo = (days) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

const insightsPath = (accountId, level, period, fields) =>
  `/act_${accountId}/insights?level=${level}&${period}&fields=${fields}&limit=500`;

/** Conjuntos de anuncios que hoy pueden publicar (activos y sin fecha de término pasada). */
const isDelivering = (adset) => adset.effective_status === 'ACTIVE' && (!adset.end_time || new Date(adset.end_time) > new Date());

/**
 * Campañas activas y pausadas con métricas de los últimos 30 días y todo lo que
 * necesita lib/alerts-meta.js. Devuelve también `context` (estado de la cuenta,
 * alcance total e historial de 90 días para comparar).
 */
export async function getMetaCampaigns(accessToken, accountId) {
  const list = (step, path) => graphList(step, path, accessToken);
  const [account, campaigns, adsets, rejectedAds, last30, last7, last90, previous30, accountReach] = await Promise.all([
    graphFetch('datos de la cuenta publicitaria', `/act_${accountId}?fields=name,currency,account_status`, { accessToken, flow: 'meta-ads' }),
    list('campañas', `/act_${accountId}/campaigns?fields=id,name,status,objective&limit=200`),
    list('conjuntos de anuncios', `/act_${accountId}/adsets?fields=campaign_id,effective_status,end_time,optimization_goal,learning_stage_info&limit=200`),
    list(
      'anuncios rechazados',
      `/act_${accountId}/ads?fields=name,campaign_id,effective_status&effective_status=${encodeURIComponent('["DISAPPROVED","WITH_ISSUES"]')}&limit=200`
    ),
    // Las campañas sin actividad en el período no aparecen en insights; por eso se cruzan con la lista de campañas.
    list('métricas de 30 días', insightsPath(accountId, 'campaign', 'date_preset=last_30d', INSIGHTS_FIELDS)),
    list('métricas de 7 días', insightsPath(accountId, 'campaign', 'date_preset=last_7d', 'campaign_id,impressions,inline_link_clicks,frequency')),
    list('historial de 90 días', insightsPath(accountId, 'campaign', 'date_preset=last_90d', `objective,${INSIGHTS_FIELDS}`)),
    list(
      'mes anterior',
      insightsPath(accountId, 'campaign', `time_range=${encodeURIComponent(JSON.stringify({ since: daysAgo(60), until: daysAgo(31) }))}`, INSIGHTS_FIELDS)
    ),
    // El alcance no se puede sumar entre campañas (una persona puede ver varias): se pide a nivel de cuenta.
    list('alcance de la cuenta', `/act_${accountId}/insights?date_preset=last_30d&fields=reach`),
  ]);

  const byCampaign = (rows) => new Map(rows.map((r) => [r.campaign_id, r]));
  const metrics30 = byCampaign(last30);
  const metrics7 = byCampaign(last7);
  const metricsPrev = byCampaign(previous30);
  const adsetsByCampaign = Map.groupBy(adsets, (a) => a.campaign_id);
  const rejectedByCampaign = Map.groupBy(rejectedAds, (a) => a.campaign_id);

  const result = campaigns
    .filter((c) => c.status === 'ACTIVE' || c.status === 'PAUSED')
    .map((c) => {
      const m = metrics30.get(c.id) ?? {};
      const sets = (adsetsByCampaign.get(c.id) ?? []).filter((a) => !['DELETED', 'ARCHIVED'].includes(a.effective_status));
      const delivering = sets.filter(isDelivering);
      const learning = delivering.map((a) => a.learning_stage_info?.status);
      const resultType = resultTypeFor(c.objective, sets.map((a) => a.optimization_goal));
      const prev = metricsPrev.get(c.id);
      const week = metrics7.get(c.id);
      return {
        id: c.id,
        name: c.name,
        status: c.status === 'ACTIVE' ? 'active' : 'paused',
        delivering: c.status === 'ACTIVE' ? delivering.length > 0 : undefined,
        objective: c.objective,
        resultType,
        cost: Number(m.spend || 0),
        impressions: Number(m.impressions || 0),
        reach: Number(m.reach || 0),
        frequency: Number(m.frequency || 0),
        // Clics en el enlace: los "clics" totales de Meta incluyen me gusta y comentarios.
        linkClicks: Number(m.inline_link_clicks || 0),
        landingPageViews: landingPageViews(m),
        results: countResults(resultType, m),
        purchaseValue: purchaseValue(m),
        // Si algún conjunto que publica sigue aprendiendo, la campaña aún no se juzga.
        learningStatus: learning.includes('LEARNING') ? 'LEARNING' : learning.includes('FAIL') ? 'FAIL' : null,
        rejectedAds: (rejectedByCampaign.get(c.id) ?? []).map((a) => a.name),
        last7: week && {
          impressions: Number(week.impressions || 0),
          linkClicks: Number(week.inline_link_clicks || 0),
          frequency: Number(week.frequency || 0),
        },
        previous: prev && { cost: Number(prev.spend || 0), results: countResults(resultType, prev) },
      };
    });

  // Para el historial, el tipo de resultado de campañas ya borradas se deduce sólo del objetivo.
  const typeById = new Map(result.map((c) => [c.id, c.resultType]));
  const history = last90.map((r) => {
    const resultType = typeById.get(r.campaign_id) ?? resultTypeFor(r.objective);
    return { campaignId: r.campaign_id, resultType, cost: Number(r.spend || 0), results: countResults(resultType, r) };
  });

  log('info', 'meta-ads', `Cuenta ${accountId}: ${result.length} campañas`, {
    accountId,
    campaigns: result.length,
    withMetrics: last30.length,
    adsets: adsets.length,
    rejectedAds: rejectedAds.length,
    historyCampaigns: history.length,
    accountStatus: account.account_status,
  });

  return {
    account: { id: accountId, name: account.name, currency: account.currency || 'CLP' },
    campaigns: result,
    context: { accountStatus: account.account_status, reach: Number(accountReach[0]?.reach || 0), history },
  };
}

/**
 * Diagnóstico: qué página de Facebook (o Instagram) promociona cada campaña.
 * La página sale del creativo de cada anuncio; el nombre puede no estar disponible
 * sin permisos de páginas, y entonces queda sólo el id.
 */
export async function logCampaignPages(accessToken, accountId, campaigns) {
  const ads = await graphList(
    'páginas de los anuncios',
    `/act_${accountId}/ads?fields=campaign_id,creative{effective_object_story_id,object_story_spec{page_id,instagram_user_id}}&limit=200`,
    accessToken
  );
  const pagesByCampaign = new Map();
  for (const ad of ads) {
    const spec = ad.creative?.object_story_spec;
    // effective_object_story_id = "<página>_<publicación>"
    const pageId = spec?.page_id ?? ad.creative?.effective_object_story_id?.split('_')[0];
    if (!pageId) continue;
    if (!pagesByCampaign.has(ad.campaign_id)) pagesByCampaign.set(ad.campaign_id, new Set());
    pagesByCampaign.get(ad.campaign_id).add(pageId);
  }

  const pageIds = [...new Set([...pagesByCampaign.values()].flatMap((set) => [...set]))];
  let names = {};
  if (pageIds.length > 0) {
    try {
      names = await graphFetch('nombres de las páginas', `/?ids=${pageIds.join(',')}&fields=name`, { accessToken, flow: 'meta-ads' });
    } catch (error) {
      log('warn', 'meta-ads', 'Diagnóstico: Meta no entregó los nombres de las páginas', { ...metaErrorSummary(error), pages: pageIds.length });
    }
  }

  for (const pageId of pageIds) {
    const own = campaigns.filter((c) => pagesByCampaign.get(c.id)?.has(pageId));
    log('info', 'meta-ads', `Diagnóstico: página ${pageId}`, {
      accountId,
      pageId,
      pageName: names[pageId]?.name,
      campaigns: own.length,
      activeCampaigns: own.filter((c) => c.status === 'active').length,
      campaignIds: own.map((c) => c.id).join(','),
      cost: Number(own.reduce((acc, c) => acc + c.cost, 0).toFixed(2)),
    });
  }
  const withoutPage = campaigns.filter((c) => !pagesByCampaign.has(c.id));
  log('info', 'meta-ads', `Diagnóstico: ${pageIds.length} páginas en la cuenta ${accountId}`, {
    accountId,
    pages: pageIds.length,
    ads: ads.length,
    campaignsWithoutPage: withoutPage.length,
    campaignIdsWithoutPage: withoutPage.map((c) => c.id).join(','),
  });
}

/**
 * Para el análisis en sombra: gasto y resultados de los últimos 30 días por conjunto
 * de anuncios y por anuncio. Los resultados se cuentan con el tipo de su campaña.
 */
export async function getMetaBreakdown(accessToken, accountId, resultTypeByCampaign) {
  const fields = 'campaign_id,adset_id,ad_id,spend,inline_link_clicks,reach,actions';
  const [adsets, ads] = await Promise.all([
    graphList('desglose por conjunto', insightsPath(accountId, 'adset', 'date_preset=last_30d', fields), accessToken),
    graphList('desglose por anuncio', insightsPath(accountId, 'ad', 'date_preset=last_30d', fields), accessToken),
  ]);
  const normalize = (rows, idKey) =>
    rows
      .filter((r) => resultTypeByCampaign.has(r.campaign_id))
      .map((r) => ({
        campaignId: r.campaign_id,
        id: r[idKey],
        cost: Number(r.spend || 0),
        results: countResults(resultTypeByCampaign.get(r.campaign_id), r),
      }));
  return { adset: normalize(adsets, 'adset_id'), ad: normalize(ads, 'ad_id') };
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
