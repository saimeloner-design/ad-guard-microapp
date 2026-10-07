'use client';

import React, { useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

export default function Home() {
  const { data: session, status } = useSession();
  const [activePlatform, setActivePlatform] = useState('all');

  const campaigns = [
    { id: '1', name: 'Google Search - Búsqueda Principal', platform: 'google', status: 'active', spent: 45000, clicks: 340, ctr: 8.09, alert: null },
    { id: '2', name: 'Google Display - Remarketing', platform: 'google', status: 'active', spent: 28000, clicks: 12, ctr: 0.07, alert: 'low_ctr' },
    { id: '3', name: 'Meta Ads - Instagram Feed & Stories', platform: 'meta', status: 'active', spent: 35000, clicks: 8, ctr: 0.89, alert: 'high_cost_low_clicks' },
    { id: '4', name: 'Meta Ads - Retargeting Carrito', platform: 'meta', status: 'paused', spent: 12000, clicks: 95, ctr: 7.91, alert: null }
  ];

  if (status === 'loading') {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <p className="text-xs text-slate-400">Cargando sesión...</p>
      </main>
    );
  }

  // Si no hay sesión iniciada, mostrar la pantalla de inicio de sesión Plug-n-Play
  if (!session) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col justify-center items-center max-w-md mx-auto text-center font-sans">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-500 to-emerald-400 mb-4 flex items-center justify-center text-xl font-bold">
          🛡️
        </div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent mb-2">
          AdGuard Micro
        </h1>
        <p className="text-xs text-slate-400 mb-8">
          Conecta tus plataformas publicitarias con un solo clic para monitorear y pausar campañas en tiempo real.
        </p>

        <div className="w-full space-y-3">
          <button
            onClick={() => signIn('google')}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
          >
            <span>Conectar con Google Ads</span>
          </button>

          <button
            onClick={() => signIn('facebook')}
            className="w-full py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-600/20"
          >
            <span>Conectar con Meta Ads</span>
          </button>
        </div>
      </main>
    );
  }

  // Cuando el cliente ya está autenticado, mostramos el dashboard principal
  const filteredCampaigns = activePlatform === 'all' 
    ? campaigns 
    : campaigns.filter(c => c.platform === activePlatform);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 font-sans max-w-2xl mx-auto">
      <header className="flex justify-between items-center py-4 border-b border-slate-800 mb-6">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            AdGuard Micro
          </h1>
          <p className="text-xs text-slate-400">Conectado como: {session.user?.email}</p>
        </div>
        <button
          onClick={() => signOut()}
          className="text-xs text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg"
        >
          Salir
        </button>
      </header>

      {/* Pestañas de plataformas */}
      <div className="flex gap-2 p-1 bg-slate-900 rounded-xl border border-slate-800 mb-6">
        <button 
          onClick={() => setActivePlatform('all')}
          className={`px-4 py-2 rounded-lg text-xs font-medium ${activePlatform === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
        >
          Todos
        </button>
        <button 
          onClick={() => setActivePlatform('google')}
          className={`px-4 py-2 rounded-lg text-xs font-medium ${activePlatform === 'google' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400'}`}
        >
          Google Ads
        </button>
        <button 
          onClick={() => setActivePlatform('meta')}
          className={`px-4 py-2 rounded-lg text-xs font-medium ${activePlatform === 'meta' ? 'bg-cyan-600/20 text-cyan-400' : 'text-slate-400'}`}
        >
          Meta Ads
        </button>
      </div>

      {/* Lista de campañas */}
      <div className="space-y-3">
        {filteredCampaigns.map((c) => (
          <div key={c.id} className="p-4 rounded-xl border bg-slate-900 border-slate-800 flex justify-between items-center">
            <div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 mr-2">
                {c.platform}
              </span>
              <strong className="text-sm">{c.name}</strong>
            </div>
            <div className="text-xs text-slate-400">
              Gasto: ${c.spent.toLocaleString('es-CL')}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}