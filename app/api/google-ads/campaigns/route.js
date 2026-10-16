import { evaluateAccount } from '@/lib/alerts';
import { cleanCustomerId, cleanOptionalCustomerId, errorResponse, getAccessToken, getCampaigns } from '@/lib/google-ads';

export async function GET(request) {
  try {
    const params = request.nextUrl.searchParams;
    const customerId = cleanCustomerId(params.get('customerId'));
    const loginCustomerId = cleanOptionalCustomerId(params.get('loginCustomerId'));
    const accessToken = await getAccessToken(request);
    const { account, campaigns } = await getCampaigns(accessToken, customerId, loginCustomerId);
    const result = evaluateAccount(campaigns, { currency: account.currency });
    return Response.json({ account, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
