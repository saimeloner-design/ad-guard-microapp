import * as Sentry from '@sentry/nextjs';
import GoogleProvider from 'next-auth/providers/google';
import { log } from '@/lib/log';

const ADWORDS_SCOPE = 'https://www.googleapis.com/auth/adwords';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ADS_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET || '',
      authorization: {
        params: {
          scope: `openid email profile ${ADWORDS_SCOPE}`,
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
        // Google permite desmarcar permisos en la pantalla de consentimiento: si el
        // usuario no marca Google Ads, el token no sirve para la API.
        const grantedScopes = account.scope?.split(' ') ?? [];
        log('info', 'auth', 'Tokens de Google recibidos', {
          email: token.email,
          provider: account.provider,
          scopes: account.scope,
          hasAdwordsScope: grantedScopes.includes(ADWORDS_SCOPE),
          hasAccessToken: Boolean(account.access_token),
          hasRefreshToken: Boolean(account.refresh_token),
          expiresAt: account.expires_at ? new Date(account.expires_at * 1000).toISOString() : undefined,
        });
        if (!grantedScopes.includes(ADWORDS_SCOPE)) {
          log('warn', 'auth', 'El usuario no concedió el permiso de Google Ads', { email: token.email, scopes: account.scope });
        }
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
    async signIn({ user, account, isNewUser }) {
      log('info', 'auth', 'Inicio de sesión', { userId: user.id, email: user.email, provider: account?.provider, isNewUser });
    },
    async signOut({ token }) {
      log('info', 'auth', 'Cierre de sesión', { userId: token?.sub, email: token?.email });
    },
  },
  logger: {
    error(code, metadata) {
      log('error', 'auth', `next-auth: ${code}`, {
        code,
        error: metadata?.error?.message ?? metadata?.message,
        providerId: metadata?.providerId,
      });
      Sentry.captureException(metadata?.error ?? new Error(code), { tags: { nextauth: code } });
    },
    warn(code) {
      log('warn', 'auth', `next-auth: ${code}`, { code });
    },
    debug() {},
  },
  secret: process.env.NEXTAUTH_SECRET,
};
