import * as Sentry from '@sentry/nextjs';
import { after } from 'next/server';

/**
 * Logs estructurados hacia Sentry Logs. `flow` permite filtrar todo un proceso
 * (p. ej. `flow:auth`) en el explorador de logs.
 */
export function log(level, flow, message, attributes = {}) {
  Sentry.logger[level](`[${flow}] ${message}`, { flow, ...attributes });
}

/** `javier@gmail.com` → `ja***@gmail.com`: suficiente para distinguir usuarios en los logs. */
export function maskEmail(email) {
  if (!email) return undefined;
  const [user, domain] = String(email).split('@');
  return `${user.slice(0, 2)}***@${domain}`;
}

/**
 * En Vercel la función se congela al responder y los logs en buffer se pierden.
 * Esto los envía cuando la respuesta ya salió, sin agregar latencia.
 */
export function flushLogsAfterResponse() {
  after(() => Sentry.flush(2000));
}
