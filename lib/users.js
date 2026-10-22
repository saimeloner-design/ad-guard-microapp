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

/** Crea el usuario y la cuenta si todavía no existen; actualiza el email y la última visita. */
export async function ensureUserAccount(db, { userId, email, accountId }) {
  await db.query(
    `insert into users (meta_user_id, email) values ($1, $2)
     on conflict (meta_user_id) do update set email = coalesce(excluded.email, users.email), last_seen_at = now()`,
    [userId, email ?? null]
  );
  if (accountId) await db.query('insert into ad_accounts (meta_account_id) values ($1) on conflict do nothing', [accountId]);
}

// Las tareas hechas hace más de esto ya no se recuerdan (sus campañas cambiaron o terminaron).
const DONE_TASKS_DAYS = 90;

/** Ganancia por venta y tareas de Hoy hechas, de este usuario en esta cuenta. */
export async function getAccountSettings(db, { userId, accountId }) {
  const [settings, tasks] = await Promise.all([
    db.query('select profit_per_sale from account_settings where meta_user_id = $1 and meta_account_id = $2', [userId, accountId]),
    db.query(
      `select distinct data->>'key' as key from events
       where meta_user_id = $1 and meta_account_id = $2 and type = 'task_done' and at > now() - make_interval(days => $3)`,
      [userId, accountId, DONE_TASKS_DAYS]
    ),
  ]);
  const profit = settings.rows[0]?.profit_per_sale;
  return { profitPerSale: profit == null ? null : Number(profit), doneTasks: tasks.rows.map((r) => r.key) };
}

/** `profitPerSale`: número > 0, o null para borrarla. */
export async function saveProfitPerSale(db, { userId, accountId, profitPerSale }) {
  await db.query(
    `insert into account_settings (meta_user_id, meta_account_id, profit_per_sale) values ($1, $2, $3)
     on conflict (meta_user_id, meta_account_id) do update set profit_per_sale = excluded.profit_per_sale, updated_at = now()`,
    [userId, accountId, profitPerSale]
  );
}
