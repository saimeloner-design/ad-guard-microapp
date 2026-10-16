import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1,
  // No enviamos IPs, cookies ni headers: la cookie de sesión contiene los tokens de Google.
  sendDefaultPii: false,
  integrations: [Sentry.consoleLoggingIntegration({ levels: ['log', 'info', 'warn', 'error'] })],
});
