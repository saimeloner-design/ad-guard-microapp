'use client';

import { formatMoney, SEVERITY } from '@/lib/alerts';
import { useState } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Copy, ExternalLink, History, Lightbulb, Pause, Play, Scissors, Sprout, TriangleAlert, X } from 'lucide-react';
import { Term } from './glossary';
import { Alert, Button, Spinner } from './ui';

export const CHANNEL_LABELS = {
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

export const PLATFORMS = {
  google: { label: 'Google', ads: 'Google Ads' },
  meta: { label: 'Meta', ads: 'el Administrador de anuncios de Meta' },
};

const isPause = (a) => a.severity === SEVERITY.PAUSE;

/**
 * Urgencia de una campaña, para ordenar la lista y armar las tareas de Hoy:
 * pause (hay que pausarla), review (tiene alertas o su configuración nueva tiene problemas),
 * learning (todavía no se puede evaluar), ok (activa y sin alertas) u off (pausada).
 */
export function levelOf(c) {
  if (c.status !== 'active') return 'off';
  if (c.delivering !== false && c.alerts.some(isPause)) return 'pause';
  if (c.alerts.length || c.setup?.problems) return 'review';
  if (c.learning && c.delivering !== false) return 'learning';
  return 'ok';
}

const fmt = (n) => n.toLocaleString('es-CL');
const daysAgo = (n) => (n === 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`);

/** Unidad de los resultados en minúscula, p. ej. "compras" (Meta trae la etiqueta en sus KPIs). */
const resultsLabel = (c) => c.kpis?.[1]?.label.toLowerCase() ?? 'resultados';

/** Una línea del avance del aprendizaje, para la lista. */
function learningLine(c) {
  const p = c.learningProgress;
  if (p?.kind === 'meta') return p.results === null ? 'Meta está aprendiendo' : `Meta está aprendiendo · ${p.results} de ~${p.goal} ${resultsLabel(c)}`;
  if (p?.daysLeft) return `Juntando datos · la evaluamos en ~${p.daysLeft} ${p.daysLeft === 1 ? 'día' : 'días'}`;
  return 'Juntando datos para evaluarla';
}

/** Una línea que explica por qué la campaña está en su grupo. */
export function whyLine(c) {
  const level = levelOf(c);
  if (level === 'off') return 'Pausada';
  if (level === 'pause') return c.alerts.find(isPause).title;
  if (level === 'review') {
    if (c.setup?.problems) return `Campaña nueva: ${c.setup.problems === 1 ? '1 cosa que revisar' : `${c.setup.problems} cosas que revisar`}`;
    return c.alerts[0].title;
  }
  if (level === 'learning') return learningLine(c);
  if (c.delivering === false) return 'Activa, pero no se está mostrando';
  if (c.learning) return 'Aprendiendo: todavía no hay datos suficientes';
  if (c.health?.headline) return c.health.headline;
  const cost = c.kpis?.[2];
  return cost && cost.value !== '—' ? `${cost.label}: ${cost.value}` : 'Sin alertas';
}

export function AlertBox({ alert }) {
  return (
    <Alert tone={isPause(alert) ? 'danger' : 'warning'} title={alert.title}>
      {alert.message}
    </Alert>
  );
}

/**
 * Campaña para pausar: el motivo de pausar va a la vista y las alertas de Revisar
 * quedan plegadas debajo. No se esconden: explican qué falló y sirven para la próxima campaña.
 */
function PauseAlerts({ alerts }) {
  const pause = alerts.filter(isPause);
  const review = alerts.filter((a) => !isPause(a));
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
    <div className="min-w-0">
      <Term label={label} className="text-[11px] font-medium text-muted" />
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
function Tip({ tone, icon: TipIcon, eyebrow, title, defaultOpen = false, children }) {
  const t = TIP_TONES[tone];
  return (
    <details className={`group rounded-xl ${t.box}`} open={defaultOpen || undefined}>
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

function Section({ title, children }) {
  return (
    <section className="bg-surface border border-line rounded-2xl p-4 shadow-xs flex flex-col gap-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</h3>
      {children}
    </section>
  );
}

function Diagnosis({ campaign: c, actions }) {
  const d = c.diagnosis;
  const wasted = d.cut?.parts.filter((p) => p.wasted) ?? [];
  return (
    <Section title="¿Dónde se pierde la plata?">
      {d.steps && <Funnel steps={d.steps} />}
      <div className="flex flex-col gap-2">
        {d.fix && (
          <Tip tone="fix" icon={Lightbulb} eyebrow="Qué cambiar" title={d.fix.title}>
            <p>{d.fix.detail}</p>
          </Tip>
        )}
        {d.cut && (
          <Tip tone="cut" icon={Scissors} eyebrow="Pausa solo esta parte" title={d.cut.title} defaultOpen>
            <ul className="rounded-lg border border-line bg-surface divide-y divide-line">
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
            {actions.pauseParts && (
              <Button
                size="sm"
                variant="secondary"
                icon={Pause}
                onClick={() => actions.pauseParts(c, wasted)}
                className="text-red-600 dark:text-red-400"
              >
                {wasted.length === 1 ? `Pausar "${wasted[0].name}"` : `Pausar ${wasted.length === 2 ? 'los 2' : `los ${wasted.length}`}`}
              </Button>
            )}
            <p>{d.cut.detail}</p>
          </Tip>
        )}
        {d.past && (
          <Tip tone="past" icon={History} eyebrow="Lo que te funcionó antes" title={d.past.title}>
            <p>{d.past.intro}</p>
            {d.past.rows.length > 0 && <Comparison rows={d.past.rows} />}
            {d.past.suggestion && <p className="font-semibold text-fg">{d.past.suggestion}</p>}
            <p>{d.past.howTo}</p>
            {actions.copyCampaign && (
              <Button size="sm" variant="secondary" icon={Copy} onClick={() => actions.copyCampaign({ id: d.past.winnerId, name: d.past.winnerName })}>
                Crear una copia de &quot;{d.past.winnerName}&quot;
              </Button>
            )}
          </Tip>
        )}
      </div>
    </Section>
  );
}

const CHECK_STYLES = {
  bad: { dot: 'bg-red-600 text-white dark:bg-red-500', title: 'text-red-600 dark:text-red-400', Icon: X },
  warn: { dot: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400', title: 'text-amber-700 dark:text-amber-400', Icon: TriangleAlert },
  ok: { dot: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400', title: 'text-fg-2 font-medium', Icon: Check },
};

/** Revisión de campaña nueva: qué está bien y qué puede hacer perder plata. */
function SetupReview({ setup }) {
  return (
    <Section title="Revisamos cómo la configuraste">
      <ul className="flex flex-col gap-3">
        {setup.checks.map((ch) => {
          const s = CHECK_STYLES[ch.status];
          return (
            <li key={ch.key} className="grid grid-cols-[22px_1fr] gap-2.5 items-start">
              <span className={`size-[22px] grid place-items-center rounded-full ${s.dot}`}>
                <s.Icon className="size-3" strokeWidth={3} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-semibold leading-snug ${s.title}`}>{ch.title}</p>
                <p className="text-[13px] text-fg-2 leading-relaxed mt-0.5">{ch.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function ProgressBar({ value, className = 'h-2', label }) {
  return (
    <span
      role={label ? 'progressbar' : undefined}
      aria-label={label}
      aria-valuenow={label ? Math.round(value * 100) : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      className={`block rounded-full bg-indigo-100 dark:bg-indigo-500/20 overflow-hidden ${className}`}
    >
      <span className="block h-full rounded-full bg-indigo-500" style={{ width: `${Math.round(value * 100)}%` }} />
    </span>
  );
}

/** Sección plegable: se ve el título y un resumen; el resto se abre al tocar. */
function Fold({ title, summary, onToggle, children }) {
  return (
    <details className="group bg-surface border border-line rounded-2xl shadow-xs" onToggle={onToggle}>
      <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer grid grid-cols-[1fr_16px] gap-2.5 items-center px-3.5 py-3 rounded-2xl focus-visible:outline-2 focus-visible:outline-indigo-500">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-fg">{title}</span>
          <span className="block text-[13px] text-muted leading-snug mt-0.5">{summary}</span>
        </span>
        <ChevronDown className="size-4 text-muted transition-transform motion-reduce:transition-none group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="px-3.5 pb-3.5 flex flex-col gap-3 text-[13px] text-fg-2 leading-relaxed">{children}</div>
    </details>
  );
}

/** Va bien: cuántas revisiones pasó; al abrir, cuáles y con qué cifras. */
function HealthBox({ health: h }) {
  return (
    <details className="group rounded-xl border bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/25">
      <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer grid grid-cols-[20px_1fr_16px] gap-2.5 items-start px-3 py-3 rounded-xl focus-visible:outline-2 focus-visible:outline-indigo-500">
        <span className="size-5 mt-px grid place-items-center rounded-full bg-emerald-600 text-white dark:bg-emerald-500">
          <Check className="size-3" strokeWidth={3} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-emerald-900 dark:text-emerald-200">{h.title}</span>
          <span className="block text-[13px] text-fg-2 leading-snug mt-0.5">
            {h.summary} <span className="font-medium text-emerald-700 dark:text-emerald-400 group-open:hidden">Ver qué revisamos</span>
          </span>
        </span>
        <ChevronDown className="size-4 mt-0.5 text-muted transition-transform motion-reduce:transition-none group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="pl-[42px] pr-3 pb-3 flex flex-col gap-3 text-[13px] leading-relaxed">
        <ul className="flex flex-col gap-2 text-fg-2">
          {h.checks.map((ch) => {
            // "Etiqueta: cifra" → la etiqueta en negrita para leer la lista de un vistazo.
            const i = ch.text.indexOf(': ');
            return (
              <li key={ch.key} className="grid grid-cols-[16px_1fr] gap-2 items-start">
                <span className="size-4 mt-0.5 grid place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                  <Check className="size-2.5" strokeWidth={3.5} aria-hidden="true" />
                </span>
                {i === -1 ? (
                  <span>{ch.text}</span>
                ) : (
                  <span>
                    <span className="font-semibold text-fg">{ch.text.slice(0, i)}:</span> {ch.text.slice(i + 2)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="grid grid-cols-[16px_1fr] gap-2 items-start border-t border-emerald-200 dark:border-emerald-500/25 pt-3 font-medium text-emerald-800 dark:text-emerald-300">
          <Lightbulb className="size-4 mt-0.5" aria-hidden="true" />
          <span>{h.advice}</span>
        </p>
      </div>
    </details>
  );
}

/** Aprendiendo: qué le falta para que la podamos evaluar. */
function LearningBox({ campaign: c }) {
  const p = c.learningProgress;
  const meta = p.kind === 'meta';
  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-500/10 dark:border-indigo-500/25 p-4 flex flex-col gap-3">
      <div className="grid grid-cols-[20px_1fr] gap-2.5 items-start">
        <Sprout className="size-[18px] mt-0.5 text-indigo-700 dark:text-indigo-300" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">{meta ? 'Meta está aprendiendo' : 'Todavía la vio poca gente'}</p>
          <p className="text-[13px] text-fg-2 leading-relaxed mt-0.5">
            {meta
              ? 'Está probando a quién mostrarle el anuncio. Mientras aprende, los costos suben y bajan: todavía no la juzgamos.'
              : 'Con tan pocos datos podríamos equivocarnos y hacerte pausar una campaña buena. La evaluamos cuando llegue a una de estas dos metas:'}
          </p>
        </div>
      </div>
      {meta ? (
        p.results !== null && (
          <div className="bg-surface rounded-xl p-3 flex flex-col gap-2">
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-sm font-semibold text-fg">
                {fmt(p.results)} de ~{p.goal} {resultsLabel(c)}
              </span>
              <span className="text-xs text-muted tabular-nums">{Math.round(p.percent * 100)}%</span>
            </div>
            <ProgressBar value={p.percent} label="Avance del aprendizaje" />
            <p className="text-[13px] text-fg-2 leading-relaxed">
              Meta suele terminar de aprender cuando junta unas {p.goal} en una semana.
              {p.slow &&
                ` Al ritmo de hoy (${fmt(Math.round(p.perDay * 10) / 10)} al día) no alcanza: si en ${p.daysToWeek === 1 ? '1 día' : `${p.daysToWeek} días`} no llega, te avisaremos que tiene aprendizaje limitado.`}
            </p>
          </div>
        )
      ) : (
        <div className="bg-surface rounded-xl p-3 flex flex-col gap-3">
          <Goal label={`${fmt(Math.min(p.impressions, p.minImpressions))} de ${fmt(p.minImpressions)} veces vista`} value={p.impressions / p.minImpressions} />
          <div className="flex items-center gap-2 text-xs text-muted" aria-hidden="true">
            <span className="flex-1 h-px bg-line" />o<span className="flex-1 h-px bg-line" />
          </div>
          <Goal label={`${fmt(Math.min(p.clicks, p.minClicks))} de ${fmt(p.minClicks)} clics`} value={p.clicks / p.minClicks} />
          {p.daysLeft && <p className="text-[13px] text-fg-2">A su ritmo actual, llega en {p.daysLeft === 1 ? '1 día' : `unos ${p.daysLeft} días`}.</p>}
        </div>
      )}
    </section>
  );
}

function Goal({ label, value }) {
  const v = Math.min(1, value);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline gap-2">
        <span className="text-[13px] font-semibold text-fg">{label}</span>
        <span className="text-xs text-muted tabular-nums">{Math.round(v * 100)}%</span>
      </div>
      <ProgressBar value={v} label={label} />
    </div>
  );
}

const shortDate = (iso) => new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }).replace('.', '');

/**
 * Configuración de esta campaña: se pide a Meta sólo al abrir la sección, una vez
 * (`actions.loadConfig` guarda lo leído mientras la página esté abierta).
 */
function ConfigFold({ campaign: c, money, actions, adsManagerUrl }) {
  const [state, setState] = useState({ status: 'idle' });
  const load = (e) => {
    if (!e.currentTarget.open || state.status === 'loading' || state.status === 'ok') return;
    setState({ status: 'loading' });
    actions.loadConfig(c).then(
      (config) => setState(config ? { status: 'ok', config } : { status: 'error' }),
      () => setState({ status: 'error' })
    );
  };
  const cfg = state.config;
  const rows = cfg && [
    ['Presupuesto', cfg.dailyBudget && `${money(cfg.dailyBudget)} al día`],
    ['Meta busca', cfg.goal ?? c.kpis?.[1]?.label],
    ['Ubicación', cfg.location],
    ['Edad', cfg.age && `${cfg.age} años`],
    ['Formato', cfg.formats?.join(', ')],
    ['Fechas', cfg.start && `Desde el ${shortDate(cfg.start)}, ${cfg.end ? `hasta el ${shortDate(cfg.end)}` : 'sin fecha de término'}`],
  ].filter(([, v]) => v);
  const ads = cfg?.ads ?? [];
  const live = ads.some((ad) => ad.live);
  const resultsOf = (id) => c.parts?.ad.find((p) => p.id === id)?.results;

  return (
    <Fold title="Configuración de esta campaña" summary="Presupuesto, público y el texto de sus anuncios" onToggle={load}>
      {state.status === 'loading' && (
        <p className="flex items-center gap-2 text-muted">
          <Spinner /> Leyendo la configuración en Meta…
        </p>
      )}
      {state.status === 'error' && <p className="text-muted">No pudimos leer la configuración en Meta. Ciérrala y vuelve a abrirla para intentarlo de nuevo.</p>}
      {cfg && (
        <>
          {rows.length > 0 && (
            <dl className="grid grid-cols-[38%_1fr] rounded-lg border border-line overflow-hidden">
              {rows.map(([label, value], i) => (
                <div key={label} className={`contents ${i > 0 ? '[&>*]:border-t [&>*]:border-line' : ''}`}>
                  <dt className="px-2.5 py-2 text-muted">{label}</dt>
                  <dd className="px-2.5 py-2 font-semibold text-fg break-words">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {ads.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-fg-2">
                {live ? (ads.length === 1 ? 'Su anuncio publicando' : `Sus ${ads.length} anuncios publicando`) : 'Sus anuncios'}
              </p>
              <ul className="flex flex-col gap-2">
                {ads.map((ad) => {
                  const results = resultsOf(ad.id);
                  return (
                    <li key={ad.id} className="rounded-lg border border-line px-3 py-2.5 flex flex-col gap-1">
                      <span className="flex justify-between gap-2 text-xs text-muted">
                        <span className="min-w-0 break-words">{ad.name}</span>
                        {results != null && (
                          <span className="font-semibold text-fg-2 whitespace-nowrap tabular-nums">
                            {fmt(results)} {resultsLabel(c)}
                          </span>
                        )}
                      </span>
                      <span className={`break-words ${ad.text ? 'text-fg-2' : 'text-muted italic'}`}>{ad.text ? `"${ad.text}"` : 'Sin texto'}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
      {adsManagerUrl && (
        <a
          href={adsManagerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start inline-flex items-center gap-1.5 min-h-11 font-semibold text-indigo-600 dark:text-indigo-300 hover:underline focus-visible:outline-2 focus-visible:outline-indigo-500 rounded"
        >
          Abrir en el Administrador de anuncios
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      )}
    </Fold>
  );
}

/** Detalle de una campaña que va bien o que aprende: lo que importa a la vista, el resto plegado. */
function CalmSections({ campaign: c, actions }) {
  const h = c.health;
  const steps = h?.steps;
  return (
    <>
      {steps && (
        <Fold
          title="El recorrido de la gente"
          summary={`${fmt(steps[0].value)} lo vieron y ${fmt(steps.at(-1).value)} ${steps.at(-1).label}`}
        >
          <Funnel steps={steps} />
          <p>Ningún paso se corta: en cada uno avanza la gente que esperamos.</p>
        </Fold>
      )}
      {c.best && (
        <Fold title={`Tu mejor campaña de ${c.best.toLowerCase()}`} summary={`Ninguna otra de los últimos 18 meses tuvo un ${c.kpis[2].label.toLowerCase()} más bajo`}>
          <p>Si quieres repetirla para otra fecha, crea una copia en pausa y cámbiale sólo la imagen y el texto.</p>
          {actions.copyCampaign && (
            <Button size="sm" variant="secondary" icon={Copy} onClick={() => actions.copyCampaign({ id: c.id, name: c.name })} className="self-start">
              Crear una campaña igual
            </Button>
          )}
        </Fold>
      )}
      {c.pending?.length > 0 && (
        <Fold
          title={c.learningProgress?.kind === 'meta' ? 'Cuando termine, revisamos' : 'Cuando tenga datos, revisamos'}
          summary={`${c.pending.length === 1 ? '1 cosa' : `${c.pending.length} cosas`}, como en tus otras campañas`}
        >
          <ul className="flex flex-col gap-2.5">
            {c.pending.map((text) => (
              <li key={text} className="grid grid-cols-[22px_1fr] gap-2.5 items-start">
                <span className="size-[22px] rounded-full border-2 border-dashed border-indigo-200 dark:border-indigo-500/40" aria-hidden="true" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </Fold>
      )}
    </>
  );
}

function CampaignRow({ campaign: c, money, onOpen }) {
  const level = levelOf(c);
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(c.id)}
        className="w-full grid grid-cols-[1fr_auto_14px] gap-x-2.5 gap-y-0.5 items-center text-left px-3.5 py-3 hover:bg-surface-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500"
      >
        <span className="min-w-0 text-sm font-semibold text-fg break-words">
          {c.name}
          {c.setup && (
            <span className="ml-1.5 align-middle text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
              Nueva
            </span>
          )}
        </span>
        <span className="text-[13px] text-fg-2 tabular-nums whitespace-nowrap">{money(c.cost)}</span>
        <ChevronRight className={`${level === 'learning' ? 'row-span-3' : 'row-span-2'} size-4 text-faint`} aria-hidden="true" />
        <span
          className={`col-span-2 text-[13px] leading-snug ${level === 'pause' ? 'text-red-600 dark:text-red-400' : level === 'review' ? 'text-amber-700 dark:text-amber-400' : c.health ? 'text-fg-2' : 'text-muted'}`}
        >
          {level === 'ok' && c.health && <Check className="inline size-3.5 mr-1 -mt-0.5 text-emerald-600 dark:text-emerald-400" strokeWidth={3} aria-hidden="true" />}
          {whyLine(c)}
        </span>
        {level === 'learning' && c.learningProgress?.percent != null && <ProgressBar value={c.learningProgress.percent} className="col-span-2 h-1 mt-1" />}
      </button>
    </li>
  );
}

const GROUPS = [
  { level: 'pause', label: 'Pausar ya', dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
  { level: 'review', label: 'Para revisar', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  { level: 'ok', label: 'Van bien', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  { level: 'learning', label: 'Aprendiendo', dot: 'bg-indigo-500', text: 'text-indigo-700 dark:text-indigo-300' },
  { level: 'off', label: 'Pausadas', dot: 'bg-faint', text: 'text-muted' },
];

/** Lista corta de campañas, agrupada por urgencia. El detalle se abre al tocar una. */
export function CampaignList({ campaigns, currency, platform, onOpen, footer }) {
  const money = (v) => formatMoney(v, currency);
  return (
    <div className="flex flex-col gap-5 motion-safe:animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-fg">Campañas</h2>
        <p className="text-sm text-muted mt-0.5">Ordenadas por urgencia, con lo gastado en 30 días. Toca una para ver qué pasa.</p>
      </div>
      {GROUPS.map((g) => {
        const list = campaigns.filter((c) => levelOf(c) === g.level).sort((a, b) => b.cost - a.cost);
        if (!list.length) return null;
        return (
          <section key={g.level} aria-labelledby={`group-${g.level}`}>
            <h3 id={`group-${g.level}`} className={`flex items-center gap-2 text-[13px] font-semibold mb-2 ${g.text}`}>
              <span className={`size-2 rounded-full ${g.dot}`} aria-hidden="true" />
              {g.label}
              <span className="text-xs font-medium text-muted tabular-nums">{list.length}</span>
            </h3>
            <ul className="bg-surface border border-line rounded-2xl shadow-xs overflow-hidden divide-y divide-line">
              {list.map((c) => (
                <CampaignRow key={c.id} campaign={c} money={money} onOpen={onOpen} />
              ))}
            </ul>
          </section>
        );
      })}
      {platform === 'meta' && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Clock className="size-3.5 shrink-0" aria-hidden="true" />
          Meta puede tardar hasta 3 días en registrar algunas ventas y contactos.
        </p>
      )}
      {footer}
    </div>
  );
}

/** Detalle de una campaña: alertas, cifras, revisión de campaña nueva y diagnóstico. */
export function CampaignDetail({ campaign: c, currency, platform, busy, actions, onBack, adsManagerUrl }) {
  const isPaused = c.status === 'paused';
  const level = levelOf(c);
  const shouldPause = level === 'pause';
  const calm = level === 'ok' || level === 'learning';
  const progress = level === 'learning' ? c.learningProgress : null;
  const money = (v) => formatMoney(v, currency);
  // Meta trae sus propios KPIs según el objetivo de la campaña.
  const kpis = c.kpis ?? [
    { label: 'Gasto', value: money(c.cost) },
    { label: 'Clics', value: c.clicks.toLocaleString('es-CL') },
    { label: 'Resultados', value: Math.round(c.conversions * 10) / 10 },
  ];

  return (
    <div className="flex flex-col gap-4 motion-safe:animate-fade-in">
      <button
        type="button"
        onClick={onBack}
        className="self-start inline-flex items-center gap-1 -ml-1 text-sm font-semibold text-indigo-600 dark:text-indigo-300 cursor-pointer rounded-md px-1 py-0.5 focus-visible:outline-2 focus-visible:outline-indigo-500"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Campañas
      </button>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusPill status={isPaused ? 'paused' : c.delivering === false ? 'idle' : 'active'} />
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
              {CHANNEL_LABELS[c.channel] || PLATFORMS[platform].label}
            </span>
            {c.best && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                Tu mejor de {c.best.toLowerCase()}
              </span>
            )}
            {c.setup && <span className="text-[11px] font-medium text-muted">Creada hace poco</span>}
          </div>
          <h2 className={`text-xl font-semibold tracking-tight mt-2 break-words ${isPaused ? 'text-muted' : 'text-fg'}`}>{c.name}</h2>
          <p className="text-[13px] text-muted mt-0.5">Gastó {money(c.cost)} en los últimos 30 días</p>
        </div>
        <Button
          size="sm"
          variant={isPaused ? 'secondary' : shouldPause ? 'danger' : 'secondary'}
          icon={isPaused ? Play : Pause}
          loading={busy}
          onClick={() => actions.toggle(c)}
          className="shrink-0"
        >
          {isPaused ? 'Activar' : 'Pausar'}
        </Button>
      </div>

      {!isPaused && (shouldPause ? <PauseAlerts alerts={c.alerts} /> : c.alerts.map((a) => <AlertBox key={a.rule} alert={a} />))}

      {!isPaused && level === 'ok' && c.health && <HealthBox health={c.health} />}

      {!isPaused && progress && <LearningBox campaign={c} />}

      {!isPaused && progress?.kind === 'meta' && (
        <section className="bg-surface border border-line rounded-2xl p-4 shadow-xs grid grid-cols-[20px_1fr] gap-2.5 items-start">
          <Clock className="size-[18px] mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg">No la cambies por ahora</p>
            <p className="text-[13px] text-fg-2 leading-relaxed mt-0.5">
              Si cambias mucho el presupuesto (más de 20%), el público, los anuncios o el objetivo, Meta empieza a aprender de cero.
              {progress.editDays != null && ` Último cambio grande: ${daysAgo(progress.editDays)}.`}
            </p>
          </div>
        </section>
      )}

      {!isPaused && c.learning && !progress && (
        <Alert tone="neutral" icon={Sprout}>
          {c.learningMessage ?? 'Aprendiendo: aún no hay suficientes datos para evaluarla.'}
        </Alert>
      )}

      <div className="bg-surface border border-line rounded-2xl px-4 py-3 shadow-xs">
        <div className="grid grid-cols-3 gap-2">
          {kpis.map((k) => (
            <Metric key={k.label} label={k.label} value={k.value} />
          ))}
        </div>
        {progress ? (
          <p className="text-xs text-muted mt-2.5 pt-2.5 border-t border-line leading-relaxed">
            {progress.ageDays != null && progress.ageDays < 30 ? `Cifras de ${progress.ageDays === 1 ? '1 día' : `${progress.ageDays} días`}` : 'Cifras con pocos datos'}: todavía van a
            cambiar.
          </p>
        ) : (
          c.detail && <p className="text-xs text-muted mt-2.5 pt-2.5 border-t border-line leading-relaxed">{c.detail}</p>
        )}
      </div>

      {!isPaused && c.setup && <SetupReview setup={c.setup} />}
      {!isPaused && c.diagnosis && <Diagnosis campaign={c} actions={actions} />}
      {!isPaused && calm && platform === 'meta' && <CalmSections campaign={c} actions={actions} />}
      {platform === 'meta' && actions.loadConfig && <ConfigFold campaign={c} money={money} actions={actions} adsManagerUrl={adsManagerUrl} />}
    </div>
  );
}
