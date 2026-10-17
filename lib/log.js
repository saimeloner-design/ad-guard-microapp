import * as Sentry from '@sentry/nextjs';
import { after } from 'next/server';

/**
 * Logs estructurados hacia Sentry Logs. `flow` permite filtrar todo un proceso
 * (p. ej. `flow:login`) en el explorador de logs.
 */
export function log(level, flow, message, attributes = {}) {
  Sentry.logger[level](`[${flow}] ${message}`, { flow, ...attributes });
}

/**
 * Registra el error en los logs y lo envía a Sentry como issue. Usar en todo error
 * que no se relance, para que ninguno quede escondido. `attributes` no debe llevar
 * tokens, secretos ni datos personales.
 */
export function reportError(flow, message, error, attributes = {}) {
  log('error', flow, message, { ...attributes, error: error?.message, errorName: error?.name });
  Sentry.captureException(error, { tags: { flow }, extra: { message, ...attributes } });
}

/** Lee una variable obligatoria; si falta, lo reporta a Sentry en vez de usar un valor por defecto. */
export function requiredEnv(name, flow) {
  const value = process.env[name];
  if (!value) {
    reportError(flow, `Falta la variable de entorno ${name}`, new Error(`Falta la variable de entorno ${name}`), { variable: name });
  }
  return value;
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
