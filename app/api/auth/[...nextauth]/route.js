import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { flushLogsAfterResponse } from '@/lib/log';
import { trackLogin } from '@/lib/login-tracking';

const nextAuthHandler = NextAuth(authOptions);

function handler(request, ctx) {
  flushLogsAfterResponse();
  return trackLogin(request, () => nextAuthHandler(request, ctx));
}

export { handler as GET, handler as POST };
