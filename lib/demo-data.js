// Datos de ejemplo (últimos 30 días) para el modo demo. Pasan por el mismo
// motor de alertas que los datos reales.
export const DEMO_ACCOUNT = { id: 'demo', name: 'Tienda Demo', currency: 'CLP' };

export const DEMO_CAMPAIGNS = [
  { id: '1', name: 'Búsqueda - Productos principales', status: 'active', channel: 'SEARCH', cost: 45000, clicks: 340, impressions: 4200, conversions: 12 },
  { id: '2', name: 'Display - Remarketing', status: 'active', channel: 'DISPLAY', cost: 28000, clicks: 3, impressions: 9000, conversions: 0 },
  { id: '3', name: 'Búsqueda - Marcas competidoras', status: 'active', channel: 'SEARCH', cost: 35000, clicks: 60, impressions: 2500, conversions: 0 },
  { id: '4', name: 'Shopping - Catálogo', status: 'paused', channel: 'SHOPPING', cost: 12000, clicks: 95, impressions: 5000, conversions: 6 },
  { id: '5', name: 'Búsqueda - Promo verano', status: 'active', channel: 'SEARCH', cost: 3000, clicks: 8, impressions: 300, conversions: 0 },
];
