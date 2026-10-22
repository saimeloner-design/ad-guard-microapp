import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { withTransaction } from '@/lib/db';
import { log, requiredEnv } from '@/lib/log';

// Borrado de datos pedido desde Meta (docs/SPEC.md §9): al quitar la app desde Facebook o al pedir
// que se borren sus datos, Meta llama a nuestras URLs con un `signed_request` firmado con el
// secreto de la app.

/**
 * Verifica y lee el `signed_request` de Meta (`<firma>.<payload>`, ambos en base64url).
 * Devuelve el payload ({ user_id, algorithm, issued_at, … }) o null si la firma no es válida.
 */
export function parseSignedRequest(signedRequest, appSecret) {
  if (typeof signedRequest !== 'string' || !appSecret) return null;
  const [signature, payload] = signedRequest.split('.');
  if (!signature || !payload) return null;
  const expected = createHmac('sha256', appSecret).update(payload).digest();
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.algorithm?.toUpperCase() === 'HMAC-SHA256' && data.user_id ? data : null;
  } catch {
    return null;
  }
}

/** Código que Meta le muestra al usuario para consultar el estado del borrado. */
export const newConfirmationCode = () => randomBytes(9).toString('base64url');

/**
 * Borra todo lo del usuario: el usuario arrastra (en cascada) sus vínculos con cuentas,
 * su ganancia por venta y sus eventos. Las cuentas que quedan sin nadie se borran con sus
 * registros diarios. `db`: cliente dentro de una transacción.
 * Devuelve cuántas filas se borraron, para el log.
 */
export async function deleteMetaUser(db, metaUserId) {
  const accounts = await db.query(
    `select meta_account_id from user_ad_accounts where meta_user_id = $1
     union select meta_account_id from account_settings where meta_user_id = $1
     union select meta_account_id from events where meta_user_id = $1 and meta_account_id is not null`,
    [metaUserId]
  );
  const users = await db.query('delete from users where meta_user_id = $1', [metaUserId]);
  const ids = accounts.rows.map((r) => r.meta_account_id);
  // Sólo las cuentas de este usuario que ya no tienen a nadie más (ni vínculo, ni ajustes, ni eventos).
  const orphans = ids.length
    ? await db.query(
        `delete from ad_accounts a where a.meta_account_id = any($1::text[])
           and not exists (select 1 from user_ad_accounts u where u.meta_account_id = a.meta_account_id)
           and not exists (select 1 from account_settings s where s.meta_account_id = a.meta_account_id)
           and not exists (select 1 from events e where e.meta_account_id = a.meta_account_id)`,
        [ids]
      )
    : { rowCount: 0 };
  return { users: users.rowCount, accounts: orphans.rowCount };
}

/**
 * Atiende un aviso de Meta: verifica la firma, borra los datos y anota el pedido.
 * `source`: 'data_deletion' | 'deauthorize'. Devuelve el código de confirmación,
 * o null si la firma no es válida.
 */
export async function handleMetaDeletion(request, source) {
  const form = await request.formData().catch(() => null);
  const data = parseSignedRequest(form?.get('signed_request'), requiredEnv('META_APP_SECRET', 'data-deletion'));
  if (!data) {
    log('warn', 'data-deletion', 'Aviso de Meta con firma inválida', { source });
    return null;
  }
  const code = newConfirmationCode();
  const deleted = await withTransaction(async (db) => {
    await db.query('insert into deletion_requests (confirmation_code, source) values ($1, $2)', [code, source]);
    const counts = await deleteMetaUser(db, String(data.user_id));
    await db.query('update deletion_requests set completed_at = now() where confirmation_code = $1', [code]);
    return counts;
  });
  // Sin el ID del usuario: sus datos ya no existen y el log no debe volver a identificarlo.
  log('info', 'data-deletion', 'Datos borrados por pedido de Meta', { source, confirmationCode: code, ...deleted });
  return code;
}

/** Estado de un pedido de borrado para la página pública, o null si el código no existe. */
export async function getDeletionRequest(code) {
  if (typeof code !== 'string' || !/^[\w-]{6,40}$/.test(code)) return null;
  const { rows } = await withTransaction((db) =>
    db.query('select requested_at, completed_at from deletion_requests where confirmation_code = $1', [code])
  );
  return rows[0] ?? null;
}
