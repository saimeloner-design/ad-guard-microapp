import { recordEvent } from '@/lib/events';
import { flushLogsAfterResponse, log } from '@/lib/log';
import {
  cleanAdAccountId,
  disableMetaGuard,
  enableMetaGuard,
  getMetaSession,
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

const EVENT_TYPES = {
  'guard-on': 'guard_create',
  'guard-off': 'guard_remove',
  'cap-set': 'spend_cap_set',
  'cap-reset': 'spend_cap_reset',
  'cap-delete': 'spend_cap_remove',
};

export async function POST(request) {
  flushLogsAfterResponse();
  try {
    const body = await request.json().catch(() => ({}));
    const accountId = cleanAdAccountId(body.accountId);
    const currency = String(body.currency || 'CLP');
    const { accessToken, userId } = await getMetaSession(request);
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
    recordEvent({
      userId,
      accountId,
      type: EVENT_TYPES[body.action],
      data: {
        ...(body.key && { key: String(body.key).slice(0, 40) }),
        ...(number(body.amount) && { amount: number(body.amount) }),
        currency,
      },
    });
    return Response.json(await getMetaProtection(accessToken, accountId));
  } catch (error) {
    return metaErrorResponse(error);
  }
}
