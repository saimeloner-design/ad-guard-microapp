'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatMoney, SEVERITY } from '@/lib/alerts';
import { Bell, Clock, Pause, PiggyBank, Play, Search, Sprout, Target, Users, Wallet } from 'lucide-react';
import { Alert, Button, StateCard, Toast } from './ui';

const CHANNEL_LABELS = {
  SEARCH: 'Búsqueda',
  DISPLAY: 'Display',
  SHOPPING: 'Shopping',
  VIDEO: 'YouTube',
  PERFORMANCE_MAX: 'Máximo rendimiento',
  DEMAND_GEN: 'Demand Gen',
  SMART: 'Inteligente',
  LOCAL: 'Local',
  // Objetivos de campaña de Meta
  OUTCOME_SALES: 'Ventas',
  OUTCOME_LEADS: 'Clientes potenciales',
  OUTCOME_ENGAGEMENT: 'Interacción',
  OUTCOME_TRAFFIC: 'Tráfico',
  OUTCOME_AWARENESS: 'Reconocimiento',
  OUTCOME_APP_PROMOTION: 'Promoción de app',
  MESSAGES: 'Mensajes',
};

const PLATFORMS = {
  google: { label: 'Google', ads: 'Google Ads' },
  meta: { label: 'Meta', ads: 'el Administrador de anuncios de Meta' },
};

const STAT_TONES = {
  default: { value: 'text-fg', icon: 'bg-surface-3 text-muted' },
  warn: { value: 'text-amber-600 dark:text-amber-400', icon: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' },
  good: { value: 'text-emerald-600 dark:text-emerald-400', icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' },
};

function StatCard({ label, value, icon: StatIcon, tone = 'default' }) {
  const t = STAT_TONES[tone];
  return (
    <div className="bg-surface border border-line rounded-2xl p-4 shadow-xs">
      <div className="flex items-center gap-2">
        <span className={`size-7 grid place-items-center rounded-lg ${t.icon}`}>
          <StatIcon className="size-4" aria-hidden="true" />
        </span>
        <span className="text-xs font-medium text-muted leading-tight">{label}</span>
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

const STATUS_PILLS = {
  active: { label: 'Activa', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300', dot: 'bg-emerald-500' },
  // Meta: la campaña está activa pero ninguno de sus conjuntos de anuncios está publicando.
  idle: { label: 'Activa, sin publicar', className: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300', dot: 'bg-amber-500' },
  paused: { label: 'Pausada', className: 'bg-surface-3 text-muted', dot: 'bg-faint' },
};

function StatusPill({ status }) {
  const pill = STATUS_PILLS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${pill.className}`}>
      <span className={`size-1.5 rounded-full ${pill.dot}`} />
      {pill.label}
    </span>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-muted">{label}</div>
      <div className="text-sm font-semibold text-fg tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function CampaignCard({ campaign: c, currency, platform, onToggle, busy }) {
  const isPaused = c.status === 'paused';
  const shouldPause = c.alerts.some((a) => a.severity === SEVERITY.PAUSE);
  const money = (v) => formatMoney(v, currency);
  // Meta trae sus propios KPIs según el objetivo de la campaña.
  const kpis = c.kpis ?? [
    { label: 'Gasto', value: money(c.cost) },
    { label: 'Clics', value: c.clicks.toLocaleString('es-CL') },
    { label: 'Resultados', value: Math.round(c.conversions * 10) / 10 },
  ];

  return (
    <div
      className={`p-4 rounded-2xl border transition-shadow ${
        isPaused
          ? 'border-line bg-surface/60'
          : shouldPause
            ? 'bg-surface border-red-200 shadow-sm shadow-red-100 ring-1 ring-red-100 dark:border-red-500/40 dark:shadow-none dark:ring-red-500/10'
            : c.alerts.length
              ? 'bg-surface border-amber-200 shadow-sm shadow-amber-100 dark:border-amber-500/35 dark:shadow-none'
              : 'bg-surface border-line shadow-xs'
      }`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill status={isPaused ? 'paused' : c.delivering === false ? 'idle' : 'active'} />
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                {CHANNEL_LABELS[c.channel] || PLATFORMS[platform].label}
              </span>
            </div>
            <h3 className={`text-[15px] font-semibold mt-2 break-words ${isPaused ? 'text-muted' : 'text-fg'}`}>{c.name}</h3>
          </div>
          <Button
            size="sm"
            variant={isPaused ? 'secondary' : shouldPause ? 'danger' : 'secondary'}
            icon={isPaused ? Play : Pause}
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
          <Alert tone="neutral" icon={Sprout}>
            {c.learningMessage ?? 'Aprendiendo: aún no hay suficientes datos para evaluarla.'}
          </Alert>
        )}

        <div className="bg-surface-2 rounded-xl px-3 py-2.5">
          <div className="grid grid-cols-3 gap-2">
            {kpis.map((k) => (
              <Metric key={k.label} label={k.label} value={k.value} />
            ))}
          </div>
          {c.detail && <p className="text-xs text-muted mt-2 pt-2 border-t border-line">{c.detail}</p>}
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
      className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 motion-safe:animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm bg-surface border border-transparent dark:border-line rounded-3xl p-6 shadow-2xl motion-safe:animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <div
          className={`size-11 grid place-items-center rounded-2xl ${pausing ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'}`}
        >
          {pausing ? <Pause className="size-5" aria-hidden="true" /> : <Play className="size-5" aria-hidden="true" />}
        </div>
        <h2 id="confirm-title" className="text-lg font-semibold text-fg mt-4">
          {pausing ? '¿Pausar esta campaña?' : '¿Volver a activar esta campaña?'}
        </h2>
        <p className="text-sm font-medium text-fg-2 mt-1 break-words">{campaign.name}</p>
        <p className="text-sm text-muted mt-3 leading-relaxed">
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

function HiddenNote({ count, className = '' }) {
  if (!count) return null;
  return (
    // span y no p: también va dentro del texto de StateCard, que ya es un <p>.
    <span className={`block text-xs text-muted ${className}`}>
      {count === 1
        ? 'Hay 1 campaña antigua sin gasto en los últimos 90 días que no mostramos.'
        : `Hay ${count} campañas antiguas sin gasto en los últimos 90 días que no mostramos.`}
    </span>
  );
}

/**
 * Panel con resumen, alertas de cuenta y campañas.
 * `onSetStatus(campaign, 'PAUSED' | 'ENABLED')` debe devolver una promesa. `platform`: 'google' | 'meta'.
 * `hiddenCount`: campañas antiguas sin gasto en 90 días que no se muestran (Meta).
 */
export function Dashboard({ account, evaluation, onSetStatus, onChangeAccount, platform = 'google', hiddenCount = 0 }) {
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
        icon={Search}
        title={hiddenCount ? 'No tienes campañas con actividad reciente' : 'Esta cuenta todavía no tiene campañas'}
        action={
          onChangeAccount && (
            <Button variant="secondary" onClick={onChangeAccount}>
              Revisar otra cuenta
            </Button>
          )
        }
      >
        Cuando crees {hiddenCount ? 'o reactives ' : ''}una campaña en {PLATFORMS[platform].ads} aparecerá aquí y empezaremos a
        vigilar su gasto.
        {onChangeAccount && ' Si tus anuncios están en otra de tus cuentas, cámbiate a ella.'}
        <HiddenNote count={hiddenCount} className="mt-3" />
      </StateCard>
    );
  }

  return (
    <div className="motion-safe:animate-fade-in">
      <p className="text-xs font-medium uppercase tracking-wider text-faint mb-3">Últimos 30 días</p>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatCard icon={Wallet} label="Gasto" value={money(summary.totalCost)} />
        {platform === 'meta' ? (
          // En Meta cada campaña busca un resultado distinto: sumarlos no dice nada.
          <StatCard icon={Users} label="Personas alcanzadas" value={summary.reach ? summary.reach.toLocaleString('es-CL') : '—'} />
        ) : (
          <StatCard icon={Target} label="Resultados (ventas/contactos)" value={summary.measuring ? Math.round(summary.totalConversions) : '—'} />
        )}
        <StatCard
          icon={Bell}
          label="Campañas con alertas"
          value={`${summary.alertCount} / ${summary.activeCount}`}
          tone={summary.alertCount ? 'warn' : 'default'}
        />
        <StatCard
          icon={PiggyBank}
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

      <h2 className="text-sm font-semibold text-fg mb-3">Campañas</h2>
      {platform === 'meta' && (
        <p className="flex items-center gap-1.5 text-xs text-muted -mt-1.5 mb-3">
          <Clock className="size-3.5 shrink-0" aria-hidden="true" />
          Meta puede tardar hasta 3 días en registrar algunas ventas y contactos.
        </p>
      )}
      <div className="space-y-3">
        {campaigns.map((c) => (
          <CampaignCard key={c.id} campaign={c} currency={account.currency} platform={platform} onToggle={setPending} busy={busyId === c.id} />
        ))}
      </div>
      <HiddenNote count={hiddenCount} className="mt-4 text-center" />

      {pending && <ConfirmDialog campaign={pending} currency={account.currency} onConfirm={confirm} onCancel={cancel} />}
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
