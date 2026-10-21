'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatMoney } from '@/lib/alerts';
import { House, List, Pause, Play, Search, ShieldCheck, Trophy } from 'lucide-react';
import { CampaignDetail, CampaignList, levelOf, PLATFORMS } from './campaign';
import { GlossaryProvider } from './glossary';
import { ProtectionTab } from './protection';
import { TodayTab } from './today';
import { Button, StateCard, Toast } from './ui';
import { WorksTab } from './works';

const CONFIRM_TONES = {
  danger: { icon: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400', button: 'danger' },
  success: { icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400', button: 'success' },
};

/** Confirmación antes de cambiar algo en la cuenta de Meta. */
function ConfirmDialog({ opts, onConfirm, onCancel }) {
  const t = CONFIRM_TONES[opts.tone];
  const DialogIcon = opts.icon;

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
        <div className={`size-11 grid place-items-center rounded-2xl ${t.icon}`}>
          <DialogIcon className="size-5" aria-hidden="true" />
        </div>
        <h2 id="confirm-title" className="text-lg font-semibold text-fg mt-4">
          {opts.title}
        </h2>
        {opts.name && <p className="text-sm font-medium text-fg-2 mt-1 break-words">{opts.name}</p>}
        <p className="text-sm text-muted mt-3 leading-relaxed">{opts.message}</p>
        <div className="flex gap-2 mt-6">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
          <Button variant={t.button} onClick={onConfirm} className="flex-1" autoFocus>
            {opts.confirmLabel}
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

const TABS = [
  { id: 'hoy', label: 'Hoy', Icon: House },
  { id: 'campanas', label: 'Campañas', Icon: List },
  { id: 'funciona', label: 'Lo que funciona', Icon: Trophy, meta: true },
  { id: 'proteccion', label: 'Protección', Icon: ShieldCheck, meta: true },
];

/** Barra de pestañas abajo, al alcance del pulgar. */
function TabBar({ tabs, current, badge, onChange }) {
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-30 bg-surface/95 backdrop-blur-md border-t border-line pb-[env(safe-area-inset-bottom)]"
    >
      <div className="max-w-2xl mx-auto grid px-2" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map(({ id, label, Icon }) => {
          const active = current === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-semibold leading-tight cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500 rounded-lg ${active ? 'text-indigo-600 dark:text-indigo-300' : 'text-muted hover:text-fg'}`}
            >
              <span className={`grid place-items-center h-7 w-12 rounded-full transition-colors ${active ? 'bg-indigo-50 dark:bg-indigo-500/15' : ''}`}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              {label}
              {id === 'campanas' && badge > 0 && (
                <span className="absolute top-1 left-1/2 ml-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[11px] font-bold leading-[18px] text-center tabular-nums">
                  {badge}
                  <span className="sr-only"> para pausar</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

const detailFromHash = () => (typeof window === 'undefined' ? null : (window.location.hash.match(/^#campana-(\d+)$/)?.[1] ?? null));

/**
 * Panel con 4 pestañas: Hoy, Campañas, Lo que funciona y Protección (docs/SPEC.md §8).
 * `actions` (todas devuelven promesas):
 * - setStatus(campaign, 'PAUSED' | 'ENABLED')
 * - setPartStatus(campaign, parts, 'PAUSED') — anuncios o conjuntos de "Pausa solo esta parte" (Meta)
 * - copyCampaign(campaignId) → { url? } — "Crear una igual" (Meta)
 * - protection(body) — guardias y tope de gasto (Meta)
 * `hiddenCount`: campañas antiguas sin gasto en 90 días que no se muestran (Meta).
 */
export function Dashboard({ account, evaluation, actions, onChangeAccount, platform = 'google', hiddenCount = 0, profit, onProfitChange, protection }) {
  const [tab, setTab] = useState('hoy');
  const [detailId, setDetailId] = useState(null);
  const [pending, setPending] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);
  const [copies, setCopies] = useState({});
  const { campaigns } = evaluation;
  const money = useCallback((v) => formatMoney(v, account.currency), [account.currency]);
  const cancel = useCallback(() => setPending(null), []);
  const dismissToast = useCallback(() => setToast(null), []);
  const tabs = TABS.filter((t) => !t.meta || platform === 'meta');

  // El detalle de una campaña se abre con #campana-ID para que el gesto de "atrás" del celular vuelva a la lista.
  useEffect(() => {
    const sync = () => {
      const id = detailFromHash();
      setDetailId(id);
      if (id) setTab('campanas');
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const openCampaign = useCallback((id) => {
    window.history.pushState(window.history.state, '', `#campana-${id}`);
    setTab('campanas');
    setDetailId(id);
    window.scrollTo(0, 0);
  }, []);

  const closeCampaign = () => {
    if (detailFromHash()) window.history.back();
    else setDetailId(null);
  };

  const changeTab = (id) => {
    if (detailFromHash()) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    setDetailId(null);
    setTab(id);
    window.scrollTo(0, 0);
  };

  const confirm = async () => {
    const opts = pending;
    setPending(null);
    setToast(null);
    if (opts.busyId) setBusyId(opts.busyId);
    try {
      await opts.run();
      setToast({ tone: 'success', title: opts.success, message: opts.successMessage });
    } catch (e) {
      setToast({ tone: 'danger', title: opts.failure, message: e.message });
    } finally {
      setBusyId(null);
    }
  };

  const uiActions = useMemo(
    () => ({
      toggle: (c) => {
        const pausing = c.status === 'active';
        setPending({
          tone: pausing ? 'danger' : 'success',
          icon: pausing ? Pause : Play,
          title: pausing ? '¿Pausar esta campaña?' : '¿Volver a activar esta campaña?',
          name: c.name,
          message: pausing
            ? `Dejará de mostrarse y de gastar inmediatamente. En los últimos 30 días gastó ${money(c.cost)}. Puedes reactivarla cuando quieras.`
            : 'Volverá a mostrarse y a gastar según su presupuesto diario.',
          confirmLabel: pausing ? 'Sí, pausar' : 'Sí, activar',
          busyId: c.id,
          run: () => actions.setStatus(c, pausing ? 'PAUSED' : 'ENABLED'),
          success: pausing ? 'Campaña pausada' : 'Campaña activada',
          successMessage: c.name,
          failure: pausing ? 'No pudimos pausar la campaña' : 'No pudimos activar la campaña',
        });
      },
      pauseParts:
        actions.setPartStatus &&
        ((c, parts) => {
          const ad = c.diagnosis?.cut?.level !== 'adset';
          const one = parts.length === 1;
          const what = ad ? (one ? 'este anuncio' : `estos ${parts.length} anuncios`) : one ? 'este conjunto de anuncios' : `estos ${parts.length} conjuntos`;
          setPending({
            tone: 'danger',
            icon: Pause,
            title: `¿Pausar ${what}?`,
            name: parts.map((p) => p.name).join(', '),
            message: `${one ? 'Dejará' : 'Dejarán'} de mostrarse y de gastar. El resto de "${c.name}" sigue andando. Puedes volver a activar${one ? 'lo' : 'los'} desde Meta cuando quieras.`,
            confirmLabel: 'Sí, pausar',
            busyId: c.id,
            run: () => actions.setPartStatus(c, parts, 'PAUSED'),
            success: ad ? (one ? 'Anuncio pausado' : 'Anuncios pausados') : one ? 'Conjunto pausado' : 'Conjuntos pausados',
            successMessage: parts.map((p) => p.name).join(', '),
            failure: 'No pudimos pausarlo',
          });
        }),
      copyCampaign:
        actions.copyCampaign &&
        (async ({ id, name }) => {
          setCopies((prev) => ({ ...prev, [id]: false }));
          try {
            const res = await actions.copyCampaign(id);
            setCopies((prev) => ({ ...prev, [id]: { url: res?.url } }));
            setToast({ tone: 'success', title: 'Creamos una copia en pausa', message: `"${name} (copia AdSmart)". Cámbiale el anuncio en Meta y actívala.` });
          } catch (e) {
            setCopies((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
            setToast({ tone: 'danger', title: 'No pudimos crear la copia', message: e.message });
          }
        }),
    }),
    [actions, money]
  );

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

  const detail = detailId && campaigns.find((c) => c.id === detailId);
  const toPause = campaigns.filter((c) => levelOf(c) === 'pause').length;

  return (
    <GlossaryProvider>
      <div className="pb-20">
        {tab === 'hoy' && (
          <TodayTab
            account={account}
            evaluation={evaluation}
            actions={uiActions}
            profit={profit}
            protection={platform === 'meta' ? protection : null}
            onOpen={openCampaign}
            onGo={changeTab}
          />
        )}
        {tab === 'campanas' &&
          (detail ? (
            <CampaignDetail
              key={detail.id}
              campaign={detail}
              currency={account.currency}
              platform={platform}
              busy={busyId === detail.id}
              actions={uiActions}
              onBack={closeCampaign}
            />
          ) : (
            <CampaignList
              campaigns={campaigns}
              currency={account.currency}
              platform={platform}
              onOpen={openCampaign}
              footer={<HiddenNote count={hiddenCount} className="text-center" />}
            />
          ))}
        {tab === 'funciona' && <WorksTab evaluation={evaluation} money={money} copies={copies} onCopy={uiActions.copyCampaign} />}
        {tab === 'proteccion' && (
          <ProtectionTab
            evaluation={evaluation}
            money={money}
            profit={profit}
            onProfitChange={onProfitChange}
            protection={protection}
            onProtection={actions.protection}
            confirm={setPending}
            notify={setToast}
          />
        )}
      </div>

      <TabBar tabs={tabs} current={tab} badge={toPause} onChange={changeTab} />
      {pending && <ConfirmDialog opts={pending} onConfirm={confirm} onCancel={cancel} />}
      <Toast toast={toast} onDismiss={dismissToast} className="bottom-[calc(4rem+env(safe-area-inset-bottom))]" />
    </GlossaryProvider>
  );
}
