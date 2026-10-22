// Usuarios y cuentas publicitarias en la base de datos (docs/SPEC.md §9).

/**
 * Registra que el usuario vio la cuenta: crea o actualiza el usuario, la cuenta y el vínculo.
 * `db`: cliente dentro de una transacción.
 */
export async function saveMetaVisit(db, { userId, email, account }) {
  await db.query(
    `insert into users (meta_user_id, email) values ($1, $2)
     on conflict (meta_user_id) do update set email = coalesce(excluded.email, users.email), last_seen_at = now()`,
    [userId, email ?? null]
  );
  await db.query(
    `insert into ad_accounts (meta_account_id, currency, timezone) values ($1, $2, $3)
     on conflict (meta_account_id) do update set currency = excluded.currency,
       timezone = coalesce(excluded.timezone, ad_accounts.timezone), last_seen_at = now()`,
    [account.id, account.currency, account.timezone ?? null]
  );
  await db.query(
    `insert into user_ad_accounts (meta_user_id, meta_account_id) values ($1, $2)
     on conflict (meta_user_id, meta_account_id) do update set last_seen_at = now()`,
    [userId, account.id]
  );
}
