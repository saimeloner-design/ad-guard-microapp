'use client';

import { useState } from 'react';
import { formatMoney, SEVERITY } from '@/lib/alerts';

const CHANNEL_LABELS = {
  SEARCH: 'Búsqueda',
  DISPLAY: 'Display',
  SHOPPING: 'Shopping',
  VIDEO: 'YouTube',
  PERFORMANCE_MAX: 'Máximo rendimiento',
  DEMAND_GEN: 'Demand Gen',
  SMART: 'Inteligente',
  LOCAL: 'Local',
};

function StatCard({ label, value, tone = 'default' }) {
  const toneClass = { default: 'text-slate-100', warn: 'text-amber-400', good: 'text-emerald-400' }[tone];
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
      <span className="text-xs text-slate-400">{label}</span>
      <div className={`text-lg font-bold mt-0.5 ${toneClass}`}>{value}</div>
    </div>
  );
}

function AlertBox({ alert }) {
  const isPause = alert.severity === SEVERITY.PAUSE;
  return (
    <div
      className={`text-xs px-2.5 py-2 rounded-lg border ${
        isPause ? 'text-red-300 bg-red-500/10 border-red-500/25' : 'text-amber-300 bg-amber-500/10 border-amber-500/20'
      }`}
    >
      <div className="font-semibold">
        {isPause ? '⛔ Te recomendamos pausar: ' : '⚠️ Revisa: '}
        {alert.title}
      </div>
      <div className="mt-0.5 opacity-90">{alert.message}</div>
    </div>
  );
}

function CampaignCard({ campaign: c, currency, onToggle, busy }) {
  const isPaused = c.status === 'paused';
  const shouldPause = c.alerts.some((a) => a.severity === SEVERITY.PAUSE);
  const money = (v) => formatMoney(v, currency);

  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        isPaused
          ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
          : shouldPause
            ? 'bg-slate-900 border-red-500/40'
            : c.alerts.length
              ? 'bg-slate-900 border-amber-500/40'
              : 'bg-slate-900 border-slate-800'
      }`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {CHANNEL_LABELS[c.channel] || 'Google'}
            </span>
            <h3 className="text-sm font-semibold text-slate-100 mt-1.5 break-words">{c.name}</h3>
          </div>
          <button
            onClick={() => onToggle(c)}
            disabled={busy}
            className={`shrink-0 px-3 py-1 rounded-lg text-xs font-medium border transition-all disabled:opacity-50 ${
              isPaused
                ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                : shouldPause
                  ? 'bg-red-500/15 text-red-300 border-red-500/40 hover:bg-red-500/25'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
            }`}
          >
            {busy ? '...' : isPaused ? 'Activar' : 'Pausar'}
          </button>
        </div>

        {/* Si hay que pausar, basta con ese motivo; las demás alertas sólo agregan ruido. */}
        {!isPaused &&
          c.alerts
            .filter((a) => !shouldPause || a.severity === SEVERITY.PAUSE)
            .map((a) => <AlertBox key={a.rule} alert={a} />)}

        {!isPaused && c.learning && (
          <div className="text-xs text-slate-400 bg-slate-800/50 border border-slate-700/60 px-2.5 py-1.5 rounded-lg">
            🌱 Aprendiendo: aún no hay suficientes datos para evaluarla.
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 text-xs border-t border-slate-800/60 pt-2 text-slate-400">
          <div>
            Gasto
            <strong className="block text-slate-200">{money(c.cost)}</strong>
          </div>
          <div>
            Clics
            <strong className="block text-slate-200">{c.clicks.toLocaleString('es-CL')}</strong>
          </div>
          <div>
            Resultados
            <strong className="block text-slate-200">{Math.round(c.conversions * 10) / 10}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({ campaign, currency, onConfirm, onCancel }) {
  const pausing = campaign.status === 'active';
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 className="text-base font-semibold">{pausing ? '¿Pausar esta campaña?' : '¿Volver a activar esta campaña?'}</h2>
        <p className="text-sm text-slate-300 mt-2">
          <strong>{campaign.name}</strong>
        </p>
        <p className="text-xs text-slate-400 mt-2">
          {pausing
            ? `Dejará de mostrarse y de gastar inmediatamente. En los últimos 30 días gastó ${formatMoney(campaign.cost, currency)}. Puedes reactivarla cuando quieras.`
            : 'Volverá a mostrarse y a gastar según su presupuesto diario.'}
        </p>
        <div className="flex gap-2 mt-5">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg text-sm border border-slate-700 text-slate-300 hover:bg-slate-800">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${
              pausing ? 'bg-red-500/90 hover:bg-red-500 text-white' : 'bg-emerald-500/90 hover:bg-emerald-500 text-slate-950'
            }`}
          >
            {pausing ? 'Sí, pausar' : 'Sí, activar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Panel con resumen, alertas de cuenta y campañas.
 * `onSetStatus(campaign, 'PAUSED' | 'ENABLED')` debe devolver una promesa.
 */
function EmptyState({ title, children, onChangeAccount }) {
  return (
    <div className="text-center py-10 px-4 bg-slate-900/50 border border-slate-800 rounded-xl">
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      <p className="text-xs text-slate-400 mt-2">{children}</p>
      {onChangeAccount && (
        <button
          onClick={onChangeAccount}
          className="mt-4 px-4 py-2 rounded-lg text-xs bg-slate-800 border border-slate-700 hover:bg-slate-700"
        >
          Revisar otra cuenta
        </button>
      )}
    </div>
  );
}

export function Dashboard({ account, evaluation, onSetStatus, onChangeAccount }) {
  const [pending, setPending] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const { summary, campaigns, accountAlerts } = evaluation;
  const money = (v) => formatMoney(v, account.currency);

  const confirm = async () => {
    const c = pending;
    setPending(null);
    setBusyId(c.id);
    setError(null);
    try {
      await onSetStatus(c, c.status === 'active' ? 'PAUSED' : 'ENABLED');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (campaigns.length === 0) {
    return (
      <EmptyState title="Esta cuenta todavía no tiene campañas" onChangeAccount={onChangeAccount}>
        Cuando crees una campaña en Google Ads aparecerá aquí y empezaremos a vigilar su gasto.
        {onChangeAccount && ' Si tus anuncios están en otra de tus cuentas, cámbiate a ella.'}
      </EmptyState>
    );
  }

  return (
    <>
      <p className="text-xs text-slate-400 mb-3">Últimos 30 días</p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard label="Gasto" value={money(summary.totalCost)} />
        <StatCard label="Resultados (ventas/contactos)" value={summary.measuring ? Math.round(summary.totalConversions) : '—'} />
        <StatCard label="Campañas con alertas" value={`${summary.alertCount} / ${summary.activeCount}`} tone={summary.alertCount ? 'warn' : 'default'} />
        <StatCard
          label="Podrías ahorrar al mes"
          value={money(summary.potentialSavings)}
          tone={summary.potentialSavings > 0 ? 'good' : 'default'}
        />
      </div>

      {accountAlerts.map((a) => (
        <div key={a.rule} className="mb-4">
          <AlertBox alert={a} />
        </div>
      ))}

      {error && <div className="mb-4 text-xs text-red-300 bg-red-500/10 border border-red-500/25 px-3 py-2 rounded-lg">{error}</div>}

      {summary.activeCount === 0 && (
        <div className="mb-4 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5 rounded-lg">
          ✅ No tienes campañas activas, así que hoy no estás gastando dinero. Abajo están tus campañas pausadas con lo que
          gastaron en los últimos 30 días; si reactivas alguna, la vigilaremos por ti.
        </div>
      )}

      <div className="space-y-3">
        {campaigns.map((c) => (
          <CampaignCard key={c.id} campaign={c} currency={account.currency} onToggle={setPending} busy={busyId === c.id} />
        ))}
      </div>

      {pending && <ConfirmDialog campaign={pending} currency={account.currency} onConfirm={confirm} onCancel={() => setPending(null)} />}
    </>
  );
}
