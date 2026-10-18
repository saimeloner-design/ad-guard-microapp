import { flushLogsAfterResponse } from '@/lib/log';
import { getMetaAccessToken, listAdAccounts, logAccountOwners, metaErrorResponse } from '@/lib/meta-ads';
import { runInShadow } from '@/lib/shadow';

export async function GET(request) {
  flushLogsAfterResponse();
  try {
    const accessToken = await getMetaAccessToken(request);
    const { allAccountIds, ...result } = await listAdAccounts(accessToken);
    // Diagnóstico temporal: si cada cuenta es personal o de un negocio.
    runInShadow('meta-owners', () => logAccountOwners(accessToken, allAccountIds));
    return Response.json(result);
  } catch (error) {
    return metaErrorResponse(error);
  }
}
