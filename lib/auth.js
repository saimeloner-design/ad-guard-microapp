import * as Sentry from '@sentry/nextjs';
import FacebookProvider from 'next-auth/providers/facebook';
import GoogleProvider from 'next-auth/providers/google';
import { headers } from 'next/headers';
import { recordEvent } from '@/lib/events';
import { log, maskEmail, reportError, requiredEnv } from '@/lib/log';
import { deviceFrom } from '@/lib/login-tracking';
import { exchangeForLongLivedToken, getPermissions, META_ADS_PERMISSIONS, META_GRAPH_VERSION } from '@/lib/meta-ads';

export const ADWORDS_SCOPE = 'https://www.googleapis.com/auth/adwords';

const toIso = (epochSeconds) => (epochSeconds ? new Date(epochSeconds * 1000).toISOString() : undefined);

/** Booleanos por permiso (sin listas crudas de scopes en los logs). */
function permissionFlags(permissions) {
  if (!permissions) return { permissionsKnown: false };
  const flags = { permissionsKnown: true };
  for (const p of META_ADS_PERMISSIONS) {
    flags[`granted_${p}`] = permissions.granted.includes(p);
    flags[`declined_${p}`] = permissions.declined.includes(p);
  }
  return flags;
}

async function handleMetaTokens(token, account) {
  const email = maskEmail(token.email);
  log('info', 'login', 'Meta devolvió el token del login', {
    email,
    hasEmail: Boolean(token.email),
    hasAccessToken: Boolean(account.access_token),
    tokenType: account.token_type,
    expiresAt: toIso(account.expires_at),
    graphVersion: META_GRAPH_VERSION,
  });
  if (!account.access_token) {
    // Sin token la sesión queda sin Meta (session.hasMetaAds = false).
    reportError('login', 'Meta no devolvió access_token en el login', new Error('Meta no devolvió access_token'), { email });
    return;
  }

  const longLived = await exchangeForLongLivedToken(account.access_token);
  const accessToken = longLived?.accessToken ?? account.access_token;
  const expiresAt = longLived ? longLived.expiresAt : account.expires_at;
  log('info', 'login', longLived ? 'Token de Meta canjeado por uno de larga duración' : 'Se sigue con el token corto de Meta', {
    email,
    isLongLived: Boolean(longLived),
    expiresAt: toIso(expiresAt),
  });

  // Meta permite desmarcar permisos en el diálogo: sin ads_read/ads_management
  // el token no sirve para la API de marketing.
  const permissions = await getPermissions(accessToken);
  const flags = permissionFlags(permissions);
  log('info', 'login', 'Permisos de Meta concedidos', { email, ...flags });
  if (permissions && !META_ADS_PERMISSIONS.every((p) => permissions.granted.includes(p))) {
    log('warn', 'login', 'El usuario no concedió todos los permisos de Meta', { email, ...flags });
  }

  token.metaAccessToken = accessToken;
  token.metaExpiresAt = expiresAt; // segundos epoch
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: requiredEnv('GOOGLE_ADS_CLIENT_ID', 'login'),
      clientSecret: requiredEnv('GOOGLE_ADS_CLIENT_SECRET', 'login'),
      authorization: {
        params: {
          scope: `openid email profile ${ADWORDS_SCOPE}`,
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
    FacebookProvider({
      clientId: requiredEnv('META_APP_ID', 'login'),
      clientSecret: requiredEnv('META_APP_SECRET', 'login'),
      authorization: {
        url: `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`,
        params: {
          // Con "Inicio de sesión con Facebook para empresas" los permisos los define la
          // configuración. scope se envía igual porque openid-client pone "openid" si falta.
          config_id: requiredEnv('META_LOGIN_CONFIG_ID', 'login'),
          scope: META_ADS_PERMISSIONS.join(' '),
        },
      },
      token: `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
      userinfo: {
        url: `https://graph.facebook.com/${META_GRAPH_VERSION}/me`,
        params: { fields: 'id,name,email,picture' },
      },
    }),
  ],
  // Los errores de login vuelven al inicio (?error=Código) para mostrarlos en español
  // en vez de la página genérica de next-auth.
  pages: { signIn: '/', error: '/' },
  callbacks: {
    async jwt({ token, account }) {
      // Los tokens quedan sólo en el JWT cifrado (cookie httpOnly);
      // no se copian a la sesión para que nunca lleguen al navegador.
      if (account?.provider === 'facebook') {
        await handleMetaTokens(token, account);
      }
      if (account?.provider === 'google') {
        // Google permite desmarcar permisos en la pantalla de consentimiento: si el
        // usuario no marca Google Ads, el token no sirve para la API.
        const grantedScopes = account.scope?.split(' ') ?? [];
        log('info', 'login', 'Tokens de Google recibidos', {
          email: maskEmail(token.email),
          provider: account.provider,
          hasAdwordsScope: grantedScopes.includes(ADWORDS_SCOPE),
          hasAccessToken: Boolean(account.access_token),
          hasRefreshToken: Boolean(account.refresh_token),
          expiresAt: account.expires_at ? new Date(account.expires_at * 1000).toISOString() : undefined,
        });
        if (!grantedScopes.includes(ADWORDS_SCOPE)) {
          log('warn', 'login', 'El usuario no concedió el permiso de Google Ads', { email: maskEmail(token.email) });
        }
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at; // segundos epoch
      }
      return token;
    },
    async session({ session, token }) {
      session.hasGoogleAds = Boolean(token.refreshToken);
      session.hasMetaAds = Boolean(token.metaAccessToken);
      return session;
    },
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      log('info', 'login', 'Inicio de sesión', { userId: user.id, email: maskEmail(user.email), provider: account?.provider, isNewUser });
      // En Meta, user.id es el ID del usuario para esta app (el mismo `token.sub` de las demás rutas).
      if (account?.provider === 'facebook') {
        try {
          // Corre dentro de /api/auth/callback/facebook: el user agent es el del navegador que volvió.
          const device = deviceFrom((await headers()).get('user-agent') ?? '');
          recordEvent({ userId: user.id, email: user.email, firstDevice: device.device, type: 'login', data: device });
        } catch (error) {
          reportError('db', 'No se pudo registrar el login', error);
        }
      }
    },
    async signOut({ token }) {
      log('info', 'login', 'Cierre de sesión', { userId: token?.sub, email: maskEmail(token?.email) });
    },
  },
  logger: {
    error(code, metadata) {
      // next-auth a veces pasa el Error directo y otras { error, message, providerId }:
      // se conserva siempre el error original para no perder mensaje ni stack.
      const original = metadata instanceof Error ? metadata : metadata?.error;
      const error = original instanceof Error ? original : new Error(`next-auth ${code}: ${original?.message ?? metadata?.message ?? 'sin detalle'}`);
      log('error', 'login', `next-auth: ${code}`, {
        code,
        error: error.message,
        errorName: error.name,
        providerId: metadata?.providerId,
      });
      Sentry.captureException(error, { tags: { flow: 'login', nextauth: code, provider: metadata?.providerId } });
    },
    warn(code) {
      log('warn', 'login', `next-auth: ${code}`, { code });
    },
    debug() {},
  },
  secret: requiredEnv('NEXTAUTH_SECRET', 'login'),
};
