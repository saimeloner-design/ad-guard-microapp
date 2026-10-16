import * as Sentry from '@sentry/nextjs';
import { getToken } from 'next-auth/jwt';
import { log } from '@/lib/log';

const API_VERSION = process.env.GOOGLE_ADS_API_VERSION || 'v25';
const API_BASE = `https://googleads.googleapis.com/${API_VERSION}`;

export class GoogleAdsError extends Error {
  constructor(message, { status = 400, code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Errores frecuentes de la API traducidos a algo que un emprendedor entienda.
const FRIENDLY_ERRORS = {
  DEVELOPER_TOKEN_NOT_APPROVED:
    'La app aún está en modo de prueba con Google y sólo puede leer cuentas de prueba.',
  DEVELOPER_TOKEN_PROHIBITED: 'El token de desarrollador no es válido para este proyecto.',
  USER_PERMISSION_DENIED: 'Tu usuario de Google no tiene permiso sobre esta cuenta de Google Ads.',
  CUSTOMER_NOT_ENABLED: 'Esta cuenta de Google Ads está desactivada o aún no termina su configuración.',
  NOT_ADS_USER: 'Este usuario de Google no tiene ninguna cuenta de Google Ads.',
  OAUTH_TOKEN_EXPIRED: 'Tu sesión con Google expiró. Vuelve a conectar tu cuenta.',
  OAUTH_TOKEN_REVOKED: 'Quitaste el acceso a Google Ads. Vuelve a conectar tu cuenta.',
};

function firstErrorCode(body) {
  const errors = body?.error?.details?.flatMap((d) => d.errors || []) || [];
  const codeObj = errors[0]?.errorCode;
  return codeObj ? Object.values(codeObj)[0] : undefined;
}

/** Resumen del error de Google Ads para los logs (sin datos sensibles). */
function errorSummary(error) {
  const body = error?.details;
  const errors = body?.error?.details?.flatMap((d) => d.errors || []) || [];
  return {
    errorCode: error?.code,
    httpStatus: error?.status,
    googleStatus: body?.error?.status,
    googleMessage: errors[0]?.message || body?.error?.message || body?.error_description || error?.message,
    requestId: body?.error?.details?.find((d) => d.requestId)?.requestId,
  };
}

function developerToken() {
  const token = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!token) {
    throw new GoogleAdsError('Falta configurar GOOGLE_ADS_DEVELOPER_TOKEN en el servidor.', { status: 500 });
  }
  return token;
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    log('error', 'auth', 'No se pudo refrescar el access token', {
      httpStatus: res.status,
      googleError: data.error,
      googleMessage: data.error_description,
    });
    throw new GoogleAdsError(FRIENDLY_ERRORS.OAUTH_TOKEN_REVOKED, { status: 401, code: 'REAUTH', details: data });
  }
  log('info', 'auth', 'Access token refrescado', { scopes: data.scope });
  return data.access_token;
}

/** Obtiene un access token válido para el usuario de la request, refrescándolo si venció. */
export async function getAccessToken(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (token) Sentry.setUser({ id: token.sub, email: token.email });
  if (!token?.refreshToken) {
    log('warn', 'auth', 'Sesión sin refresh token de Google', { hasSession: Boolean(token), email: token?.email });
    throw new GoogleAdsError('Conecta tu cuenta de Google Ads para continuar.', { status: 401, code: 'REAUTH' });
  }
  const stillValid = token.accessToken && token.expiresAt && token.expiresAt * 1000 > Date.now() + 60_000;
  log('info', 'auth', 'Access token obtenido de la sesión', {
    email: token.email,
    stillValid: Boolean(stillValid),
    expiresAt: token.expiresAt ? new Date(token.expiresAt * 1000).toISOString() : undefined,
  });
  return stillValid ? token.accessToken : refreshAccessToken(token.refreshToken);
}

async function adsFetch(accessToken, path, { method = 'GET', body, loginCustomerId } = {}) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': developerToken(),
    'Content-Type': 'application/json',
  };
  // Para leer una cuenta a través de una administradora (MCC) del propio usuario hay que indicar esa MCC.
  if (loginCustomerId) headers['login-customer-id'] = String(loginCustomerId).replace(/-/g, '');

  const startedAt = Date.now();
  const res = await fetch(`${API_BASE}/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const code = firstErrorCode(data);
    const message = FRIENDLY_ERRORS[code] || 'Google Ads respondió con un error. Intenta de nuevo en unos minutos.';
    const status = code?.startsWith('OAUTH') ? 401 : res.status;
    const error = new GoogleAdsError(message, { status, code: status === 401 ? 'REAUTH' : code, details: data });
    log('warn', 'google-ads', `${method} ${path} falló`, {
      path,
      loginCustomerId: headers['login-customer-id'],
      durationMs: Date.now() - startedAt,
      ...errorSummary(error),
      googleErrorCode: code,
      httpStatus: res.status,
    });
    throw error;
  }
  log('info', 'google-ads', `${method} ${path} OK`, {
    path,
    loginCustomerId: headers['login-customer-id'],
    durationMs: Date.now() - startedAt,
  });
  return data;
}

async function search(accessToken, customerId, query, loginCustomerId) {
  const rows = [];
  let pageToken;
  do {
    const data = await adsFetch(accessToken, `customers/${customerId}/googleAds:search`, {
      method: 'POST',
      body: { query, pageToken },
      loginCustomerId,
    });
    rows.push(...(data.results || []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return rows;
}

export function cleanCustomerId(id) {
  const clean = String(id || '').replace(/-/g, '');
  if (!/^\d{10}$/.test(clean)) {
    throw new GoogleAdsError('Identificador de cuenta inválido.', { status: 400 });
  }
  return clean;
}

export function cleanOptionalCustomerId(id) {
  return id ? cleanCustomerId(id) : undefined;
}

/**
 * Cuentas con anuncios que el usuario puede revisar:
 * - cuentas a las que tiene acceso directo, y
 * - cuentas que cuelgan de una cuenta administradora (MCC) suya.
 * Las MCC se devuelven aparte: no tienen campañas propias, pero explican al
 * usuario por qué ve "dos cuentas" en Google Ads.
 */
export async function listAccounts(accessToken) {
  log('info', 'accounts', 'Buscando cuentas accesibles', { apiVersion: API_VERSION });
  const { resourceNames = [] } = await adsFetch(accessToken, 'customers:listAccessibleCustomers');
  const ids = resourceNames.map((r) => r.split('/')[1]);
  log('info', 'accounts', `listAccessibleCustomers devolvió ${ids.length} cuentas`, {
    count: ids.length,
    customerIds: ids.join(','),
  });

  const direct = await Promise.all(
    ids.map(async (id) => {
      try {
        const [row] = await search(
          accessToken,
          id,
          'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager, customer.test_account, customer.status FROM customer'
        );
        if (!row?.customer) {
          log('warn', 'accounts', `Cuenta ${id} sin datos de customer`, { customerId: id });
          return null;
        }
        log('info', 'accounts', `Cuenta ${id} leída`, {
          customerId: id,
          name: row.customer.descriptiveName,
          manager: Boolean(row.customer.manager),
          testAccount: Boolean(row.customer.testAccount),
          status: row.customer.status,
        });
        return { ...row.customer, id: String(row.customer.id) };
      } catch (error) {
        // Cuentas canceladas o sin permiso: se omiten en vez de romper el listado.
        log('warn', 'accounts', `Cuenta ${id} omitida: no se pudo leer`, { customerId: id, ...errorSummary(error) });
        return null;
      }
    })
  );

  const toAccount = (c, loginCustomerId) => ({
    id: String(c.id),
    name: c.descriptiveName || `Cuenta ${c.id}`,
    currency: c.currencyCode,
    testAccount: Boolean(c.testAccount),
    loginCustomerId,
  });

  const found = direct.filter(Boolean);
  const managers = found.filter((c) => c.manager);
  const accounts = new Map(found.filter((c) => !c.manager && c.status !== 'CANCELED').map((c) => [c.id, toAccount(c)]));

  for (const manager of managers) {
    try {
      const rows = await search(
        accessToken,
        manager.id,
        `SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code,
                customer_client.manager, customer_client.test_account, customer_client.status
         FROM customer_client
         WHERE customer_client.level = 1 AND customer_client.manager = FALSE AND customer_client.status = 'ENABLED'`,
        manager.id
      );
      log('info', 'accounts', `MCC ${manager.id} tiene ${rows.length} cuentas cliente activas`, {
        managerId: manager.id,
        clientIds: rows.map((r) => String(r.customerClient.id)).join(','),
      });
      for (const { customerClient: c } of rows) {
        if (!accounts.has(String(c.id))) accounts.set(String(c.id), toAccount(c, manager.id));
      }
    } catch (error) {
      // Sin permiso para listar las cuentas de esta MCC: se ignora.
      log('warn', 'accounts', `No se pudieron listar las cuentas de la MCC ${manager.id}`, {
        managerId: manager.id,
        ...errorSummary(error),
      });
    }
  }

  const canceled = found.filter((c) => !c.manager && c.status === 'CANCELED');
  log(accounts.size === 0 ? 'warn' : 'info', 'accounts', `Resultado: ${accounts.size} cuentas con anuncios`, {
    accessible: ids.length,
    readable: found.length,
    unreadable: ids.length - found.length,
    managers: managers.length,
    canceled: canceled.length,
    accounts: [...accounts.keys()].join(','),
  });

  return {
    accounts: [...accounts.values()],
    managers: managers.map((m) => ({ id: m.id, name: m.descriptiveName || `Cuenta ${m.id}` })),
  };
}

const micros = (v) => Number(v || 0) / 1_000_000;

/** Campañas activas y pausadas con métricas agregadas de los últimos 30 días. */
export async function getCampaigns(accessToken, customerId, loginCustomerId) {
  const [customerRow] = await search(
    accessToken,
    customerId,
    'SELECT customer.currency_code, customer.descriptive_name FROM customer',
    loginCustomerId
  );

  const rows = await search(
    accessToken,
    customerId,
    `SELECT
       campaign.id,
       campaign.name,
       campaign.status,
       campaign.advertising_channel_type,
       metrics.cost_micros,
       metrics.clicks,
       metrics.impressions,
       metrics.conversions
     FROM campaign
     WHERE campaign.status IN ('ENABLED', 'PAUSED')
       AND segments.date DURING LAST_30_DAYS`,
    loginCustomerId
  );

  // Una campaña sin actividad en el período no aparece en el reporte, así que
  // traemos también la lista simple para no "perder" campañas.
  const allCampaigns = await search(
    accessToken,
    customerId,
    `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type
     FROM campaign WHERE campaign.status IN ('ENABLED', 'PAUSED')`,
    loginCustomerId
  );

  const metricsById = new Map(rows.map((r) => [String(r.campaign.id), r.metrics || {}]));

  const campaigns = allCampaigns.map(({ campaign }) => {
    const m = metricsById.get(String(campaign.id)) || {};
    return {
      id: String(campaign.id),
      name: campaign.name,
      status: campaign.status === 'ENABLED' ? 'active' : 'paused',
      channel: campaign.advertisingChannelType,
      cost: micros(m.costMicros),
      clicks: Number(m.clicks || 0),
      impressions: Number(m.impressions || 0),
      conversions: Number(m.conversions || 0),
    };
  });

  return {
    account: {
      id: customerId,
      name: customerRow?.customer?.descriptiveName,
      currency: customerRow?.customer?.currencyCode || 'CLP',
    },
    campaigns,
  };
}

export async function setCampaignStatus(accessToken, customerId, campaignId, status, loginCustomerId) {
  await adsFetch(accessToken, `customers/${customerId}/campaigns:mutate`, {
    method: 'POST',
    loginCustomerId,
    body: {
      operations: [
        {
          update: { resourceName: `customers/${customerId}/campaigns/${campaignId}`, status },
          updateMask: 'status',
        },
      ],
    },
  });
}

export function errorResponse(error) {
  if (error instanceof GoogleAdsError) {
    log('error', 'google-ads', `Respuesta de error al cliente: ${error.message}`, {
      ...errorSummary(error),
      details: error.details ? JSON.stringify(error.details).slice(0, 4000) : undefined,
    });
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }
  // Las rutas capturan sus errores, así que onRequestError no los ve: se reportan aquí.
  Sentry.captureException(error);
  log('error', 'google-ads', `Error inesperado: ${error?.message}`, { stack: error?.stack?.slice(0, 4000) });
  return Response.json({ error: 'Error inesperado del servidor.' }, { status: 500 });
}
