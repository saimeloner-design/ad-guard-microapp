#!/usr/bin/env node
// Aplica las migraciones de db/migrations/ que falten, en orden, antes de `next build`
// (docs/SPEC.md §9). En Vercel cada entorno construye contra su propia rama de Neon:
// producción contra la principal y `develop` contra `preview/develop`.
//
// Usa la conexión directa (DATABASE_URL_UNPOOLED): el pool de Neon no admite el
// candado de sesión que evita que dos builds migren a la vez.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const DIR = join(import.meta.dirname, '..', 'db', 'migrations');
const LOCK_ID = 727_001; // pg_advisory_lock: cualquier número fijo, sólo lo usa este script

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  // En Vercel siempre debe existir: sin ella el deploy saldría con el esquema desactualizado.
  if (process.env.VERCEL) {
    console.error('migrate: falta DATABASE_URL_UNPOOLED');
    process.exit(1);
  }
  console.log('migrate: sin DATABASE_URL_UNPOOLED, se omiten las migraciones');
  process.exit(0);
}

// Igual que strictSsl en lib/db.js: evita el aviso de `pg` sobre sslmode=require.
const client = new pg.Client({ connectionString: url.replace(/sslmode=(prefer|require|verify-ca)\b/, 'sslmode=verify-full') });
await client.connect();
try {
  await client.query('select pg_advisory_lock($1)', [LOCK_ID]);
  await client.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
  const { rows } = await client.query('select name from schema_migrations');
  const applied = new Set(rows.map((r) => r.name));
  const pending = readdirSync(DIR)
    .filter((f) => f.endsWith('.sql') && !applied.has(f))
    .sort();
  for (const name of pending) {
    await client.query('begin');
    try {
      await client.query(readFileSync(join(DIR, name), 'utf8'));
      await client.query('insert into schema_migrations (name) values ($1)', [name]);
      await client.query('commit');
      console.log(`migrate: aplicada ${name}`);
    } catch (error) {
      await client.query('rollback');
      throw new Error(`migrate: falló ${name}: ${error.message}`, { cause: error });
    }
  }
  if (pending.length === 0) console.log('migrate: el esquema está al día');
} finally {
  await client.end();
}
