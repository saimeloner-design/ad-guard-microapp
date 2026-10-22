// Uso anónimo de la demo (docs/SPEC.md §9): qué toca una visita, sin saber quién es.
// La visita se reconoce con un número al azar que se borra al cerrar la pestaña.

const SESSION_KEY = 'adsguard.demoSesion';

function sessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Manda el evento sin esperar respuesta; si falla, la demo sigue igual. */
export function trackDemo(type, data = {}) {
  try {
    const session = sessionId();
    if (!session) return;
    const body = JSON.stringify({ session, type, data });
    if (!navigator.sendBeacon?.('/api/demo/events', new Blob([body], { type: 'application/json' }))) {
      fetch('/api/demo/events', { method: 'POST', body, keepalive: true }).catch(() => {});
    }
  } catch {}
}

/** Datos de la primera vista: de dónde vino y el ancho de la pantalla (celular o computador). */
export function demoViewData() {
  const params = new URLSearchParams(window.location.search);
  const data = { width: window.innerWidth };
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) {
    if (params.get(key)) data[key] = params.get(key);
  }
  try {
    const host = document.referrer && new URL(document.referrer).host;
    if (host && host !== window.location.host) data.referrer = host;
  } catch {}
  return data;
}
