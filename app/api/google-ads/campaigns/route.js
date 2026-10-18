import { evaluateAccount } from '@/lib/alerts';
import { logCalibration } from '@/lib/calibration';
import { cleanCustomerId, cleanOptionalCustomerId, errorResponse, getAccessToken, getBreakdown, getCampaigns } from '@/lib/google-ads';
import { flushLogsAfterResponse } from '@/lib/log';
import { logWasteConcentration, runInShadow } from '@/lib/shadow';

export async function GET(request) {
  flushLogsAfterResponse();
  try {
    const params = request.nextUrl.searchParams;
    const customerId = cleanCustomerId(params.get('customerId'));
    const loginCustomerId = cleanOptionalCustomerId(params.get('loginCustomerId'));
    const accessToken = await getAccessToken(request);
    const { account, campaigns } = await getCampaigns(accessToken, customerId, loginCustomerId);
    const result = evaluateAccount(campaigns, { currency: account.currency });

    logCalibration('google', account, result);
    runInShadow('google', async () => {
      const levels = await getBreakdown(accessToken, customerId, loginCustomerId);
      for (const [level, children] of Object.entries(levels)) {
        logWasteConcentration({
          platform: 'google',
          level,
          accountId: customerId,
          evaluation: result,
          children,
          isMeasured: () => result.summary.measuring,
        });
      }
    });

    return Response.json({ account, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
