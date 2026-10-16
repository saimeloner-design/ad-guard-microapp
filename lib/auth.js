import * as Sentry from '@sentry/nextjs';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ADS_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET || '',
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/adwords',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Los tokens de Google quedan sólo en el JWT cifrado (cookie httpOnly);
      // no se copian a la sesión para que nunca lleguen al navegador.
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at; // segundos epoch
      }
      return token;
    },
    async session({ session, token }) {
      session.hasGoogleAds = Boolean(token.refreshToken);
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      Sentry.logger.info('Inicio de sesión', { userId: user.id });
    },
    async signOut({ token }) {
      Sentry.logger.info('Cierre de sesión', { userId: token?.sub });
    },
  },
  logger: {
    error(code, metadata) {
      Sentry.captureException(metadata?.error ?? new Error(code), { tags: { nextauth: code } });
    },
    warn(code) {
      Sentry.logger.warn(`next-auth: ${code}`);
    },
    debug() {},
  },
  secret: process.env.NEXTAUTH_SECRET,
};
