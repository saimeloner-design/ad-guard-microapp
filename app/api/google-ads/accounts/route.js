import { errorResponse, getAccessToken, listAccounts } from '@/lib/google-ads';
import { flushLogsAfterResponse } from '@/lib/log';

export async function GET(request) {
  flushLogsAfterResponse();
  try {
    const accessToken = await getAccessToken(request);
    return Response.json(await listAccounts(accessToken));
  } catch (error) {
    return errorResponse(error);
  }
}
