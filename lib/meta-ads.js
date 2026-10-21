import * as Sentry from '@sentry/nextjs';
import { getToken } from 'next-auth/jwt';
import { countResults, landingPageViews, purchaseValue, resultTypeFor } from '@/lib/alerts-meta';
import { fromMetaAmount, guardRuleParams, guardsFromRules, GUARDS, toMetaAmount } from '@/lib/guards-meta';
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

/**
 * Consumo de los límites de Meta que viene en los encabezados de cada respuesta, en %
 * del límite (el máximo entre los casos de uso informados). Sirve para medir cuánto
 * "gasta" cada consulta. https://developers.facebook.com/docs/graph-api/overview/rate-limiting
 */
function usageFromHeaders(headers) {
  const parse = (name) => {
    try {
      return JSON.parse(headers.get(name) || 'null');
    } catch {
      return null;
    }
  };
  const app = parse('x-app-usage');
  const account = parse('x-ad-account-usage');
  const buc = Object.values(parse('x-business-use-case-usage') ?? {}).flat();
  const max = (key) => (buc.length ? Math.max(...buc.map((u) => Number(u[key] || 0))) : undefined);
  return {
    appCallCount: app?.call_count,
    appCpuTime: app?.total_cputime,
    appTotalTime: app?.total_time,
    adAccountUtilPct: account?.acc_id_util_pct,
    bucCallCount: max('call_count'),
    bucCpuTime: max('total_cputime'),
    bucTotalTime: max('total_time'),
    bucTypes: buc.length ? [...new Set(buc.map((u) => u.type))].join(',') : undefined,
  };
}

/** Mayor consumo entre dos lecturas de usageFromHeaders. */
function maxUsage(a = {}, b = {}) {
  const out = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[key] = typeof a[key] === 'number' || typeof b[key] === 'number' ? Math.max(a[key] ?? 0, b[key] ?? 0) : (b[key] ?? a[key]);
  }
  return out;
}

/** Llama a la Graph API y lanza MetaApiError ante cualquier fallo (red, HTTP o respuesta no JSON). Devuelve también el consumo. */
async function graphRequest(step, path, { method = 'GET', accessToken, body, flow = 'login' } = {}) {
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
  const usage = usageFromHeaders(res.headers);
  log('info', flow, `Meta respondió: ${step}`, { path: path.split('?')[0], httpStatus: res.status, durationMs: Date.now() - startedAt, ...usage });
  if (!res.ok || data.error) {
    throw new MetaApiError(`${step}: ${data.error?.message ?? `HTTP ${res.status}`}`, { status: res.status, metaError: data.error });
  }
  return { data, usage, bytes: text.length };
}

const graphFetch = async (step, path, options) => (await graphRequest(step, path, options)).data;

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

/**
 * Recorre todas las páginas de un listado de la Graph API usando el cursor `after`.
 * Al terminar registra en el flujo `usage` cuánto tardó y consumió el listado completo.
 */
async function graphList(step, path, accessToken) {
  const items = [];
  const startedAt = Date.now();
  let after;
  let pages = 0;
  let bytes = 0;
  let usage = {};
  do {
    const page = after ? `${path}&after=${encodeURIComponent(after)}` : path;
    const res = await graphRequest(step, page, { accessToken, flow: 'meta-ads' });
    pages += 1;
    bytes += res.bytes;
    usage = maxUsage(usage, res.usage);
    items.push(...(res.data.data ?? []));
    after = res.data.paging?.next ? res.data.paging.cursors?.after : undefined;
  } while (after);
  log('info', 'usage', `Meta: listado completo: ${step}`, {
    step,
    path: path.split('?')[0],
    pages,
    rows: items.length,
    bytes,
    durationMs: Date.now() - startedAt,
    ...usage,
  });
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
export const cleanObjectId = (id) => cleanNumericId(id, 'identificador de anuncio');

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

const INSIGHTS_FIELDS = 'campaign_id,spend,impressions,reach,frequency,inline_link_clicks,actions,action_values';

/** Fecha YYYY-MM-DD de hace `days` días (UTC; Meta usa la zona horaria de la cuenta, la diferencia es de horas). */
const daysAgo = (days) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

/** Horizonte de "Lo que te funcionó antes" (docs/SPEC.md §4d): 18 meses. */
const WINNER_HISTORY_DAYS = 548;

const insightsPath = (accountId, level, period, fields) =>
  `/act_${accountId}/insights?level=${level}&${period}&fields=${fields}&limit=500`;

const monthName = (date) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).replace(' de ', ' ');

/**
 * Suma las filas mensuales del historial por campaña. `month` es el mes en que más gastó,
 * p. ej. "junio 2026". Las campañas ya borradas deducen su tipo de resultado del objetivo.
 */
function aggregateYear(rows, typeById) {
  return [...Map.groupBy(rows, (r) => r.campaign_id)].map(([campaignId, months]) => {
    const resultType = typeById.get(campaignId) ?? resultTypeFor(months[0].objective);
    const sum = (fn) => months.reduce((acc, m) => acc + fn(m), 0);
    const peak = months.reduce((a, b) => (Number(b.spend || 0) > Number(a.spend || 0) ? b : a));
    return {
      campaignId,
      name: months[0].campaign_name,
      resultType,
      cost: sum((m) => Number(m.spend || 0)),
      impressions: sum((m) => Number(m.impressions || 0)),
      linkClicks: sum((m) => Number(m.inline_link_clicks || 0)),
      landingPageViews: sum(landingPageViews),
      results: sum((m) => countResults(resultType, m)),
      purchaseValue: sum(purchaseValue),
      month: peak.date_start ? monthName(peak.date_start) : undefined,
    };
  });
}

/** Conjuntos de anuncios que hoy pueden publicar (activos y sin fecha de término pasada). */
const isDelivering = (adset) => adset.effective_status === 'ACTIVE' && (!adset.end_time || new Date(adset.end_time) > new Date());

/**
 * Campañas activas y pausadas con métricas de los últimos 30 días y todo lo que
 * necesita lib/alerts-meta.js. Devuelve también `context` (estado de la cuenta,
 * alcance total e historial de 90 días para comparar).
 *
 * Las campañas sin gasto en 90 días y creadas antes se ocultan (sólo se informa cuántas),
 * aunque sigan "activas": Meta deja en ACTIVE las campañas cuyo conjunto terminó por
 * fecha, así que en cuentas antiguas se acumulan cientos. `includeInactive` las
 * muestra igual, para pruebas.
 */
export async function getMetaCampaigns(accessToken, accountId, { includeInactive = false } = {}) {
  const list = (step, path) => graphList(step, path, accessToken);
  const [account, campaigns, adsets, rejectedAds, last30, last7, last90, previous30, accountReach, lastYear, rules] = await Promise.all([
    graphFetch('datos de la cuenta publicitaria', `/act_${accountId}?fields=name,currency,account_status,spend_cap,amount_spent`, {
      accessToken,
      flow: 'meta-ads',
    }),
    list('campañas', `/act_${accountId}/campaigns?fields=id,name,status,objective,created_time&limit=200`),
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
    // Para "Lo que te funcionó antes": por mes, para saber cuándo funcionó cada campaña.
    list(
      'historial de 18 meses',
      insightsPath(
        accountId,
        'campaign',
        `time_range=${encodeURIComponent(JSON.stringify({ since: daysAgo(WINNER_HISTORY_DAYS), until: daysAgo(1) }))}&time_increment=monthly`,
        `campaign_name,objective,${INSIGHTS_FIELDS}`
      )
    ),
    // Guardias (Protección): si no se pueden leer, el panel se muestra igual y Protección avisa.
    list('reglas automáticas', `/act_${accountId}/adrules_library?fields=id,name,status,evaluation_spec&limit=100`).catch((error) => {
      log('warn', 'meta-ads', 'No se pudieron leer las reglas automáticas', { accountId, ...metaErrorSummary(error) });
      return null;
    }),
  ]);

  const byCampaign = (rows) => new Map(rows.map((r) => [r.campaign_id, r]));
  const metrics30 = byCampaign(last30);
  const metrics7 = byCampaign(last7);
  const metricsPrev = byCampaign(previous30);
  const spent90 = new Set(last90.filter((r) => Number(r.spend) > 0).map((r) => r.campaign_id));
  const listed = campaigns.filter((c) => c.status === 'ACTIVE' || c.status === 'PAUSED');
  // Las recién creadas se muestran aunque no gasten todavía (p. ej. "Activa, sin publicar").
  const recent = (c) => new Date(c.created_time) > new Date(Date.now() - 90 * 86_400_000);
  const visible = includeInactive ? listed : listed.filter((c) => spent90.has(c.id) || recent(c));
  const adsetsByCampaign = Map.groupBy(adsets, (a) => a.campaign_id);
  const rejectedByCampaign = Map.groupBy(rejectedAds, (a) => a.campaign_id);

  const result = visible.map((c) => {
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
      createdTime: c.created_time,
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

  const yearHistory = aggregateYear(lastYear, typeById);

  log('info', 'meta-ads', `Cuenta ${accountId}: ${result.length} campañas`, {
    accountId,
    campaigns: result.length,
    hiddenInactive: listed.length - visible.length,
    withMetrics: last30.length,
    adsets: adsets.length,
    rejectedAds: rejectedAds.length,
    historyCampaigns: history.length,
    yearCampaigns: yearHistory.length,
    accountStatus: account.account_status,
  });

  const currency = account.currency || 'CLP';
  return {
    account: { id: accountId, name: account.name, currency },
    campaigns: result,
    hiddenCount: listed.length - visible.length,
    context: {
      accountStatus: account.account_status,
      reach: Number(accountReach[0]?.reach || 0),
      history,
      yearHistory,
      protection: protectionFrom(account, rules, currency),
    },
  };
}

/**
 * Prueba en sombra (docs/SPEC.md §4d): pide el historial de 3 años con el mismo
 * formato que el de 18 meses, para medir cuánto tarda y consume (flujo `usage`)
 * y si cambia la campaña ganadora. No se le muestra nada al usuario.
 */
export async function measureMetaLongHistory(accessToken, accountId, typeById, { findWinners, yearHistory }) {
  const startedAt = Date.now();
  const rows = await graphList(
    'historial de 3 años (prueba)',
    insightsPath(
      accountId,
      'campaign',
      `time_range=${encodeURIComponent(JSON.stringify({ since: daysAgo(3 * 365), until: daysAgo(1) }))}&time_increment=monthly`,
      `campaign_name,objective,${INSIGHTS_FIELDS}`
    ),
    accessToken
  );
  const longHistory = aggregateYear(rows, typeById);
  const winners18 = findWinners(yearHistory);
  const winners36 = findWinners(longHistory);
  const types = [...new Set([...Object.keys(winners18), ...Object.keys(winners36)])];
  log('info', 'usage', 'Meta: prueba de historial de 3 años', {
    accountId,
    durationMs: Date.now() - startedAt,
    rows36: rows.length,
    campaigns18: yearHistory.length,
    campaigns36: longHistory.length,
    winners18: Object.keys(winners18).length,
    winners36: Object.keys(winners36).length,
    // Objetivos en que la ganadora de 3 años es otra campaña que la de 18 meses.
    winnersChanged: types.filter((t) => winners18[t]?.campaignId !== winners36[t]?.campaignId).join(',') || 'none',
  });
}

/**
 * Gasto y resultados de los últimos 30 días por conjunto de anuncios y por anuncio,
 * y qué conjuntos y anuncios publican hoy. Sirve para "Pausa solo esta parte"
 * (lib/diagnosis-meta.js) y para el análisis en sombra. Se pide en paralelo con
 * getMetaCampaigns; los resultados se cuentan después con normalizeBreakdown.
 */
export async function getMetaBreakdownRows(accessToken, accountId) {
  const fields = 'campaign_id,adset_id,adset_name,ad_id,ad_name,spend,inline_link_clicks,reach,actions';
  const active = encodeURIComponent('["ACTIVE"]');
  const [adsets, ads, activeAdsets, activeAds] = await Promise.all([
    graphList('desglose por conjunto', insightsPath(accountId, 'adset', 'date_preset=last_30d', fields), accessToken),
    graphList('desglose por anuncio', insightsPath(accountId, 'ad', 'date_preset=last_30d', fields), accessToken),
    graphList('conjuntos que publican', `/act_${accountId}/adsets?fields=id&effective_status=${active}&limit=500`, accessToken),
    graphList('anuncios que publican', `/act_${accountId}/ads?fields=id&effective_status=${active}&limit=500`, accessToken),
  ]);
  return { adsets, ads, activeIds: new Set([...activeAdsets, ...activeAds].map((r) => r.id)) };
}

/** Partes de cada campaña con sus resultados contados con el tipo de su campaña. */
export function normalizeBreakdown({ adsets, ads, activeIds }, resultTypeByCampaign) {
  const normalize = (rows, level) =>
    rows
      .filter((r) => resultTypeByCampaign.has(r.campaign_id))
      .map((r) => ({
        campaignId: r.campaign_id,
        id: r[`${level}_id`],
        name: r[`${level}_name`],
        active: activeIds.has(r[`${level}_id`]),
        cost: Number(r.spend || 0),
        results: countResults(resultTypeByCampaign.get(r.campaign_id), r),
      }));
  return { adset: normalize(adsets, 'adset'), ad: normalize(ads, 'ad') };
}


function locationLabel(geo) {
  if (!geo) return null;
  const places = [...(geo.cities ?? []), ...(geo.regions ?? [])].map((p) => p.name).filter(Boolean);
  if (places.length) return places.length > 2 ? `${places.slice(0, 2).join(', ')} y ${places.length - 2} más` : places.join(' y ');
  if (geo.custom_locations?.length) return 'Cerca de una dirección';
  const countries = (geo.countries ?? []).map((code) => new Intl.DisplayNames(['es'], { type: 'region' }).of(code));
  if (countries.length === 1) return `Todo ${countries[0]}`;
  return countries.length ? countries.join(', ') : null;
}

function formatOf(creative = {}) {
  const spec = creative.object_story_spec ?? {};
  if (creative.video_id || spec.video_data || creative.object_type === 'VIDEO') return 'Video';
  if (spec.link_data?.child_attachments?.length) return 'Carrusel';
  return 'Foto';
}

/** Presupuesto diario, ubicación, edad y formato de una campaña, como texto para comparar. */
function campaignConfig(raw, currency) {
  const toAmount = (v) => fromMetaAmount(v, currency);
  const sets = raw.adsets?.data ?? [];
  // Si la campaña tiene conjuntos publicando, sólo cuentan ésos.
  const live = sets.filter((a) => a.effective_status === 'ACTIVE');
  const used = live.length ? live : sets;
  const dailyBudget = toAmount(raw.daily_budget) || used.reduce((acc, a) => acc + toAmount(a.daily_budget), 0) || null;
  const locations = [...new Set(used.map((a) => locationLabel(a.targeting?.geo_locations)).filter(Boolean))];
  const ages = used.map((a) => a.targeting).filter(Boolean);
  const ageMin = Math.min(...ages.map((t) => t.age_min ?? 18));
  const ageMax = Math.max(...ages.map((t) => t.age_max ?? 65));
  const formats = [...new Set((raw.ads?.data ?? []).map((ad) => formatOf(ad.creative)))];
  return {
    dailyBudget,
    location: locations.length === 1 ? locations[0] : locations.length > 1 ? 'Varias ubicaciones' : null,
    age: ages.length ? `${ageMin} a ${ageMax >= 65 ? '65 o más' : ageMax}` : null,
    formats: ['Video', 'Carrusel', 'Foto'].filter((f) => formats.includes(f)),
  };
}

/**
 * Configuración de las campañas que se comparan en "Lo que te funcionó antes".
 * Una consulta por campaña; si una falla, esa campaña queda sin comparación (null).
 */
export async function getMetaCampaignConfigs(accessToken, campaignIds, currency) {
  const fields =
    'daily_budget,adsets.limit(50){effective_status,daily_budget,targeting},ads.limit(10){creative{object_type,video_id,object_story_spec}}';
  const entries = await Promise.all(
    campaignIds.map(async (id) => {
      try {
        const raw = await graphFetch('configuración de campaña', `/${cleanCampaignId(id)}?fields=${encodeURIComponent(fields)}`, {
          accessToken,
          flow: 'meta-ads',
        });
        return [id, campaignConfig(raw, currency)];
      } catch (error) {
        log('warn', 'meta-ads', 'No se pudo leer la configuración de una campaña para comparar', { campaignId: id, ...metaErrorSummary(error) });
        return [id, null];
      }
    })
  );
  return Object.fromEntries(entries);
}

/** `status`: 'ACTIVE' | 'PAUSED'. Sirve para campañas, conjuntos y anuncios. Requiere el permiso ads_management. */
export async function setMetaObjectStatus(accessToken, objectId, status, step = 'cambio de estado de campaña') {
  await graphFetch(step, `/${objectId}`, {
    method: 'POST',
    accessToken,
    body: new URLSearchParams({ status }),
    flow: 'meta-ads',
  });
}

export const setMetaCampaignStatus = (accessToken, campaignId, status) => setMetaObjectStatus(accessToken, campaignId, status);

/**
 * "Crear una igual": copia la campaña con sus conjuntos y anuncios, en pausa.
 * Meta sólo copia de una vez campañas chicas; si es más grande, responde con error.
 * https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/copies/
 */
export async function copyMetaCampaign(accessToken, campaignId) {
  const data = await graphFetch('copia de campaña', `/${campaignId}/copies`, {
    method: 'POST',
    accessToken,
    body: new URLSearchParams({
      deep_copy: 'true',
      status_option: 'PAUSED',
      rename_options: JSON.stringify({ rename_strategy: 'ONLY_TOP_LEVEL_RENAME', rename_suffix: ' (copia AdsGuard)' }),
    }),
    flow: 'meta-ads',
  });
  return { campaignId: data.copied_campaign_id };
}

/** Tope de gasto de la cuenta y guardias activas, en la moneda de la cuenta. `guards` es null si no se pudieron leer las reglas. */
function protectionFrom(account, rules, currency) {
  return {
    spendCap: fromMetaAmount(account.spend_cap, currency),
    amountSpent: fromMetaAmount(account.amount_spent, currency),
    guards: rules && guardsFromRules(rules, currency),
  };
}

/** Lee de nuevo el tope y las guardias después de un cambio. */
export async function getMetaProtection(accessToken, accountId) {
  const [account, rules] = await Promise.all([
    graphFetch('tope de gasto', `/act_${accountId}?fields=currency,spend_cap,amount_spent`, { accessToken, flow: 'meta-ads' }),
    graphList('reglas automáticas', `/act_${accountId}/adrules_library?fields=id,name,status,evaluation_spec&limit=100`, accessToken),
  ]);
  return protectionFrom(account, rules, account.currency || 'CLP');
}

/** Activa una guardia: borra las reglas anteriores de AdsGuard con ese nombre y crea una nueva con los montos actuales. */
export async function enableMetaGuard(accessToken, accountId, key, values, currency) {
  if (!GUARDS[key] || !(values[GUARDS[key].needs] > 0)) throw new MetaApiError('guardia inválida', { status: 400, code: 'BAD_REQUEST' });
  await disableMetaGuard(accessToken, accountId, key);
  await graphFetch('creación de guardia', `/act_${accountId}/adrules_library`, {
    method: 'POST',
    accessToken,
    body: new URLSearchParams(guardRuleParams(key, values, currency)),
    flow: 'meta-ads',
  });
}

/** Desactiva una guardia borrando las reglas de AdsGuard con su nombre. No toca las reglas que creó el usuario. */
export async function disableMetaGuard(accessToken, accountId, key) {
  if (!GUARDS[key]) throw new MetaApiError('guardia inválida', { status: 400, code: 'BAD_REQUEST' });
  const rules = await graphList('reglas automáticas', `/act_${accountId}/adrules_library?fields=id,name&limit=100`, accessToken);
  const own = rules.filter((r) => r.name === GUARDS[key].ruleName);
  for (const r of own) {
    await graphFetch('borrado de guardia', `/${r.id}`, { method: 'DELETE', accessToken, flow: 'meta-ads' });
  }
}

/**
 * Tope de gasto de la cuenta. `action`: 'set' (con `amount`), 'reset' (vuelve a contar desde cero) o 'delete' (lo quita).
 * https://developers.facebook.com/docs/marketing-api/reference/ad-account/
 */
export async function setMetaSpendCap(accessToken, accountId, { action, amount }, currency) {
  const params =
    action === 'set'
      ? { spend_cap: String(toMetaAmount(amount, currency)) }
      : action === 'reset' || action === 'delete'
        ? { spend_cap_action: action }
        : null;
  if (!params || (action === 'set' && !(amount > 0))) throw new MetaApiError('tope inválido', { status: 400, code: 'BAD_REQUEST' });
  await graphFetch('tope de gasto', `/act_${accountId}`, { method: 'POST', accessToken, body: new URLSearchParams(params), flow: 'meta-ads' });
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
  // Errores de validación al cambiar algo (p. ej. un tope demasiado bajo): Meta trae un mensaje para el usuario.
  if (error.metaError?.error_user_msg && error.status === 400) return { status: 400, message: error.metaError.error_user_msg };
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
