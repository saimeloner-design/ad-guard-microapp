// Uso anónimo de la demo (docs/SPEC.md §9). La ruta es pública: sólo se aceptan tipos y
// campos conocidos, con textos cortos, para que nadie pueda llenar la base de datos con basura.

const TYPES = new Set([
  'view', // abrió la demo
  'tab', // cambió de pestaña
  'campaign_open', // abrió el detalle de una campaña
  'pause',
  'enable',
  'part_pause',
  'copy',
  'protection', // guardias o tope de gasto
  'profit_set', // escribió su ganancia por venta
  'task_done',
  'connect_click', // tocó "Conectar Meta"
  'exit', // tocó "Salir de la demo"
]);

const FIELDS = new Set(['tab', 'campaignId', 'action', 'key', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'referrer', 'width']);

const SESSION = /^[\w-]{8,40}$/;

/** `{ session, type, data }` limpio para guardar, o null si no es válido. */
export function cleanDemoEvent(body) {
  if (!body || !SESSION.test(body.session ?? '') || !TYPES.has(body.type)) return null;
  const data = {};
  for (const [key, value] of Object.entries(body.data ?? {})) {
    if (!FIELDS.has(key)) continue;
    if (typeof value === 'string' && value) data[key] = value.slice(0, 100);
    else if (typeof value === 'number' && Number.isFinite(value)) data[key] = value;
  }
  return { session: body.session, type: body.type, data };
}

/** `db`: cliente dentro de una transacción. */
export async function saveDemoEvent(db, { session, type, data }) {
  await db.query('insert into demo_events (session_id, type, data) values ($1, $2, $3)', [session, type, JSON.stringify(data)]);
}
