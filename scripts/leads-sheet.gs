/**
 * Apps Script de la Google Sheet de leads de AdsGuard. Recibe los registros de /api/leads.
 *
 * Instalación:
 * 1. Crea una Google Sheet y abre Extensiones → Apps Script. Pega este archivo completo.
 * 2. En Configuración del proyecto (ícono de engranaje) → Propiedades del script, agrega
 *    SECRET con un valor largo al azar. Ese mismo valor va en LEADS_SHEET_SECRET en Vercel.
 * 3. Implementar → Nueva implementación → Aplicación web.
 *    Ejecutar como: Yo. Quién tiene acceso: Cualquier persona.
 * 4. Copia la URL que termina en /exec y ponla en LEADS_SHEET_WEBHOOK_URL en Vercel.
 *
 * Si cambias este código, usa Implementar → Gestionar implementaciones → Editar → Nueva versión,
 * así la URL se mantiene.
 */

const SHEET_NAME = 'Leads';
const COLUMNS = [
  ['createdAt', 'Fecha'],
  ['name', 'Nombre'],
  ['contact', 'Email o WhatsApp'],
  ['spend', 'Inversión mensual'],
  ['utm_source', 'utm_source'],
  ['utm_medium', 'utm_medium'],
  ['utm_campaign', 'utm_campaign'],
  ['utm_content', 'utm_content'],
  ['utm_term', 'utm_term'],
  ['fbclid', 'fbclid'],
  // Al final para no descuadrar las filas que ya existen. En una hoja ya creada, escribe el título a mano.
  ['facebook', 'Perfil de Facebook'],
];

function doPost(e) {
  const secret = PropertiesService.getScriptProperties().getProperty('SECRET');
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: 'json' });
  }
  if (!secret || body.secret !== secret) return json({ ok: false, error: 'unauthorized' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = book.getSheetByName(SHEET_NAME) || book.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(COLUMNS.map(([, title]) => title));
      sheet.setFrozenRows(1);
    }
    const lead = body.lead || {};
    sheet.appendRow(COLUMNS.map(([key]) => (key === 'createdAt' ? new Date(lead.createdAt) : asText(lead[key]))));
  } finally {
    lock.releaseLock();
  }
  return json({ ok: true });
}

// Un WhatsApp como "+56 9…" o un texto que empiece con "=" se leería como fórmula; el apóstrofo lo deja como texto.
function asText(value) {
  const text = value == null ? '' : String(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
