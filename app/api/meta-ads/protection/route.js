import { flushLogsAfterResponse, log } from '@/lib/log';
import {
  cleanAdAccountId,
  disableMetaGuard,
  enableMetaGuard,
  getMetaAccessToken,
  getMetaProtection,
  MetaApiError,
  metaErrorResponse,
  setMetaSpendCap,
} from '@/lib/meta-ads';

// Protección (docs/SPEC.md §4e): guardias automáticas y tope de gasto de la cuenta.
// Body: { accountId, currency, action, ... }
//   guard-on  { key, amount?, profit? }   guard-off { key }
//   cap-set   { amount }                  cap-reset, cap-delete
// Devuelve el estado actualizado, leído de nuevo desde Meta.
export async function POST(request) {
  flushLogsAfterResponse();
  try {
    const body = await request.json().catch(() => ({}));
    const accountId = cleanAdAccountId(body.accountId);
    const currency = String(body.currency || 'CLP');
    const accessToken = await getMetaAccessToken(request);
    const number = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : undefined);

    switch (body.action) {
      case 'guard-on':
        await enableMetaGuard(accessToken, accountId, body.key, { amount: number(body.amount), profit: number(body.profit) }, currency);
        break;
      case 'guard-off':
        await disableMetaGuard(accessToken, accountId, body.key);
        break;
      case 'cap-set':
        await setMetaSpendCap(accessToken, accountId, { action: 'set', amount: number(body.amount) }, currency);
        break;
      case 'cap-reset':
      case 'cap-delete':
        await setMetaSpendCap(accessToken, accountId, { action: body.action.slice(4) }, currency);
        break;
      default:
        throw new MetaApiError('acción inválida', { status: 400, code: 'BAD_REQUEST' });
    }
    log('info', 'meta-ads', `Protección: ${body.action}`, { accountId, action: body.action, key: body.key });
    return Response.json(await getMetaProtection(accessToken, accountId));
  } catch (error) {
    return metaErrorResponse(error);
  }
}
