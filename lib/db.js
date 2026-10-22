import * as Sentry from '@sentry/nextjs';
import { attachDatabasePool } from '@vercel/functions';
import { after } from 'next/server';
import pg from 'pg';
import { reportError, requiredEnv } from '@/lib/log';

// Base de datos (docs/SPEC.md §9): Neon Postgres con el driver `pg`, que Sentry traza solo.
// Cada entorno recibe su DATABASE_URL (con pool) desde la integración de Neon en Vercel.

let pool;

function getPool() {
  if (!pool) {
    const connectionString = requiredEnv('DATABASE_URL', 'db');
    if (!connectionString) throw new Error('Falta DATABASE_URL');
    pool = new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 5000 });
    // Con Fluid compute, cierra las conexiones ociosas antes de que la función se suspenda.
    attachDatabasePool(pool);
  }
  return pool;
}

/** Corre `fn(client)` dentro de una transacción. */
export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Guarda cuando la respuesta ya salió: no agrega latencia ni puede romperla.
 * Si falla, el usuario no nota nada y el error va a Sentry (flujo `db`).
 */
export function saveAfterResponse(name, fn) {
  after(async () => {
    try {
      await withTransaction(fn);
    } catch (error) {
      reportError('db', `No se pudo guardar: ${name}`, error);
    } finally {
      await Sentry.flush(2000);
    }
  });
}

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de la cuenta; UTC si no se conoce. */
export function today(timeZone) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || 'UTC' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
