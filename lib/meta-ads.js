import { log, reportError, requiredEnv } from '@/lib/log';

// Versiones: https://developers.facebook.com/docs/graph-api/changelog/versions
export const META_GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v26.0';
export const META_GRAPH_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

// Permisos de la configuración de "Inicio de sesión con Facebook para empresas"
// (META_LOGIN_CONFIG_ID). public_profile se concede siempre.
export const META_ADS_PERMISSIONS = ['email', 'ads_read', 'ads_management'];

export class MetaApiError extends Error {
  constructor(message, { status, metaError } = {}) {
    super(message);
    this.name = 'MetaApiError';
    this.status = status;
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
async function graphFetch(step, path, { method = 'GET', accessToken, body } = {}) {
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
  log('info', 'login', `Meta respondió: ${step}`, { httpStatus: res.status, durationMs: Date.now() - startedAt });
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
