'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { evaluateAccount } from '@/lib/alerts';
import { DEMO_ACCOUNT, DEMO_CAMPAIGNS } from '@/lib/demo-data';
import { Dashboard } from './components/dashboard';
import { Alert, Button, Icon, LoadingState, StateCard } from './components/ui';

const ACCOUNT_KEY = 'adguard.customerId';

function readStoredAccount() {
  try {
    return localStorage.getItem(ACCOUNT_KEY);
  } catch {
    return null;
  }
}

function storeAccount(id) {
  try {
    if (id) localStorage.setItem(ACCOUNT_KEY, id);
    else localStorage.removeItem(ACCOUNT_KEY);
  } catch {}
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Algo salió mal. Intenta de nuevo.');
    err.code = data.code;
    throw err;
  }
  return data;
}

const connectGoogle = () => signIn('google');

function Header({ subtitle, right }) {
  return (
    <header className="sticky top-0 z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-3 mb-6 bg-slate-50/80 backdrop-blur-md border-b border-slate-200/70">
      <div className="flex justify-between items-center gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-9 shrink-0 grid place-items-center rounded-xl bg-linear-to-br from-indigo-500 to-emerald-500 text-white shadow-sm shadow-indigo-500/30">
            <Icon name="shield" className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold text-slate-900 leading-tight">AdGuard Micro</h1>
            <p className="text-xs text-slate-500 truncate">{subtitle}</p>
          </div>
        </div>
        {right}
      </div>
    </header>
  );
}

function ErrorState({ error, onRetry }) {
  const reauth = error.code === 'REAUTH';
  return (
    <StateCard
      tone={reauth ? 'warning' : 'danger'}
      icon={reauth ? 'refresh' : 'triangle'}
      title={reauth ? 'Necesitamos que vuelvas a conectar Google' : 'No pudimos cargar tus datos'}
      action={
        <Button onClick={reauth ? connectGoogle : onRetry} icon="refresh">
          {reauth ? 'Volver a conectar' : 'Reintentar'}
        </Button>
      }
    >
      {error.message}
    </StateCard>
  );
}

const FEATURES = [
  { icon: 'search', text: 'Revisamos tus campañas de los últimos 30 días' },
  { icon: 'bell', text: 'Te avisamos cuáles gastan sin traer clientes' },
  { icon: 'pause', text: 'Las pausas con un botón, cuando tú lo decidas' },
];

function Landing({ onDemo }) {
  return (
    <div className="py-8 sm:py-14 text-center motion-safe:animate-fade-in">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
        <Icon name="sparkles" className="size-3.5" />
        Para negocios que anuncian en Google
      </span>
      <h2 className="mt-5 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 text-balance">
        Deja de pagar por anuncios que no te traen clientes
      </h2>
      <p className="mt-4 text-base text-slate-500 leading-relaxed text-pretty max-w-md mx-auto">
        Conecta tu cuenta de Google Ads y te mostramos, en lenguaje simple, dónde se está yendo tu dinero.
      </p>

      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <Button size="lg" onClick={connectGoogle}>
          Conectar con Google Ads
        </Button>
        <Button size="lg" variant="secondary" onClick={onDemo}>
          Ver demo
        </Button>
      </div>

      <ul className="mt-12 grid gap-3 text-left">
        {FEATURES.map((f) => (
          <li key={f.text} className="flex items-center gap-3 bg-white border border-slate-200/80 rounded-2xl px-4 py-3 shadow-xs">
            <span className="size-9 shrink-0 grid place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <Icon name={f.icon} className="size-4.5" />
            </span>
            <span className="text-sm text-slate-700">{f.text}</span>
          </li>
        ))}
      </ul>

      <p className="mt-8 inline-flex items-center gap-1.5 text-xs text-slate-500">
        <Icon name="shield" className="size-3.5 text-emerald-600" />
        Nunca cambiamos nada en tu cuenta sin que lo confirmes.
      </p>
    </div>
  );
}

function DemoView() {
  const [campaigns, setCampaigns] = useState(DEMO_CAMPAIGNS);
  const evaluation = useMemo(() => evaluateAccount(campaigns, { currency: DEMO_ACCOUNT.currency }), [campaigns]);

  const onSetStatus = async (campaign, status) => {
    setCampaigns((prev) => prev.map((c) => (c.id === campaign.id ? { ...c, status: status === 'ENABLED' ? 'active' : 'paused' } : c)));
  };

  return (
    <>
      <Alert
        tone="info"
        title="Estás viendo datos de ejemplo"
        className="mb-6"
        action={
          <Button size="sm" onClick={connectGoogle}>
            Conectar mi cuenta
          </Button>
        }
      >
        Pausar o activar aquí no cambia nada real. Conecta tu cuenta para revisar tus propias campañas.
      </Alert>
      <Dashboard account={DEMO_ACCOUNT} evaluation={evaluation} onSetStatus={onSetStatus} />
    </>
  );
}

function ManagerNote({ managers }) {
  if (managers.length === 0) return null;
  const names = managers.map((m) => m.name).join(', ');
  return (
    <Alert tone="neutral" className="mt-4">
      También tienes {managers.length === 1 ? 'una cuenta de administrador' : 'cuentas de administrador'} ({names}). Ese tipo de
      cuenta (MCC) sirve para gestionar otras cuentas y para conectar apps como esta, pero no tiene anuncios propios, por eso no
      aparece en la lista.
    </Alert>
  );
}

const formatCustomerId = (id) => id.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');

function AccountPicker({ accounts, managers, onSelect }) {
  return (
    <div className="motion-safe:animate-fade-in">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">¿Qué cuenta quieres revisar?</h2>
      <p className="text-sm text-slate-500 mt-1 mb-5">Tienes acceso a {accounts.length} cuentas de Google Ads con anuncios.</p>
      <div className="space-y-2.5">
        {accounts.map((a) => (
          <button
            key={a.id}
            onClick={() => onSelect(a.id)}
            className="group w-full flex items-center gap-3 text-left p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            <span className="size-10 shrink-0 grid place-items-center rounded-xl bg-indigo-50 text-indigo-700 font-semibold">
              {a.name.trim().charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900 truncate">{a.name}</span>
              <span className="block text-xs text-slate-500 mt-0.5">
                {formatCustomerId(a.id)} · {a.currency}
                {a.testAccount && ' · cuenta de prueba'}
              </span>
            </span>
            <Icon name="chevron" className="size-5 shrink-0 text-slate-300 group-hover:text-indigo-500 transition-colors" />
          </button>
        ))}
      </div>
      <ManagerNote managers={managers} />
    </div>
  );
}

function LiveView({ account, onChangeAccount }) {
  const customerId = account.id;
  const loginCustomerId = account.loginCustomerId;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ customerId });
    if (loginCustomerId) params.set('loginCustomerId', loginCustomerId);
    fetchJson(`/api/google-ads/campaigns?${params}`).then(setData, setError);
  }, [customerId, loginCustomerId]);

  useEffect(load, [load]);

  const retry = () => {
    setError(null);
    setData(null);
    load();
  };

  const campaigns = data?.campaigns;
  const currency = data?.account.currency;
  const evaluation = useMemo(() => campaigns && evaluateAccount(campaigns, { currency }), [campaigns, currency]);

  const onSetStatus = async (campaign, status) => {
    const res = await fetchJson(`/api/google-ads/campaigns/${campaign.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, loginCustomerId, status }),
    });
    setData((prev) => ({
      ...prev,
      campaigns: prev.campaigns.map((c) => (c.id === campaign.id ? { ...c, status: res.status } : c)),
    }));
  };

  if (error) return <ErrorState error={error} onRetry={retry} />;
  if (!evaluation) return <LoadingState>Revisando tus campañas…</LoadingState>;
  return <Dashboard account={data.account} evaluation={evaluation} onSetStatus={onSetStatus} onChangeAccount={onChangeAccount} />;
}

function ConnectedView() {
  const [accounts, setAccounts] = useState(null);
  const [managers, setManagers] = useState([]);
  const [notice, setNotice] = useState(null);
  const [customerId, setCustomerId] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    fetchJson('/api/google-ads/accounts').then(({ accounts, managers, notice }) => {
      setAccounts(accounts);
      setManagers(managers);
      setNotice(notice);
      const stored = readStoredAccount();
      if (accounts.some((a) => a.id === stored)) setCustomerId(stored);
      else if (accounts.length === 1) setCustomerId(accounts[0].id);
    }, setError);
  }, []);

  useEffect(load, [load]);

  const select = (id) => {
    storeAccount(id);
    setCustomerId(id);
  };

  const retry = () => {
    setError(null);
    load();
  };

  if (error) return <ErrorState error={error} onRetry={retry} />;
  if (!accounts) return <LoadingState>Buscando tus cuentas de Google Ads…</LoadingState>;
  if (accounts.length === 0) {
    return (
      <>
        <StateCard icon="search" title="No encontramos cuentas con anuncios">
          {notice ||
            (managers.length > 0
              ? 'Tu usuario sólo tiene acceso a una cuenta de administrador, sin cuentas con anuncios debajo.'
              : 'No encontramos cuentas de Google Ads asociadas a este usuario de Google. ¿Entraste con el correo correcto?')}
        </StateCard>
        <ManagerNote managers={managers} />
      </>
    );
  }
  if (!customerId) return <AccountPicker accounts={accounts} managers={managers} onSelect={select} />;

  const account = accounts.find((a) => a.id === customerId);
  return (
    <>
      <div className="flex items-center gap-3 mb-6 p-3 pr-2 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <span className="size-9 shrink-0 grid place-items-center rounded-xl bg-indigo-50 text-indigo-700 text-sm font-semibold">
          {account.name.trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 truncate">{account.name}</p>
          <p className="text-xs text-slate-500">{formatCustomerId(account.id)}</p>
        </div>
        {accounts.length > 1 && (
          <Button size="sm" variant="ghost" onClick={() => select(null)} className="shrink-0">
            Cambiar
          </Button>
        )}
      </div>
      <LiveView key={customerId} account={account} onChangeAccount={accounts.length > 1 ? () => select(null) : null} />
    </>
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const [demo, setDemo] = useState(false);
  const connected = status === 'authenticated' && session?.hasGoogleAds;

  const headerAction = connected ? (
    <Button size="sm" variant="ghost" icon="logout" onClick={() => signOut()} className="shrink-0">
      Salir
    </Button>
  ) : demo ? (
    <Button size="sm" variant="ghost" icon="x" onClick={() => setDemo(false)} className="shrink-0">
      Salir de la demo
    </Button>
  ) : null;

  return (
    <main className="min-h-screen px-4 md:px-6 pb-16 max-w-2xl mx-auto w-full">
      <Header subtitle={demo && !connected ? 'Modo demo · datos de ejemplo' : 'Control de Anuncios Express'} right={headerAction} />
      {status === 'loading' ? (
        <LoadingState>Cargando…</LoadingState>
      ) : connected ? (
        <ConnectedView />
      ) : demo ? (
        <DemoView />
      ) : (
        <Landing onDemo={() => setDemo(true)} />
      )}
    </main>
  );
}
