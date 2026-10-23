// Compartido por el formulario de /beta y /api/leads, para que ambos acepten las mismas opciones.
export const SPEND_OPTIONS = [
  'Menos de $50.000 CLP',
  '$50.000 a $200.000 CLP',
  '$200.000 a $1.000.000 CLP',
  'Más de $1.000.000 CLP',
  'Todavía no invierto',
];

// Desde dónde promociona: sin Facebook no hay forma de conectarse, así que se mide cuántos solo usan Instagram.
export const PLATFORM_OPTIONS = ['Instagram', 'Facebook', 'Instagram y Facebook', 'Todavía no promociono'];

// Parámetros de la URL que se guardan junto al lead para saber de qué anuncio vino.
export const TRACKING_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];

/**
 * Normaliza el perfil de Facebook que escribe la persona (enlace, usuario o ID numérico)
 * a un enlace https://www.facebook.com/…, que es lo que se pega en App Roles → Testers.
 * Devuelve null si no parece un perfil.
 */
export function normalizeFacebookProfile(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  // Usuario suelto ("camila.rojas") o ID numérico.
  if (/^[\w.]{3,50}$/.test(text)) return `https://www.facebook.com/${text}`;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (!/(^|\.)(facebook\.com|fb\.com)$/i.test(url.hostname)) return null;
  const id = url.searchParams.get('id');
  if (url.pathname.replace(/\/+$/, '') === '/profile.php') return /^\d+$/.test(id ?? '') ? `https://www.facebook.com/profile.php?id=${id}` : null;
  const parts = url.pathname.split('/').filter(Boolean);
  // "Copiar enlace" de la app móvil da facebook.com/share/<código>; hay que abrirlo para llegar al perfil.
  if (['share', 'people'].includes(parts[0]) && parts.length > 1) return `https://www.facebook.com/${parts.join('/')}`;
  return parts[0] && /^[\w.]{3,50}$/.test(parts[0]) ? `https://www.facebook.com/${parts[0]}` : null;
}
