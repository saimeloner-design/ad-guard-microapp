import { withSentryConfig } from '@sentry/nextjs/config';

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  org: 'adguard',
  project: process.env.SENTRY_PROJECT,
  // Sube los source maps sólo si hay token (en Vercel); en local no hace nada.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Envía los eventos del navegador a través de la app para evitar bloqueadores de anuncios.
  tunnelRoute: '/monitoring',
});
