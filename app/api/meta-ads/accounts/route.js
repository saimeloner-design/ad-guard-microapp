import { flushLogsAfterResponse } from '@/lib/log';
import { getMetaAccessToken, listAdAccounts, metaErrorResponse } from '@/lib/meta-ads';

export async function GET(request) {
  flushLogsAfterResponse();
  try {
    const accessToken = await getMetaAccessToken(request);
    return Response.json(await listAdAccounts(accessToken));
  } catch (error) {
    return metaErrorResponse(error);
  }
}
