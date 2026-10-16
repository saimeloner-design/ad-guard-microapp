import { errorResponse, getAccessToken, listAccounts } from '@/lib/google-ads';

export async function GET(request) {
  try {
    const accessToken = await getAccessToken(request);
    return Response.json(await listAccounts(accessToken));
  } catch (error) {
    return errorResponse(error);
  }
}
