// Datos de ejemplo de Meta Ads (últimos 30 días) para el modo demo. Pasan por el
// mismo motor de alertas que los datos reales (lib/alerts-meta.js) y muestran un
// caso de cada tipo: mensajes sin conversaciones, ventas que no recuperan lo
// invertido, anuncio desgastado, anuncio rechazado, campaña aprendiendo y una sana.
// También cubren el diagnóstico (lib/diagnosis-meta.js): un caso por paso del
// recorrido y un anuncio que conviene pausar solo.
export const DEMO_ACCOUNT = { id: 'demo', name: 'Tienda Demo', currency: 'CLP' };

const campaign = (fields) => ({
  status: 'active',
  delivering: true,
  landingPageViews: 0,
  purchaseValue: 0,
  learningStatus: null,
  rejectedAds: [],
  ...fields,
});

export const DEMO_CAMPAIGNS = [
  campaign({
    id: '1',
    name: 'WhatsApp - Consultas',
    objective: 'OUTCOME_ENGAGEMENT',
    resultType: 'message',
    cost: 42000,
    impressions: 18500,
    reach: 9200,
    frequency: 2,
    linkClicks: 12,
    results: 0,
  }),
  campaign({
    id: '2',
    name: 'Mensajes - Promo octubre',
    objective: 'OUTCOME_ENGAGEMENT',
    resultType: 'message',
    cost: 36000,
    impressions: 22000,
    reach: 11800,
    frequency: 1.9,
    linkClicks: 40,
    results: 30,
  }),
  campaign({
    id: '3',
    name: 'Ventas - Catálogo tienda',
    objective: 'OUTCOME_SALES',
    resultType: 'purchase',
    cost: 85000,
    impressions: 41000,
    reach: 15200,
    frequency: 2.7,
    linkClicks: 520,
    landingPageViews: 410,
    results: 7,
    purchaseValue: 51000,
    parts: {
      ad: [
        { campaignId: '3', id: '31', name: 'Carrusel productos', active: true, cost: 60000, results: 7 },
        { campaignId: '3', id: '32', name: 'Foto vitrina', active: true, cost: 25000, results: 0 },
      ],
      adset: [],
    },
  }),
  campaign({
    id: '4',
    name: 'Tráfico - Blog de recetas',
    objective: 'OUTCOME_TRAFFIC',
    resultType: 'traffic',
    cost: 28000,
    impressions: 30000,
    reach: 7400,
    frequency: 4.1,
    linkClicks: 450,
    landingPageViews: 300,
    results: 450,
    last7: { impressions: 9000, linkClicks: 45, frequency: 3.6 },
  }),
  campaign({
    id: '5',
    name: 'Clientes potenciales - Formulario',
    objective: 'OUTCOME_LEADS',
    resultType: 'lead',
    cost: 19000,
    impressions: 12000,
    reach: 6100,
    frequency: 2,
    linkClicks: 150,
    landingPageViews: 60,
    results: 9,
    rejectedAds: ['Video testimonio'],
  }),
  campaign({
    id: '6',
    name: 'Ventas - Nueva colección',
    objective: 'OUTCOME_SALES',
    resultType: 'purchase',
    cost: 6000,
    impressions: 2500,
    reach: 2100,
    frequency: 1.2,
    linkClicks: 25,
    results: 1,
    purchaseValue: 18000,
    learningStatus: 'LEARNING',
  }),
  campaign({
    id: '7',
    name: 'Reconocimiento - Marca',
    status: 'paused',
    delivering: undefined,
    objective: 'OUTCOME_AWARENESS',
    resultType: 'reach',
    cost: 15000,
    impressions: 60000,
    reach: 32000,
    frequency: 1.9,
    linkClicks: 90,
    results: 32000,
  }),
];

export const DEMO_CONTEXT = {
  accountStatus: 1,
  reach: 48000,
  history: DEMO_CAMPAIGNS.map((c) => ({ campaignId: c.id, resultType: c.resultType, cost: c.cost, results: c.results })),
};
