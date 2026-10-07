'use client';

import React, { useState } from 'react';

export default function Home() {
  const [activePlatform, setActivePlatform] = useState('all');
  const [campaigns, setCampaigns] = useState([
    { id: '1', name: 'Google Search - Búsqueda Principal', platform: 'google', status: 'active', spent: 45000, clicks: 340, ctr: 8.09, alert: null },
    { id: '2', name: 'Google Display - Remarketing', platform: 'google', status: 'active', spent: 28000, clicks: 12, ctr: 0.07, alert: 'low_ctr' },
    { id: '3', name: 'Meta Ads - Instagram Feed & Stories', platform: 'meta', status: 'active', spent: 35000, clicks: 8, ctr: 0.89, alert: 'high_cost_low_clicks' },
    { id: '4', name: 'Meta Ads - Retargeting Carrito', platform: 'meta', status: 'paused', spent: 12000, clicks: 95, ctr: 7.91, alert: null }
  ]);

  const toggleCampaignStatus = (id) => {
    setCampaigns(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, status: c.status === 'active' ? 'paused' : 'active' };
      }
      return c;
    }));
  };

  const filteredCampaigns = activePlatform === 'all' 
    ? campaigns 
    : campaigns.filter(c => c.platform === activePlatform);

  const totalSpent = filteredCampaigns.reduce((acc, c) => acc + c.spent, 0);
  const totalClicks = filteredCampaigns.reduce((acc, c) => acc + c.clicks, 0);
  const activeCount = filteredCampaigns.filter(c => c.status === 'active').length;
  const alertCount = filteredCampaigns.filter(c => c.alert && c.status === 'active').length;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 font-sans max-w-2xl mx-auto">
      {/* Encabezado */}
      <header className="flex justify-between items-center py-4 border-b border-slate-800 mb-6">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            AdGuard Micro
          </h1>
          <p className="text-xs text-slate-400">Control de Anuncios Express</p>
        </div>
        <span className="flex h-3 w-3 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
        </span>
      </header>

      {/* Pestañas por Plataforma */}
      <div className="flex gap-2 p-1 bg-slate-900 rounded-xl border border-slate-800 mb-6 overflow-x-auto">
        <button 
          onClick={() => setActivePlatform('all')}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            activePlatform === 'all' 
              ? 'bg-slate-800 text-white border border-slate-700' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Todos los canales
        </button>
        <button 
          onClick={() => setActivePlatform('google')}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            activePlatform === 'google' 
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Google Ads
        </button>
        <button 
          onClick={() => setActivePlatform('meta')}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            activePlatform === 'meta' 
              ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Meta Ads
        </button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <span className="text-xs text-slate-400">Gasto Filtrado</span>
          <div className="text-lg font-bold text-slate-100 mt-0.5">${totalSpent.toLocaleString('es-CL')}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <span className="text-xs text-slate-400">Clics Totales</span>
          <div className="text-lg font-bold text-slate-100 mt-0.5">{totalClicks}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <span className="text-xs text-slate-400">Campañas Activas</span>
          <div className="text-lg font-bold text-slate-100 mt-0.5">{activeCount} / {filteredCampaigns.length}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <span className="text-xs text-slate-400">Alertas</span>
          <div className={`text-lg font-bold mt-0.5 ${alertCount > 0 ? 'text-amber-400' : 'text-slate-100'}`}>
            {alertCount}
          </div>
        </div>
      </div>

      {/* Lista de Campañas */}
      <div className="space-y-3">
        {filteredCampaigns.map((c) => {
          const isPaused = c.status === 'paused';

          return (
            <div 
              key={c.id}
              className={`p-4 rounded-xl border transition-all ${
                isPaused 
                  ? 'bg-slate-900/40 border-slate-800/60 opacity-60' 
                  : c.alert 
                  ? 'bg-slate-900 border-amber-500/40' 
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                      c.platform === 'google' 
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                        : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    }`}>
                      {c.platform === 'google' ? 'Google' : 'Meta'}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-100">{c.name}</h3>
                  </div>

                  <button
                    onClick={() => toggleCampaignStatus(c.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                      !isPaused 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' 
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {!isPaused ? 'Pausar' : 'Activar'}
                  </button>
                </div>

                {c.alert && !isPaused && (
                  <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg">
                    ⚠️ {c.alert === 'low_ctr' ? 'Alerta: CTR muy bajo (< 1%). Pocos clics para las impresiones.' : 'Alerta: Alto gasto con muy pocos clics.'}
                  </div>
                )}

                <div className="flex justify-between items-center text-xs border-t border-slate-800/60 pt-2 text-slate-400">
                  <div>Gasto: <strong className="text-slate-200">${c.spent.toLocaleString('es-CL')}</strong></div>
                  <div>Clics: <strong className="text-slate-200">{c.clicks}</strong></div>
                  <div>CTR: <strong className="text-slate-200">{c.ctr}%</strong></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}