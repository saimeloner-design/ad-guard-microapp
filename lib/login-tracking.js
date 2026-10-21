import { log } from '@/lib/log';

// Seguimiento de los intentos de login (docs/SPEC.md §7): cuando Facebook se queda
// pegado, el usuario nunca vuelve a AdsGuard y el servidor no se entera. Por eso se
// registra el intento al salir hacia el proveedor y el regreso por separado, unidos
// por `attemptId`. Un intento sin regreso es un login que se trabó o se abandonó.

const COOKIE = 'adsguard_login';
const MAX_AGE = 30 * 60; // segundos

/** Dispositivo, sistema y navegador a partir del user agent. Sin datos personales. */
export function deviceFrom(ua = '') {
  const os = /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'otro';
  // Navegadores dentro de apps (Facebook, Instagram, WhatsApp…): suelen romper el regreso del login.
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|; wv\)/.test(ua);
  const browser = /EdgA?\//.test(ua)
    ? 'Edge'
    : /SamsungBrowser/.test(ua)
      ? 'Samsung'
      : /CriOS|Chrome\//.test(ua)
        ? 'Chrome'
        : /FxiOS|Firefox\//.test(ua)
          ? 'Firefox'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'otro';
  return { device: /Mobi|iPhone|iPod|Android/.test(ua) ? 'celular' : /iPad|Tablet/.test(ua) ? 'tablet' : 'computador', os, browser, inApp };
}

/** Copia la respuesta para poder agregarle encabezados (algunas respuestas traen los suyos inmutables). */
function withCookie(response, cookie) {
  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', cookie);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** Resultado del regreso según adónde redirige next-auth: con ?error=… volvió con un error. */
function resultOf(request, response) {
  const providerError = request.nextUrl.searchParams.get('error');
  if (providerError) return providerError === 'access_denied' ? 'cancelado' : `error del proveedor: ${providerError}`;
  const location = response.headers.get('location') ?? '';
  const appError = location.includes('error=') ? new URL(location, request.nextUrl.origin).searchParams.get('error') : null;
  return appError ? `error: ${appError}` : response.status >= 400 ? `HTTP ${response.status}` : 'ok';
}

/**
 * Envuelve el handler de next-auth. Registra la salida (POST /api/auth/signin/{proveedor})
 * y el regreso (GET /api/auth/callback/{proveedor}) en el flujo `login`.
 */
export async function trackLogin(request, run) {
  const path = request.nextUrl.pathname;
  const signin = path.match(/\/api\/auth\/signin\/([\w-]+)$/);
  const callback = path.match(/\/api\/auth\/callback\/([\w-]+)$/);
  if (!(signin && request.method === 'POST') && !callback) return run();

  const device = deviceFrom(request.headers.get('user-agent') ?? '');
  const response = await run();

  if (signin) {
    const attemptId = crypto.randomUUID().slice(0, 8);
    log('info', 'login', 'Intento de login: sale hacia el proveedor', { attemptId, provider: signin[1], ...device });
    // Lax: el navegador la manda cuando Facebook redirige de vuelta a /api/auth/callback.
    return withCookie(response, `${COOKIE}=${attemptId}.${Date.now()}; Path=/api/auth; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`);
  }

  const [attemptId, startedAt] = (request.cookies.get(COOKIE)?.value ?? '').split('.');
  log('info', 'login', 'Intento de login: vuelve del proveedor', {
    attemptId: attemptId || 'sin-marca',
    provider: callback[1],
    // Sin marca: volvió en otro navegador o ventana (p. ej. la app de Facebook), o pasaron más de 30 minutos.
    sameBrowser: Boolean(attemptId),
    seconds: startedAt ? Math.round((Date.now() - Number(startedAt)) / 1000) : undefined,
    result: resultOf(request, response),
    ...device,
  });
  return withCookie(response, `${COOKIE}=; Path=/api/auth; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
}
