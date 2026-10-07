import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.CLIENT_ID || '',
      clientSecret: process.env.CLIENT_SECRET || '',
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/adwords',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
    FacebookProvider({
      clientId: process.env.META_CLIENT_ID || '',
      clientSecret: process.env.META_CLIENT_SECRET || '',
      authorization: {
        params: {
          scope: 'email,public_profile,ads_management,ads_read',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Guardar los tokens de acceso de Google/Meta en la sesión del usuario
      if (account) {
        token.accessToken = account.access_token;
        token.provider = account.provider;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.provider = token.provider;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || 'super-secret-key-adguard',
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };