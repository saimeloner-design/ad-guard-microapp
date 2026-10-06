'use client';
import React, { useState } from 'react';

export default function Home() {
  const [campaignActive, setCampaignActive] = useState(true);
  const [dailyBudget, setDailyBudget] = useState(25000);
  const [alertDismissed, setAlertDismissed] = useState(false);

  const spentToday = 18500;
  const cpl = 3700;
  const roas = 3.4;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 font-sans max-w-md mx-auto">
      {/* Header */}
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

      {/* Alerta Inteligente */}
      {!alertDismissed && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6 relative">
          <div className="flex items-start gap-3">
            <span className="text-amber-400 text-xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-amber-300 text-sm">Alerta de Rendimiento</h3>
              <p className="text-xs text-slate-300 mt-1">
                El costo por cliente (CPA) de &quot;Promo_Video_01&quot; subió un 25% en las últimas 3 horas.
              </p>
              <div className="mt-3 flex gap-2">
                <button 
                  onClick={() => setCampaignActive(false)}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-medium text-xs px-3 py-1.5 rounded-lg transition"
                >
                  Pausar Anuncio
                </button>
                <button 
                  onClick={() => setAlertDismissed(true)}
                  className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1.5"
                >
                  Ignorar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Métricas Clave */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs text-slate-400">Gasto Hoy</p>
          <p className="text-xl font-bold text-slate-100 mt-1">
            ${spentToday.toLocaleString('es-CL')}
          </p>
          <span className="text-[10px] text-slate-500">de ${dailyBudget.toLocaleString('es-CL')} límite</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs text-slate-400">Retorno (ROAS)</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">{roas}x</p>
          <span className="text-[10px] text-emerald-500">↑ Rendimiento óptimo</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs text-slate-400">Costo por Lead</p>
          <p className="text-xl font-bold text-slate-100 mt-1">
            ${cpl.toLocaleString('es-CL')}
          </p>
          <span className="text-[10px] text-amber-500">Meta: $3,000</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs text-slate-400">Estado Meta Ads</p>
          <p className={`text-sm font-bold mt-2 ${campaignActive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {campaignActive ? '● Campaña Activa' : '○ Campaña Pausada'}
          </p>
        </div>
      </div>

      {/* Interruptor de Emergencia (Freno de Mano) */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl text-center mb-6">
        <h2 className="font-semibold text-sm mb-1">Control de Emergencia</h2>
        <p className="text-xs text-slate-400 mb-4">
          Detén el gasto publicitario de Meta Ads instantáneamente desde tu teléfono.
        </p>
        <button
          onClick={() => setCampaignActive(!campaignActive)}
          className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all shadow-lg ${
            campaignActive 
              ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-950/50' 
              : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-950/50'
          }`}
        >
          {campaignActive ? '🛑 PAUSAR TODAS LAS CAMPAÑAS' : '▶️ REANUDAR CAMPAÑAS'}
        </button>
      </div>
    </main>
  );
}