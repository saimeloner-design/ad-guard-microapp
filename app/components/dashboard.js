'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatMoney, SEVERITY } from '@/lib/alerts';
import { Alert, Button, Icon, StateCard, Toast } from './ui';

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

const STAT_TONES = {
  default: { value: 'text-slate-900', icon: 'bg-slate-100 text-slate-500' },
  warn: { value: 'text-amber-600', icon: 'bg-amber-50 text-amber-600' },
  good: { value: 'text-emerald-600', icon: 'bg-emerald-50 text-emerald-600' },
};

function StatCard({ label, value, icon, tone = 'default' }) {
  const t = STAT_TONES[tone];
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
      <div className="flex items-center gap-2">
        <span className={`size-7 grid place-items-center rounded-lg ${t.icon}`}>
          <Icon name={icon} className="size-4" />
        </span>
        <span className="text-xs font-medium text-slate-500 leading-tight">{label}</span>
      </div>
      <div className={`text-xl font-semibold mt-2.5 tabular-nums tracking-tight ${t.value}`}>{value}</div>
    </div>
  );
}

function AlertBox({ alert }) {
  const isPause = alert.severity === SEVERITY.PAUSE;
  return (
    <Alert tone={isPause ? 'danger' : 'warning'} title={alert.title}>
      {alert.message}
    </Alert>
  );
}

function StatusPill({ paused }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${
        paused ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'
      }`}
    >
      <span className={`size-1.5 rounded-full ${paused ? 'bg-slate-400' : 'bg-emerald-500'}`} />
      {paused ? 'Pausada' : 'Activa'}
    </span>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-900 tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function CampaignCard({ campaign: c, currency, onToggle, busy }) {
  const isPaused = c.status === 'paused';
  const shouldPause = c.alerts.some((a) => a.severity === SEVERITY.PAUSE);
  const money = (v) => formatMoney(v, currency);

  return (
    <div
      className={`p-4 rounded-2xl border bg-white transition-shadow ${
        isPaused
          ? 'border-slate-200/80 bg-white/60'
          : shouldPause
            ? 'border-red-200 shadow-sm shadow-red-100 ring-1 ring-red-100'
            : c.alerts.length
              ? 'border-amber-200 shadow-sm shadow-amber-100'
              : 'border-slate-200/80 shadow-xs'
      }`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill paused={isPaused} />
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                {CHANNEL_LABELS[c.channel] || 'Google'}
              </span>
            </div>
            <h3 className={`text-[15px] font-semibold mt-2 break-words ${isPaused ? 'text-slate-500' : 'text-slate-900'}`}>{c.name}</h3>
          </div>
          <Button
            size="sm"
            variant={isPaused ? 'secondary' : shouldPause ? 'danger' : 'secondary'}
            icon={isPaused ? 'play' : 'pause'}
            loading={busy}
            onClick={() => onToggle(c)}
            className="shrink-0"
          >
            {isPaused ? 'Activar' : 'Pausar'}
          </Button>
        </div>

        {/* Si hay que pausar, basta con ese motivo; las demás alertas sólo agregan ruido. */}
        {!isPaused &&
          c.alerts
            .filter((a) => !shouldPause || a.severity === SEVERITY.PAUSE)
            .map((a) => <AlertBox key={a.rule} alert={a} />)}

        {!isPaused && c.learning && (
          <Alert tone="neutral" icon="sprout">
            Aprendiendo: aún no hay suficientes datos para evaluarla.
          </Alert>
        )}

        <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-xl px-3 py-2.5">
          <Metric label="Gasto" value={money(c.cost)} />
          <Metric label="Clics" value={c.clicks.toLocaleString('es-CL')} />
          <Metric label="Resultados" value={Math.round(c.conversions * 10) / 10} />
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({ campaign, currency, onConfirm, onCancel }) {
  const pausing = campaign.status === 'active';

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 motion-safe:animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl motion-safe:animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <div
          className={`size-11 grid place-items-center rounded-2xl ${pausing ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}
        >
          <Icon name={pausing ? 'pause' : 'play'} className="size-5" />
        </div>
        <h2 id="confirm-title" className="text-lg font-semibold text-slate-900 mt-4">
          {pausing ? '¿Pausar esta campaña?' : '¿Volver a activar esta campaña?'}
        </h2>
        <p className="text-sm font-medium text-slate-700 mt-1 break-words">{campaign.name}</p>
        <p className="text-sm text-slate-500 mt-3 leading-relaxed">
          {pausing
            ? `Dejará de mostrarse y de gastar inmediatamente. En los últimos 30 días gastó ${formatMoney(campaign.cost, currency)}. Puedes reactivarla cuando quieras.`
            : 'Volverá a mostrarse y a gastar según su presupuesto diario.'}
        </p>
        <div className="flex gap-2 mt-6">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
          <Button variant={pausing ? 'danger' : 'success'} onClick={onConfirm} className="flex-1" autoFocus>
            {pausing ? 'Sí, pausar' : 'Sí, activar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Panel con resumen, alertas de cuenta y campañas.
 * `onSetStatus(campaign, 'PAUSED' | 'ENABLED')` debe devolver una promesa.
 */
export function Dashboard({ account, evaluation, onSetStatus, onChangeAccount }) {
  const [pending, setPending] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);
  const { summary, campaigns, accountAlerts } = evaluation;
  const money = (v) => formatMoney(v, account.currency);
  const cancel = useCallback(() => setPending(null), []);
  const dismissToast = useCallback(() => setToast(null), []);

  const confirm = async () => {
    const c = pending;
    const pausing = c.status === 'active';
    setPending(null);
    setBusyId(c.id);
    setToast(null);
    try {
      await onSetStatus(c, pausing ? 'PAUSED' : 'ENABLED');
      setToast({ tone: 'success', title: pausing ? 'Campaña pausada' : 'Campaña activada', message: c.name });
    } catch (e) {
      setToast({ tone: 'danger', title: pausing ? 'No pudimos pausar la campaña' : 'No pudimos activar la campaña', message: e.message });
    } finally {
      setBusyId(null);
    }
  };

  if (campaigns.length === 0) {
    return (
      <StateCard
        icon="search"
        title="Esta cuenta todavía no tiene campañas"
        action={
          onChangeAccount && (
            <Button variant="secondary" onClick={onChangeAccount}>
              Revisar otra cuenta
            </Button>
          )
        }
      >
        Cuando crees una campaña en Google Ads aparecerá aquí y empezaremos a vigilar su gasto.
        {onChangeAccount && ' Si tus anuncios están en otra de tus cuentas, cámbiate a ella.'}
      </StateCard>
    );
  }

  return (
    <div className="motion-safe:animate-fade-in">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-3">Últimos 30 días</p>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatCard icon="wallet" label="Gasto" value={money(summary.totalCost)} />
        <StatCard icon="target" label="Resultados (ventas/contactos)" value={summary.measuring ? Math.round(summary.totalConversions) : '—'} />
        <StatCard
          icon="bell"
          label="Campañas con alertas"
          value={`${summary.alertCount} / ${summary.activeCount}`}
          tone={summary.alertCount ? 'warn' : 'default'}
        />
        <StatCard
          icon="piggy"
          label="Podrías ahorrar al mes"
          value={money(summary.potentialSavings)}
          tone={summary.potentialSavings > 0 ? 'good' : 'default'}
        />
      </div>

      <div className="space-y-3 mb-5 empty:hidden">
        {accountAlerts.map((a) => (
          <AlertBox key={a.rule} alert={a} />
        ))}

        {summary.activeCount === 0 && (
          <Alert tone="success" title="Hoy no estás gastando dinero">
            No tienes campañas activas. Abajo están tus campañas pausadas con lo que gastaron en los últimos 30 días; si reactivas
            alguna, la vigilaremos por ti.
          </Alert>
        )}
      </div>

      <h2 className="text-sm font-semibold text-slate-900 mb-3">Campañas</h2>
      <div className="space-y-3">
        {campaigns.map((c) => (
          <CampaignCard key={c.id} campaign={c} currency={account.currency} onToggle={setPending} busy={busyId === c.id} />
        ))}
      </div>

      {pending && <ConfirmDialog campaign={pending} currency={account.currency} onConfirm={confirm} onCancel={cancel} />}
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
