import { evaluateAccount } from '@/lib/alerts';
import { flushLogsAfterResponse } from '@/lib/log';
import { cleanAdAccountId, getMetaAccessToken, getMetaCampaigns, metaErrorResponse } from '@/lib/meta-ads';

export async function GET(request) {
  flushLogsAfterResponse();
  try {
    const accountId = cleanAdAccountId(request.nextUrl.searchParams.get('accountId'));
    const accessToken = await getMetaAccessToken(request);
    const { account, campaigns } = await getMetaCampaigns(accessToken, accountId);
    const result = evaluateAccount(campaigns, { currency: account.currency, platform: 'Meta' });
    return Response.json({ account, ...result });
  } catch (error) {
    return metaErrorResponse(error);
  }
}
