'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatMoney, SEVERITY } from '@/lib/alerts';
import { Bell, Check, ChevronDown, Clock, History, Lightbulb, Pause, PiggyBank, Play, Scissors, Search, Sprout, Target, TriangleAlert, Trophy, Users, Wallet, X } from 'lucide-react';
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

/**
 * Campaña para pausar: el motivo de pausar va a la vista y las alertas de Revisar
 * quedan plegadas debajo. No se esconden: explican qué falló y sirven para la próxima campaña.
 */
function PauseAlerts({ alerts }) {
  const pause = alerts.filter((a) => a.severity === SEVERITY.PAUSE);
  const review = alerts.filter((a) => a.severity !== SEVERITY.PAUSE);
  const one = review.length === 1;
  return (
    <>
      {pause.map((a) => (
        <AlertBox key={a.rule} alert={a} />
      ))}
      {review.length > 0 && (
        <details className="group rounded-xl border border-line bg-surface">
          <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer grid grid-cols-[18px_1fr_16px] gap-2.5 items-center px-3 py-2 rounded-xl focus-visible:outline-2 focus-visible:outline-indigo-500">
            <TriangleAlert className="size-[17px] text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-amber-700 dark:text-amber-400">
                {one ? 'Otra cosa para revisar' : `Otras ${review.length} cosas para revisar`}
              </span>
              <span className="block text-xs text-muted">{one ? 'Te sirve' : 'Te sirven'} para armar mejor la próxima campaña</span>
            </span>
            <ChevronDown className="size-4 text-muted transition-transform motion-reduce:transition-none group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="px-2 pb-2 flex flex-col gap-1.5">
            {review.map((a) => (
              <AlertBox key={a.rule} alert={a} />
            ))}
          </div>
        </details>
      )}
    </>
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

/** Recorrido de la gente (vieron → clic → web → resultado) con el paso donde se pierde la plata en rojo. */
function Funnel({ steps }) {
  return (
    <ol className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="Recorrido de la gente">
      {steps.map((s, i) => (
        <li key={s.key} className="relative flex flex-col items-center text-center gap-0.5 min-w-0">
          {i > 0 && (
            <span
              aria-hidden="true"
              className={`absolute top-[11px] right-1/2 w-full h-0.5 ${s.bad || steps[i - 1].bad ? 'bg-red-200 dark:bg-red-500/30' : 'bg-line'}`}
            />
          )}
          <span
            className={`relative z-10 size-6 grid place-items-center rounded-full ring-2 ring-surface ${
              s.bad ? 'bg-red-600 text-white dark:bg-red-500' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
            }`}
          >
            {s.bad ? <X className="size-3.5" strokeWidth={3} aria-hidden="true" /> : <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />}
          </span>
          <span className={`text-[15px] font-semibold tabular-nums tracking-tight mt-1 ${s.bad ? 'text-red-600 dark:text-red-400' : 'text-fg'}`}>
            {s.value.toLocaleString('es-CL')}
          </span>
          <span className={`text-xs leading-tight ${s.bad ? 'font-semibold text-red-600 dark:text-red-400' : 'text-muted'}`}>
            {s.label}
            {s.bad && <span className="sr-only"> (aquí se pierde la plata)</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

const TIP_TONES = {
  fix: { box: 'bg-indigo-50 dark:bg-indigo-500/10', icon: 'text-indigo-600 dark:text-indigo-300', eyebrow: 'text-indigo-600 dark:text-indigo-300' },
  cut: { box: 'bg-surface-3', icon: 'text-fg-2', eyebrow: 'text-muted' },
  past: { box: 'bg-emerald-50 dark:bg-emerald-500/10', icon: 'text-emerald-600 dark:text-emerald-400', eyebrow: 'text-emerald-700 dark:text-emerald-400' },
};

/** Sugerencia plegable: se ve el titular y la explicación se abre al tocarlo. */
function Tip({ tone, icon: TipIcon, eyebrow, title, children }) {
  const t = TIP_TONES[tone];
  return (
    <details className={`group rounded-xl ${t.box}`}>
      <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer grid grid-cols-[20px_1fr_16px] gap-2.5 items-start px-3 py-2.5 rounded-xl focus-visible:outline-2 focus-visible:outline-indigo-500">
        <TipIcon className={`size-[18px] mt-0.5 ${t.icon}`} aria-hidden="true" />
        <span className="min-w-0">
          <span className={`block text-[11px] font-semibold uppercase tracking-wider ${t.eyebrow}`}>{eyebrow}</span>
          <span className="block text-sm font-semibold text-fg leading-snug mt-0.5">{title}</span>
        </span>
        <ChevronDown className="size-4 mt-1 text-muted transition-transform motion-reduce:transition-none group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="px-3 pb-3 sm:pl-[42px] text-[13px] text-fg-2 leading-relaxed space-y-2.5">{children}</div>
    </details>
  );
}

/** Campaña que funcionó contra la actual: lo distinto en rojo, lo igual en gris. */
function Comparison({ rows }) {
  return (
    <div className="rounded-lg border border-line bg-surface overflow-x-auto">
      <table className="w-full table-fixed border-collapse text-[13px]">
        <thead>
          <tr className="bg-surface-2 text-[11px] font-semibold uppercase tracking-wider text-muted text-left">
            <th scope="col" className="w-[30%] px-2.5 py-1.5" />
            <th scope="col" className="px-2.5 py-1.5">La que funcionó</th>
            <th scope="col" className="px-2.5 py-1.5">Esta campaña</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-line align-top">
              <th scope="row" className="px-2.5 py-2 text-left font-normal text-muted break-words">
                {r.label}
              </th>
              <td className="px-2.5 py-2 font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums break-words">{r.then}</td>
              <td className={`px-2.5 py-2 tabular-nums break-words ${r.diff ? 'font-semibold text-red-600 dark:text-red-400' : 'text-fg-2'}`}>
                {r.now}
                {r.diff && <span className="sr-only"> (distinto)</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Diagnosis({ diagnosis: d }) {
  return (
    <div className="border-t border-dashed border-line pt-3 flex flex-col gap-3">
      {d.steps && (
        <>
          <h4 className="text-[13px] font-semibold text-fg">¿Dónde se pierde la plata?</h4>
          <Funnel steps={d.steps} />
          <Tip tone="fix" icon={Lightbulb} eyebrow="Qué cambiar" title={d.fix.title}>
            <p>{d.fix.detail}</p>
          </Tip>
        </>
      )}
      {d.past && (
        <Tip tone="past" icon={History} eyebrow="Lo que te funcionó antes" title={d.past.title}>
          <p>{d.past.intro}</p>
          {d.past.rows.length > 0 && <Comparison rows={d.past.rows} />}
          {d.past.suggestion && <p className="font-semibold text-fg">{d.past.suggestion}</p>}
          <p>{d.past.howTo}</p>
        </Tip>
      )}
      {d.cut && (
        <Tip tone="cut" icon={Scissors} eyebrow="Pausa solo esta parte" title={d.cut.title}>
          <ul className="rounded-lg border border-line bg-surface divide-y divide-line overflow-hidden">
            {d.cut.parts.map((p) => (
              <li key={p.id} className="grid grid-cols-[1fr_auto] gap-x-3 px-2.5 py-2">
                <span className="min-w-0 break-words font-medium text-fg">{p.name}</span>
                <span className={`font-semibold whitespace-nowrap ${p.wasted ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {p.results}
                </span>
                <span className="col-span-2 text-xs text-muted tabular-nums">gastó {p.cost}</span>
              </li>
            ))}
          </ul>
          <p>{d.cut.detail}</p>
        </Tip>
      )}
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

        {!isPaused && (shouldPause ? <PauseAlerts alerts={c.alerts} /> : c.alerts.map((a) => <AlertBox key={a.rule} alert={a} />))}

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

        {!isPaused && c.diagnosis && <Diagnosis diagnosis={c.diagnosis} />}
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

/** "Tus campañas que mejor funcionaron": la mejor de cada objetivo en los últimos 18 meses (Meta). */
function BestCampaigns({ best }) {
  return (
    <section aria-labelledby="best-title" className="bg-surface border border-line rounded-2xl shadow-xs overflow-hidden mb-5">
      <div className="px-4 pt-3.5 pb-2.5">
        <h2 id="best-title" className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Trophy className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          Tus campañas que mejor funcionaron
        </h2>
        <p className="text-xs text-muted mt-0.5">La mejor de cada objetivo en los últimos 18 meses, sin alertas y con al menos 10 resultados.</p>
      </div>
      <ul>
        {best.map((b) => (
          <li key={b.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 px-4 py-2.5 border-t border-line">
            <span className="col-span-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{b.objective}</span>
            <span className="min-w-0 break-words text-sm font-semibold text-fg">{b.name}</span>
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums text-right whitespace-nowrap">
              {b.costPerResult}
            </span>
            <span className="text-xs text-muted">{b.detail}</span>
            <span className="text-xs text-muted text-right whitespace-nowrap">{b.unit}</span>
          </li>
        ))}
      </ul>
    </section>
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

      {evaluation.best?.length > 0 && <BestCampaigns best={evaluation.best} />}

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
