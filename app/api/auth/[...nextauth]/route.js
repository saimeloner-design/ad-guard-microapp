import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { flushLogsAfterResponse } from '@/lib/log';

const nextAuthHandler = NextAuth(authOptions);

function handler(request, ctx) {
  flushLogsAfterResponse();
  return nextAuthHandler(request, ctx);
}

export { handler as GET, handler as POST };
