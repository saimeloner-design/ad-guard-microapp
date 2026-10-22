// Retención (docs/SPEC.md §9): lo diario se guarda 13 meses (para comparar con el mismo mes
// del año anterior) y el uso anónimo de la demo, 6 meses. El resto no tiene límite.

const RULES = [
  { table: 'campaign_days', column: 'day', keep: '13 months' },
  { table: 'shadow_days', column: 'day', keep: '13 months' },
  { table: 'demo_events', column: 'at', keep: '6 months' },
];

/** Borra lo vencido. `db`: cliente dentro de una transacción. Devuelve cuántas filas por tabla. */
export async function deleteExpired(db) {
  const deleted = {};
  for (const { table, column, keep } of RULES) {
    // Nombres fijos de esta lista, no vienen de afuera.
    const { rowCount } = await db.query(`delete from ${table} where ${column} < now() - $1::interval`, [keep]);
    deleted[table] = rowCount;
  }
  return deleted;
}
