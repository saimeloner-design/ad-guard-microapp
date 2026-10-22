import { saveAfterResponse } from '@/lib/db';

// Acciones del usuario en la tabla `events` (docs/SPEC.md §9). Sirven para medir qué alertas
// terminan en pausa, cuánto se ahorra y si se reactivan campañas que la app mandó a pausar.

const TYPES = new Set([
  'pause',
  'enable',
  'part_pause',
  'part_enable',
  'copy',
  'guard_create',
  'guard_remove',
  'spend_cap_set',
  'spend_cap_reset',
  'spend_cap_remove',
  'task_done',
  'login',
]);

/** Reglas de alerta que mandó el navegador (p. ej. ['M1', 'M6']), limpias. */
export function cleanRules(value) {
  return Array.isArray(value) ? value.filter((r) => typeof r === 'string' && /^[A-Z]\d{1,2}$/.test(r)).slice(0, 20) : [];
}

/** ID numérico de Meta (cuenta, campaña) o undefined: el evento se guarda igual sin él. */
export function cleanOptionalId(value) {
  const id = String(value ?? '').replace(/^act_/, '');
  return /^\d{1,30}$/.test(id) ? id : undefined;
}

/** Número finito o undefined (el navegador puede mandar cualquier cosa). */
export function cleanNumber(value) {
  const n = Number(value);
  return value !== null && value !== '' && Number.isFinite(n) ? n : undefined;
}

/**
 * Guarda el evento después de responder. El usuario y la cuenta se crean si todavía no
 * existen (la carga de campañas los guarda también después de responder: puede ir detrás).
 */
export function recordEvent({ userId, email, accountId, campaignId, type, data = {} }) {
  if (!TYPES.has(type)) throw new Error(`Tipo de evento desconocido: ${type}`);
  if (!userId) return;
  saveAfterResponse(`evento ${type}`, async (db) => {
    await db.query(
      `insert into users (meta_user_id, email) values ($1, $2)
       on conflict (meta_user_id) do update set email = coalesce(excluded.email, users.email), last_seen_at = now()`,
      [userId, email ?? null]
    );
    if (accountId) await db.query('insert into ad_accounts (meta_account_id) values ($1) on conflict do nothing', [accountId]);
    await db.query('insert into events (meta_user_id, meta_account_id, meta_campaign_id, type, data) values ($1, $2, $3, $4, $5)', [
      userId,
      accountId ?? null,
      campaignId ?? null,
      type,
      JSON.stringify(data),
    ]);
  });
}
