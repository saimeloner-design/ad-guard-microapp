'use client';

import { useState } from 'react';
import { roundAmount } from '@/lib/guards-meta';
import { Coins, ShieldCheck, Wallet } from 'lucide-react';
import { Alert, Button } from './ui';

const digits = (s) => Number(String(s).replace(/\D/g, '')) || 0;
const grouped = (n) => (n ? n.toLocaleString('es-CL') : '');

function MoneyInput({ id, value, onChange, label }) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <span className="text-lg font-semibold text-muted" aria-hidden="true">
        $
      </span>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={grouped(value)}
        placeholder="0"
        onChange={(e) => onChange(digits(e.target.value))}
        className="w-36 min-w-0 rounded-xl border border-line bg-surface-2 px-3 py-2 text-lg font-semibold tabular-nums text-fg focus:outline-2 focus:outline-indigo-500"
      />
    </div>
  );
}

function Card({ icon: CardIcon, tone, title, text, children }) {
  return (
    <section className="bg-surface border border-line rounded-2xl p-4 shadow-xs flex flex-col gap-3">
      <div className="grid grid-cols-[36px_1fr] gap-3 items-start">
        <span className={`size-9 grid place-items-center rounded-xl ${tone}`}>
          <CardIcon className="size-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-fg">{title}</h3>
          <p className="text-[13px] text-muted leading-snug mt-0.5">{text}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Switch({ checked, disabled, busy, onChange, labelledBy }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled || busy}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 w-11 h-6 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${checked ? 'bg-emerald-500' : 'bg-line-strong'} ${busy ? 'animate-pulse' : ''}`}
    >
      <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

/** Monto sugerido para las guardias: el doble del costo por resultado típico, o 3 días de gasto. */
function suggestedAmount(campaigns, totalCost) {
  const costs = campaigns.filter((c) => c.costPerResult > 0 && c.resultType !== 'reach').map((c) => c.costPerResult).sort((a, b) => a - b);
  const median = costs.length ? costs[Math.floor(costs.length / 2)] : 0;
  return roundAmount(median ? 2 * median : (3 * totalCost) / 30) || 0;
}

/**
 * Protección: cuánto gana el usuario por venta (idea 9), guardias (idea 1) y tope de gasto (idea 2).
 * `onProtection(body)` hace el cambio en Meta y devuelve el estado nuevo; `confirm(opts)` pide confirmación.
 */
export function ProtectionTab({ evaluation, money, profit, onProfitChange, protection, onProtection, confirm, notify }) {
  const { summary, campaigns } = evaluation;
  const guards = protection?.guards;
  const activeAmount = guards?.noResults?.amount ?? guards?.adNoResults?.amount;
  const [amount, setAmount] = useState(() => activeAmount || suggestedAmount(campaigns, summary.totalCost));
  const [capInput, setCapInput] = useState(() => protection?.spendCap || roundAmount(summary.totalCost * 1.2) || 0);
  const [editingCap, setEditingCap] = useState(false);
  const [busy, setBusy] = useState(null);

  const run = async (key, body, success) => {
    setBusy(key);
    try {
      await onProtection(body);
      notify({ tone: 'success', title: success });
    } catch (e) {
      notify({ tone: 'danger', title: 'No pudimos hacer el cambio en Meta', message: e.message });
    } finally {
      setBusy(null);
    }
  };

  const GUARD_ROWS = [
    {
      key: 'noResults',
      title: `Pausar campañas que gastan ${money(amount)} en 7 días sin ningún resultado`,
      text: 'Lo mismo que te avisamos con "Gasta dinero sin traer resultados", pero sin esperar a que entres.',
      values: { amount },
      ready: amount > 0,
      confirmText: `Meta va a pausar sola cualquier campaña que gaste más de ${money(amount)} en 7 días sin conseguir ningún resultado.`,
      stale: guards?.noResults?.active && guards.noResults.amount !== amount,
    },
    {
      key: 'loss',
      title: 'Pausar campañas de ventas donde cada venta cuesta más de lo que ganas',
      text: profit ? `Usa tu ganancia: ${money(profit)} por venta.` : 'Primero dinos cuánto ganas por venta, arriba.',
      values: { profit },
      ready: profit > 0,
      confirmText: `Meta va a pausar sola las campañas de ventas en las que cada venta cueste más de ${money(profit)} en los últimos 7 días.`,
      stale: guards?.loss?.active && profit > 0 && guards.loss.profit !== profit,
    },
    {
      key: 'adNoResults',
      title: `Pausar anuncios que gastan ${money(amount)} en 7 días sin ningún resultado`,
      text: 'Pausa sólo el anuncio que no funciona y deja andando el resto de la campaña.',
      values: { amount },
      ready: amount > 0,
      confirmText: `Meta va a pausar solo cualquier anuncio que gaste más de ${money(amount)} en 7 días sin conseguir ningún resultado.`,
      stale: guards?.adNoResults?.active && guards.adNoResults.amount !== amount,
    },
  ];

  const toggleGuard = (row, on) => {
    if (!on) return run(row.key, { action: 'guard-off', key: row.key }, 'Guardia desactivada');
    confirm({
      tone: 'success',
      icon: ShieldCheck,
      title: '¿Activar esta guardia?',
      name: row.title,
      message: `${row.confirmText} Puedes desactivarla aquí cuando quieras.`,
      confirmLabel: 'Sí, activar',
      run: () => onProtection({ action: 'guard-on', key: row.key, ...row.values }),
      success: 'Guardia activada en Meta',
      failure: 'No pudimos activar la guardia',
    });
  };

  const cap = protection?.spendCap > 0 ? protection : null;
  const pct = cap ? Math.min(100, Math.round((cap.amountSpent / cap.spendCap) * 100)) : 0;
  const left = cap ? Math.max(0, cap.spendCap - cap.amountSpent) : 0;
  const perDay = summary.totalCost / 30;
  const daysLeft = perDay > 0 ? Math.floor(left / perDay) : null;

  const askCap = (action) => {
    const texts = {
      'cap-set': {
        title: cap ? '¿Cambiar el tope de gasto?' : '¿Poner un tope de gasto?',
        message: `Cuando lo gastado desde ${cap ? 'el último reinicio' : 'hoy'} llegue a ${money(capInput)}, Meta detiene todos tus anuncios hasta que lo subas o lo reinicies.`,
        label: 'Sí, guardar',
        success: 'Tope de gasto guardado',
      },
      'cap-reset': {
        title: '¿Empezar de cero?',
        message: `Lo gastado vuelve a contar desde hoy. El tope sigue en ${cap && money(cap.spendCap)}.`,
        label: 'Sí, empezar de cero',
        success: 'El tope vuelve a contar desde hoy',
      },
      'cap-delete': {
        title: '¿Quitar el tope de gasto?',
        message: 'Tu cuenta podrá gastar sin límite, según el presupuesto de cada campaña.',
        label: 'Sí, quitar',
        success: 'Tope de gasto quitado',
      },
    }[action];
    confirm({
      tone: action === 'cap-delete' ? 'danger' : 'success',
      icon: Wallet,
      title: texts.title,
      message: texts.message,
      confirmLabel: texts.label,
      run: async () => {
        await onProtection({ action, amount: capInput });
        setEditingCap(false);
      },
      success: texts.success,
      failure: 'No pudimos cambiar el tope',
    });
  };

  return (
    <div className="flex flex-col gap-4 motion-safe:animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-fg">Protección</h2>
        <p className="text-sm text-muted mt-0.5">Se configura una vez. Después AdsGuard y Meta cuidan tu cuenta.</p>
      </div>

      <Card
        icon={Coins}
        tone="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"
        title="¿Cuánto ganas por cada venta?"
        text="Lo que te queda después de pagar el producto, no el precio. Con esto te decimos si cada campaña de ventas te hace ganar o perder plata."
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <MoneyInput id="profit" label="Ganancia por venta" value={profit} onChange={onProfitChange} />
          <span className="text-sm text-muted">por venta</span>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          Ejemplo: vendes una torta a $25.000 y hacerla te cuesta $16.000: ganas $9.000. Se guarda sólo en este navegador.
        </p>
      </Card>

      <Card
        icon={ShieldCheck}
        tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
        title="Guardias"
        text="Reglas que Meta revisa cada 30 minutos, aunque no abras AdsGuard. Cuando pausan algo, Meta te avisa en Facebook."
      >
        {!guards ? (
          <Alert tone="warning">No pudimos leer las reglas automáticas de tu cuenta de Meta. Vuelve a intentarlo más tarde.</Alert>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <MoneyInput id="guard-amount" label="Gasto máximo sin resultados" value={amount} onChange={setAmount} />
              <span className="text-sm text-muted">sin resultados en 7 días</span>
            </div>
            <ul className="rounded-xl border border-line divide-y divide-line">
              {GUARD_ROWS.map((row) => (
                <li key={row.key} className="flex items-center gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p id={`guard-${row.key}`} className="text-sm font-semibold text-fg leading-snug">
                      {row.title}
                    </p>
                    <p className="text-xs text-muted leading-snug mt-0.5">{row.text}</p>
                    {row.stale && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-2"
                        loading={busy === row.key}
                        onClick={() => run(row.key, { action: 'guard-on', key: row.key, ...row.values }, 'Guardia actualizada')}
                      >
                        Actualizar con este monto
                      </Button>
                    )}
                  </div>
                  <Switch
                    checked={Boolean(guards[row.key]?.active)}
                    disabled={!row.ready && !guards[row.key]?.active}
                    busy={busy === row.key}
                    onChange={(on) => toggleGuard(row, on)}
                    labelledBy={`guard-${row.key}`}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card
        icon={Wallet}
        tone="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
        title="Tope de gasto de la cuenta"
        text="Lo máximo que puede gastar tu cuenta. Si se llega al tope, Meta detiene todos tus anuncios."
      >
        {cap && !editingCap ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span>
                <span className="font-semibold text-fg tabular-nums">{money(cap.amountSpent)}</span> <span className="text-muted">gastados</span>
              </span>
              <span className="text-muted">
                tope <span className="tabular-nums">{money(cap.spendCap)}</span>
              </span>
            </div>
            <div
              className="h-2.5 rounded-full bg-surface-3 overflow-hidden"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Parte del tope ya gastada"
            >
              <div className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Te quedan {money(left)}.
              {daysLeft !== null && ` A tu ritmo actual (${money(perDay)} al día) llegas al tope en unos ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditingCap(true)}>
                Cambiar tope
              </Button>
              <Button size="sm" variant="secondary" onClick={() => askCap('cap-reset')}>
                Empezar de cero
              </Button>
              <Button size="sm" variant="ghost" onClick={() => askCap('cap-delete')}>
                Quitar tope
              </Button>
            </div>
          </>
        ) : (
          <>
            {!cap && (
              <p className="text-[13px] text-fg-2 leading-relaxed">
                Hoy tu cuenta no tiene tope. En los últimos 30 días gastaste {money(summary.totalCost)}. El tope cuenta lo que gastes desde que lo pones.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <MoneyInput id="cap" label="Tope de gasto" value={capInput} onChange={setCapInput} />
              <Button disabled={!(capInput > 0)} onClick={() => askCap('cap-set')}>
                {cap ? 'Guardar tope' : 'Poner tope'}
              </Button>
              {cap && (
                <Button variant="ghost" onClick={() => setEditingCap(false)}>
                  Cancelar
                </Button>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
