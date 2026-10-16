import { cleanCustomerId, cleanOptionalCustomerId, errorResponse, GoogleAdsError, getAccessToken, setCampaignStatus } from '@/lib/google-ads';

const ALLOWED_STATUS = new Set(['PAUSED', 'ENABLED']);

export async function POST(request, ctx) {
  try {
    const { campaignId } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const customerId = cleanCustomerId(body.customerId);
    const loginCustomerId = cleanOptionalCustomerId(body.loginCustomerId);

    if (!/^\d+$/.test(campaignId) || !ALLOWED_STATUS.has(body.status)) {
      throw new GoogleAdsError('Solicitud inválida.', { status: 400 });
    }

    const accessToken = await getAccessToken(request);
    await setCampaignStatus(accessToken, customerId, campaignId, body.status, loginCustomerId);
    return Response.json({ ok: true, status: body.status === 'ENABLED' ? 'active' : 'paused' });
  } catch (error) {
    return errorResponse(error);
  }
}
