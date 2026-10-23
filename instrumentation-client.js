import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Solo en los dominios de Vercel (producción y desarrollo), no en localhost.
  enabled: window.location.hostname.endsWith('.vercel.app'),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1,
  sendDefaultPii: false,
  integrations: [Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] })],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
