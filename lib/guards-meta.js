// Guardias (docs/SPEC.md §4e): reglas automáticas que AdsGuard crea en la cuenta de
// Meta. Las revisa Meta cada 30 minutos, aunque el usuario no abra la app.
// Funciones puras: arman la regla y reconocen las que ya existen por su nombre.
// https://developers.facebook.com/docs/marketing-api/ad-rules

// Meta expresa los montos en la unidad mínima de la moneda (centavos), salvo en
// monedas sin decimales. https://developers.facebook.com/docs/marketing-api/currencies
export const NO_DECIMAL_CURRENCIES = new Set(['CLP', 'COP', 'CRC', 'HUF', 'ISK', 'IDR', 'JPY', 'KRW', 'PYG', 'TWD', 'VND']);
const factor = (currency) => (NO_DECIMAL_CURRENCIES.has(currency) ? 1 : 100);
export const toMetaAmount = (amount, currency) => Math.round(amount * factor(currency));
export const fromMetaAmount = (value, currency) => (value ? Number(value) / factor(currency) : 0);

const SALES_OBJECTIVES = ['OUTCOME_SALES', 'CONVERSIONS', 'PRODUCT_CATALOG_SALES'];

// `amount`: gasto en 7 días sin resultados. `profit`: lo que el usuario gana por venta.
export const GUARDS = {
  noResults: {
    ruleName: 'AdsGuard · Pausar campañas que gastan sin resultados',
    needs: 'amount',
    filters: ({ amount }, currency) => [
      { field: 'entity_type', value: 'CAMPAIGN', operator: 'EQUAL' },
      { field: 'time_preset', value: 'LAST_7D', operator: 'EQUAL' },
      { field: 'spent', value: toMetaAmount(amount, currency), operator: 'GREATER_THAN' },
      { field: 'results', value: 0, operator: 'EQUAL' },
    ],
  },
  loss: {
    ruleName: 'AdsGuard · Pausar ventas que cuestan más de lo que ganas',
    needs: 'profit',
    // Se exige un gasto de al menos 3 ventas para no pausar por una venta cara aislada.
    filters: ({ profit }, currency) => [
      { field: 'entity_type', value: 'CAMPAIGN', operator: 'EQUAL' },
      { field: 'time_preset', value: 'LAST_7D', operator: 'EQUAL' },
      { field: 'objective', value: SALES_OBJECTIVES, operator: 'IN' },
      { field: 'spent', value: toMetaAmount(3 * profit, currency), operator: 'GREATER_THAN' },
      { field: 'cost_per_purchase_fb', value: toMetaAmount(profit, currency), operator: 'GREATER_THAN' },
    ],
  },
  adNoResults: {
    ruleName: 'AdsGuard · Pausar anuncios que gastan sin resultados',
    needs: 'amount',
    filters: ({ amount }, currency) => [
      { field: 'entity_type', value: 'AD', operator: 'EQUAL' },
      { field: 'time_preset', value: 'LAST_7D', operator: 'EQUAL' },
      { field: 'spent', value: toMetaAmount(amount, currency), operator: 'GREATER_THAN' },
      { field: 'results', value: 0, operator: 'EQUAL' },
    ],
  },
};

/** Parámetros de la Graph API para crear la regla (POST /act_{id}/adrules_library). */
export function guardRuleParams(key, values, currency) {
  const guard = GUARDS[key];
  return {
    name: guard.ruleName,
    evaluation_spec: JSON.stringify({ evaluation_type: 'SCHEDULE', filters: guard.filters(values, currency) }),
    execution_spec: JSON.stringify({ execution_type: 'PAUSE' }),
    schedule_spec: JSON.stringify({ schedule_type: 'SEMI_HOURLY' }),
  };
}

/**
 * Estado de cada guardia a partir de las reglas de la cuenta. Sólo cuentan las
 * creadas por AdsGuard (por su nombre) y activas.
 * @returns {Object<string, {active: boolean, ruleIds: string[], amount?: number, profit?: number}>}
 */
export function guardsFromRules(rules = [], currency) {
  const out = {};
  for (const [key, guard] of Object.entries(GUARDS)) {
    const own = rules.filter((r) => r.name === guard.ruleName && r.status !== 'DELETED');
    const enabled = own.filter((r) => r.status === 'ENABLED');
    const filters = enabled[0]?.evaluation_spec?.filters ?? [];
    const value = (field) => filters.find((f) => f.field === field)?.value;
    out[key] = {
      active: enabled.length > 0,
      ruleIds: own.map((r) => r.id),
      ...(key === 'loss' ? { profit: fromMetaAmount(value('cost_per_purchase_fb'), currency) || undefined } : { amount: fromMetaAmount(value('spent'), currency) || undefined }),
    };
  }
  return out;
}

/** Monto redondo para sugerir: 1, 2 o 5 por una potencia de 10 (p. ej. 18.300 → 20.000). */
export function roundAmount(v) {
  if (!(v > 0)) return 0;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 5, 10].map((m) => m * p).find((x) => x >= v);
}
