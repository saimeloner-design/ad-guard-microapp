'use client';

import { CalendarDays, Copy, ExternalLink, Lightbulb, Trophy } from 'lucide-react';
import { Button } from './ui';

const dayMonth = (iso, options = {}) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', timeZone: 'UTC', ...options });

const MONTH_SHORT = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-CL', { month: 'short', timeZone: 'UTC' }).replace('.', '').toUpperCase();

/** Próxima fecha importante (idea 12): cuándo crear la campaña y qué funcionó el año anterior. */
function DateCard({ date: d }) {
  return (
    <section className="bg-surface border border-line rounded-2xl p-4 shadow-xs flex flex-col gap-3">
      <div className="grid grid-cols-[52px_1fr] gap-3 items-center">
        <div className="rounded-xl overflow-hidden text-center border border-line" aria-hidden="true">
          <span className="block bg-red-600 dark:bg-red-500 text-white text-[10.5px] font-bold tracking-wider py-0.5">{MONTH_SHORT(d.date)}</span>
          <span className="block text-xl font-bold text-fg tabular-nums py-1">{Number(d.date.slice(8))}</span>
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-fg">
            {d.name}, {d.daysLeft === 0 ? 'hoy' : d.daysLeft === 1 ? 'mañana' : `en ${d.daysLeft} días`}
          </h3>
          <p className="text-[13px] text-muted first-letter:uppercase">{dayMonth(d.date, { weekday: 'long' })}</p>
        </div>
      </div>
      {d.past && (
        <p className="text-sm text-fg-2 leading-relaxed">
          El año pasado tu campaña <span className="font-semibold text-fg">&quot;{d.past.name}&quot;</span> consiguió {d.past.results}{' '}
          {d.past.label} a {d.past.costPerResult} cada {d.past.unit}
          {d.past.month ? ` (${d.past.month})` : ''}.
        </p>
      )}
      <div className="grid grid-cols-[20px_1fr] gap-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2.5 text-sm text-fg-2 leading-relaxed">
        <Lightbulb className="size-[18px] mt-0.5 text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
        <p>
          {d.startByPassed ? (
            <>
              <span className="font-semibold text-fg">Si vas a hacer una campaña, créala esta semana.</span> Meta necesita unos días para aprender a
              quién mostrarla antes de que lleguen las ventas fuertes.
            </>
          ) : (
            <>
              <span className="font-semibold text-fg">Créala antes del {dayMonth(d.startBy)}.</span> Meta necesita unos días para aprender a quién
              mostrarla antes de que lleguen las ventas fuertes.
            </>
          )}
        </p>
      </div>
    </section>
  );
}

const CONFIG_LABELS = [
  ['location', 'Ubicación'],
  ['age', 'Edad'],
  ['formats', 'Formato'],
  ['dailyBudget', 'Presupuesto'],
];

/** Mejor campaña de un objetivo con su configuración y el botón "Crear una igual" (idea 4). */
function WinnerCard({ best: b, money, copied, onCopy }) {
  const cfg = b.config;
  const value = (key) => {
    if (!cfg?.[key] || (Array.isArray(cfg[key]) && !cfg[key].length)) return null;
    if (key === 'dailyBudget') return `${money(cfg.dailyBudget)} al día`;
    if (key === 'formats') return cfg.formats.join(', ');
    return cfg[key];
  };
  const rows = CONFIG_LABELS.map(([key, label]) => [label, value(key)]).filter(([, v]) => v);
  return (
    <section className="bg-surface border border-line rounded-2xl p-4 shadow-xs flex flex-col gap-3">
      <div className="grid grid-cols-[36px_1fr] gap-3 items-start">
        <span className="size-9 grid place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
          <Trophy className="size-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">La mejor de {b.objective}</p>
          <h3 className="text-base font-semibold text-fg break-words">{b.name}</h3>
          <p className="text-[13px] text-muted">
            <span className="font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">{b.costPerResult}</span> {b.unit} · {b.detail}
          </p>
        </div>
      </div>
      {rows.length > 0 && (
        <dl className="grid grid-cols-2 gap-2">
          {rows.map(([label, v]) => (
            <div key={label} className="bg-surface-2 rounded-xl px-3 py-2 min-w-0">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="text-sm font-semibold text-fg break-words">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {copied ? (
        <div className="text-[13px] text-fg-2 leading-relaxed">
          Listo: creamos <span className="font-semibold text-fg">&quot;{b.name} (copia AdsGuard)&quot;</span> en pausa. Cámbiale el anuncio y actívala.
          {copied.url && (
            <a
              href={copied.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex w-fit items-center gap-1.5 font-semibold text-indigo-600 dark:text-indigo-300 underline underline-offset-4"
            >
              Abrir en Meta <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      ) : (
        onCopy && (
          <>
            <Button variant="secondary" icon={Copy} onClick={() => onCopy(b)} loading={copied === false}>
              Crear una campaña igual
            </Button>
            <p className="text-xs text-muted -mt-1">Queda en pausa, con la misma configuración y los mismos anuncios. Tú decides cuándo activarla.</p>
          </>
        )
      )}
    </section>
  );
}

/** Lo que funciona: próximas fechas y las mejores campañas para repetir. */
export function WorksTab({ evaluation, money, copies, onCopy }) {
  const { best = [], dates = [] } = evaluation;
  return (
    <div className="flex flex-col gap-4 motion-safe:animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-fg">Lo que funciona</h2>
        <p className="text-sm text-muted mt-0.5">Lo que ya te dio resultados, para repetirlo.</p>
      </div>

      {dates.length > 0 && (
        <>
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            Próximas fechas
          </h3>
          {dates.slice(0, 3).map((d) => (
            <DateCard key={d.key} date={d} />
          ))}
        </>
      )}

      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted mt-1">
        <Trophy className="size-3.5" aria-hidden="true" />
        Tus mejores campañas · 18 meses
      </h3>
      {best.length ? (
        best.map((b) => <WinnerCard key={b.id} best={b} money={money} copied={copies[b.id]} onCopy={onCopy} />)
      ) : (
        <p className="text-sm text-muted bg-surface border border-line rounded-2xl p-4">
          Todavía no hay una campaña que podamos recomendarte repetir. Aparecen aquí las que consiguieron al menos 10 resultados sin alertas en los
          últimos 18 meses.
        </p>
      )}
    </div>
  );
}
