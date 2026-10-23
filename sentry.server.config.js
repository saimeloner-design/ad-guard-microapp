import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Solo en Vercel: una build local no tiene las variables de entorno y llenaría Sentry de errores falsos.
  enabled: Boolean(process.env.VERCEL),
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1,
  // No enviamos IPs, cookies ni headers: la cookie de sesión contiene los tokens de Google.
  sendDefaultPii: false,
  integrations: [Sentry.consoleLoggingIntegration({ levels: ['log', 'info', 'warn', 'error'] })],
});
