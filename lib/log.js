import * as Sentry from '@sentry/nextjs';
import { after } from 'next/server';

/**
 * Logs estructurados hacia Sentry Logs. `flow` permite filtrar todo un proceso
 * (p. ej. `flow:auth`) en el explorador de logs.
 */
export function log(level, flow, message, attributes = {}) {
  Sentry.logger[level](`[${flow}] ${message}`, { flow, ...attributes });
}

/**
 * En Vercel la función se congela al responder y los logs en buffer se pierden.
 * Esto los envía cuando la respuesta ya salió, sin agregar latencia.
 */
export function flushLogsAfterResponse() {
  after(() => Sentry.flush(2000));
}
