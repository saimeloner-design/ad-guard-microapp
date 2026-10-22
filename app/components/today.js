'use client';

import { useMemo, useState } from 'react';
import { formatMoney, SEVERITY } from '@/lib/alerts';
import { CalendarDays, ChevronRight, Coins, PartyPopper, ShieldCheck } from 'lucide-react';
import { AlertBox, levelOf } from './campaign';
import { Alert, Button } from './ui';

const DONE_KEY = 'adsguard.tareasHechas';

function readDone() {
  try {
    return new Set(JSON.parse(localStorage.getItem(DONE_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function storeDone(set) {
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify([...set].slice(-200)));
  } catch {}
}

/**
 * Tareas de Hoy (idea 11), de la más urgente a la menos: pausar campañas, pausar
 * anuncios que gastan sin resultados, revisar campañas nuevas y revisar alertas.
 * Las que se resuelven con un botón desaparecen solas al hacerlo; las demás se
 * marcan como hechas y eso se recuerda en el navegador.
 */
function buildTasks(campaigns, actions) {
  const active = campaigns.filter((c) => c.status === 'active').sort((a, b) => b.cost - a.cost);
  const tasks = [];
  for (const c of active.filter((c) => levelOf(c) === 'pause')) {
    tasks.push({
      id: `pausar:${c.id}`,
      title: `Pausa "${c.name}"`,
      text: c.alerts.find((a) => a.severity === SEVERITY.PAUSE).message,
      action: { label: 'Pausar campaña', danger: true, run: () => actions.toggle(c) },
      campaignId: c.id,
    });
  }
  for (const c of active.filter((c) => levelOf(c) !== 'pause' && c.diagnosis?.cut && actions.pauseParts)) {
    const wasted = c.diagnosis.cut.parts.filter((p) => p.wasted);
    const what = c.diagnosis.cut.level === 'ad' ? ['el anuncio', 'anuncios'] : ['el conjunto de anuncios', 'conjuntos de anuncios'];
    tasks.push({
      id: `parte:${wasted.map((p) => p.id).join(',')}`,
      title: wasted.length === 1 ? `Pausa ${what[0]} "${wasted[0].name}"` : `Pausa ${wasted.length} ${what[1]} de "${c.name}"`,
      text: `${c.diagnosis.cut.title}. El resto de la campaña sí trae resultados.`,
      action: { label: wasted.length === 1 ? 'Pausar anuncio' : 'Pausarlos', danger: true, run: () => actions.pauseParts(c, wasted) },
      campaignId: c.id,
    });
  }
  for (const c of active.filter((c) => c.setup?.problems)) {
    const first = c.setup.checks.find((ch) => ch.status !== 'ok');
    tasks.push({
      id: `nueva:${c.id}`,
      title: `Revisa tu campaña nueva "${c.name}"`,
      text: `${first.title}. ${first.detail}`,
      action: { label: 'Ver la revisión', open: c.id },
      canMarkDone: true,
    });
  }
  for (const c of active.filter((c) => levelOf(c) === 'review' && c.alerts.length)) {
    tasks.push({
      id: `revisar:${c.id}:${c.alerts.map((a) => a.rule).join(',')}`,
      title: `Revisa "${c.name}"`,
      text: c.diagnosis?.fix?.title ? `${c.alerts[0].title}. ${c.diagnosis.fix.title}.` : c.alerts[0].message,
      action: { label: 'Ver qué cambiar', open: c.id },
      canMarkDone: true,
    });
  }
  return tasks;
}

function Counts({ campaigns, onGo }) {
  const active = campaigns.filter((c) => c.status === 'active');
  const n = (level) => active.filter((c) => levelOf(c) === level).length;
  const items = [
    { level: 'pause', label: 'para pausar', className: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
    { level: 'review', label: 'para revisar', className: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400' },
    { level: 'ok', label: 'van bien', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' },
    { level: 'learning', label: 'aprendiendo', className: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300', optional: true },
  ].filter((i) => !i.optional || n(i.level) > 0);
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((i) => (
        <button
          key={i.level}
          type="button"
          onClick={onGo}
          className={`text-left rounded-xl px-3 py-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-indigo-500 ${i.className}`}
        >
          <span className="block text-xl font-bold tabular-nums">{n(i.level)}</span>
          <span className="block text-xs font-semibold">{i.label}</span>
        </button>
      ))}
    </div>
  );
}

function RowCard({ icon: RowIcon, tone, title, text, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full grid grid-cols-[36px_1fr_16px] gap-3 items-center text-left bg-surface border border-line rounded-2xl p-3 shadow-xs hover:bg-surface-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-indigo-500"
    >
      <span className={`size-9 grid place-items-center rounded-xl ${tone}`}>
        <RowIcon className="size-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-fg leading-snug">{title}</span>
        <span className="block text-[13px] text-muted leading-snug mt-0.5">{text}</span>
      </span>
      <ChevronRight className="size-4 text-faint" aria-hidden="true" />
    </button>
  );
}

/** Hoy: cómo va la cuenta y una sola tarea a la vez. */
export function TodayTab({ account, evaluation, actions, profit, protection, onOpen, onGo }) {
  const { summary, campaigns, accountAlerts, dates = [] } = evaluation;
  const money = (v) => formatMoney(v, account.currency);
  const [done, setDone] = useState(readDone);
  const [later, setLater] = useState([]);

  const tasks = useMemo(() => {
    const list = buildTasks(campaigns, actions).filter((t) => !done.has(t.id));
    return [...list.filter((t) => !later.includes(t.id)), ...list.filter((t) => later.includes(t.id))];
  }, [campaigns, actions, done, later]);
  const task = tasks[0];

  const markDone = (id) => {
    const next = new Set(done).add(id);
    setDone(next);
    storeDone(next);
  };

  const nextDate = dates.find((d) => d.daysLeft <= 45);
  const hasSales = campaigns.some((c) => c.resultType === 'purchase' && c.status === 'active');
  const guardsOn = protection?.guards ? Object.values(protection.guards).filter((g) => g.active).length : null;
  const capPct = protection?.spendCap > 0 ? Math.round((protection.amountSpent / protection.spendCap) * 100) : null;
  const today = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="flex flex-col gap-4 motion-safe:animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-fg first-letter:uppercase">{today}</h2>
        <p className="text-sm text-muted mt-0.5">Lo que pasó en tus campañas en los últimos 30 días.</p>
      </div>

      <section className="bg-surface border border-line rounded-2xl p-4 shadow-xs flex flex-col gap-3" aria-label="Resumen">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-sm text-muted">Gastaste</span>
          <span className="text-2xl font-bold tracking-tight text-fg tabular-nums">{money(summary.totalCost)}</span>
        </div>
        <Counts campaigns={campaigns} onGo={() => onGo('campanas')} />
        {summary.potentialSavings > 0 && (
          <p className="text-[13px] text-fg-2">
            Si pausas las que gastan sin resultados, ahorras unos{' '}
            <span className="font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">{money(summary.potentialSavings)}</span> al mes.
          </p>
        )}
      </section>

      {accountAlerts.map((a) => (
        <AlertBox key={a.rule} alert={a} />
      ))}

      {task ? (
        <section
          aria-live="polite"
          className="rounded-2xl p-4 flex flex-col gap-3 bg-linear-to-br from-indigo-50 to-emerald-50 border border-indigo-100 dark:from-indigo-500/15 dark:to-emerald-500/10 dark:border-indigo-500/20"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Hoy haz esto</span>
            <span className="text-xs text-muted tabular-nums">{tasks.length === 1 ? 'la última' : `1 de ${tasks.length}`}</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-fg leading-snug break-words">{task.title}</h3>
            <p className="text-sm text-fg-2 leading-relaxed mt-1">{task.text}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={task.action.danger ? 'danger' : 'primary'}
              onClick={() => (task.action.open ? onOpen(task.action.open) : task.action.run())}
            >
              {task.action.label}
            </Button>
            {task.campaignId && (
              <Button variant="secondary" onClick={() => onOpen(task.campaignId)}>
                Ver por qué
              </Button>
            )}
            {task.canMarkDone && (
              <Button variant="secondary" onClick={() => markDone(task.id)}>
                Ya lo hice
              </Button>
            )}
            {tasks.length > 1 && (
              <Button variant="ghost" onClick={() => setLater((prev) => [...prev.filter((id) => id !== task.id), task.id])}>
                Después
              </Button>
            )}
          </div>
        </section>
      ) : (
        <Alert tone="success" icon={PartyPopper} title="Listo por hoy">
          {summary.activeCount ? 'No queda nada urgente en tus campañas.' : 'No tienes campañas activas, así que hoy no estás gastando.'}
        </Alert>
      )}

      {(nextDate || (hasSales && !profit) || protection) && (
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted mt-1">También para ti</h3>
      )}
      {hasSales && !profit && (
        <RowCard
          icon={Coins}
          tone="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"
          title="¿Cuánto ganas por cada venta?"
          text="Con ese dato te decimos si cada campaña te hace ganar o perder plata."
          onClick={() => onGo('proteccion')}
        />
      )}
      {nextDate && (
        <RowCard
          icon={CalendarDays}
          tone="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"
          title={`${nextDate.name}, ${nextDate.daysLeft === 0 ? 'hoy' : nextDate.daysLeft === 1 ? 'mañana' : `en ${nextDate.daysLeft} días`}`}
          text={
            nextDate.past
              ? `El año pasado "${nextDate.past.name}" consiguió ${nextDate.past.results} ${nextDate.past.label}. Mira qué repetir.`
              : 'Mira cuándo conviene crear la campaña.'
          }
          onClick={() => onGo('funciona')}
        />
      )}
      {protection && (
        <RowCard
          icon={ShieldCheck}
          tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
          title={guardsOn === null ? 'Protección' : guardsOn ? `${guardsOn} ${guardsOn === 1 ? 'guardia activa' : 'guardias activas'}` : 'Sin guardias activas'}
          text={capPct !== null ? `Llevas el ${capPct}% de tu tope de gasto.` : 'Ponle un tope de gasto a tu cuenta para no llevarte sustos.'}
          onClick={() => onGo('proteccion')}
        />
      )}
    </div>
  );
}
