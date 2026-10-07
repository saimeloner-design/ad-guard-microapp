import { NextResponse } from 'next/server';

export async function GET() {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const refreshToken = process.env.REFRESH_TOKEN;
  const customerId = process.env.CUSTOMER_ID;

  // Si faltan credenciales, devolvemos un mensaje claro en lugar de fallar silenciosamente
  if (!developerToken || !clientId || !clientSecret || !customerId) {
    return NextResponse.json(
      { error: 'Faltan variables de entorno de Google Ads en Vercel/env' },
      { status: 400 }
    );
  }

  try {
    // 1. Obtener un Access Token fresco usando el Refresh Token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return NextResponse.json({ error: 'Error al obtener Access Token', details: tokenData }, { status: 400 });
    }

    const accessToken = tokenData.access_token;
    const cleanCustomerId = customerId.replace(/-/g, ''); // Remover guiones si los tiene

    // 2. Consultar las campañas activas y pausadas mediante Google Ads Query Language (GAQL)
    const query = `
      SELECT 
        campaign.id, 
        campaign.name, 
        campaign.status, 
        metrics.cost_micros, 
        metrics.clicks, 
        metrics.ctr, 
        metrics.impressions 
      FROM campaign 
      WHERE campaign.status IN ('ENABLED', 'PAUSED')
    `;

    const searchResponse = await fetch(
      `https://googleads.googleapis.com/v17/customers/${cleanCustomerId}/googleAds:search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      }
    );

    const searchData = await searchResponse.json();

    if (!searchResponse.ok) {
      return NextResponse.json({ error: 'Error en consulta GAQL a Google Ads', details: searchData }, { status: 400 });
    }

    // 3. Mapear y formatear la respuesta para el dashboard
    const formattedCampaigns = (searchData.results || []).map((row) => {
      const spent = Math.round((parseInt(row.metrics?.costMicros || 0, 10)) / 1000000);
      const clicks = parseInt(row.metrics?.clicks || 0, 10);
      const ctr = parseFloat(((row.metrics?.ctr || 0) * 100).toFixed(2));
      const impressions = parseInt(row.metrics?.impressions || 0, 10);

      // Evaluación de alertas
      let alert = null;
      if (row.campaign.status === 'ENABLED') {
        if (impressions > 1000 && ctr < 1) {
          alert = 'low_ctr';
        } else if (spent > 20000 && clicks < 5) {
          alert = 'high_cost_low_clicks';
        }
      }

      return {
        id: row.campaign.id,
        name: row.campaign.name,
        platform: 'google',
        status: row.campaign.status === 'ENABLED' ? 'active' : 'paused',
        spent,
        clicks,
        ctr,
        alert,
      };
    });

    return NextResponse.json({ campaigns: formattedCampaigns });
  } catch (error) {
    return NextResponse.json({ error: 'Error de servidor', message: error.message }, { status: 500 });
  }
}