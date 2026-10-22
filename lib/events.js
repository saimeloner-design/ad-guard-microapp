import { saveAfterResponse } from '@/lib/db';
import { ensureUserAccount } from '@/lib/users';

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
    await ensureUserAccount(db, { userId, email, accountId });
    await db.query('insert into events (meta_user_id, meta_account_id, meta_campaign_id, type, data) values ($1, $2, $3, $4, $5)', [
      userId,
      accountId ?? null,
      campaignId ?? null,
      type,
      JSON.stringify(data),
    ]);
  });
}

/** Tarea de Hoy (`pausar:123`, `revisar:123:M1,M6`…) o undefined si no tiene esa forma. */
export function cleanTaskKey(value) {
  return typeof value === 'string' && value.length <= 300 && /^[a-z]+:[\w:,]+$/.test(value) ? value : undefined;
}

/** Guarda tareas de Hoy hechas, ya mismo (`db`: cliente dentro de una transacción). */
export async function saveDoneTasks(db, { userId, accountId, keys }) {
  await ensureUserAccount(db, { userId, accountId });
  await db.query(
    `insert into events (meta_user_id, meta_account_id, type, data)
     select $1, $2, 'task_done', jsonb_build_object('key', k) from unnest($3::text[]) as k`,
    [userId, accountId, keys]
  );
}
