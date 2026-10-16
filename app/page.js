'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { evaluateAccount } from '@/lib/alerts';
import { DEMO_ACCOUNT, DEMO_CAMPAIGNS } from '@/lib/demo-data';
import { Dashboard } from './components/dashboard';

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
    <header className="flex justify-between items-center py-4 border-b border-slate-800 mb-6 gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">AdGuard Micro</h1>
        <p className="text-xs text-slate-400 truncate">{subtitle}</p>
      </div>
      {right}
    </header>
  );
}

function Message({ children, action }) {
  return (
    <div className="text-center py-12 px-4">
      <p className="text-sm text-slate-300">{children}</p>
      {action}
    </div>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <Message
      action={
        <button
          onClick={error.code === 'REAUTH' ? connectGoogle : onRetry}
          className="mt-4 px-4 py-2 rounded-lg text-sm bg-slate-800 border border-slate-700 hover:bg-slate-700"
        >
          {error.code === 'REAUTH' ? 'Volver a conectar' : 'Reintentar'}
        </button>
      }
    >
      {error.message}
    </Message>
  );
}

function Landing({ onDemo }) {
  return (
    <div className="py-10 text-center">
      <h2 className="text-2xl font-bold leading-tight">Deja de pagar por anuncios que no te traen clientes</h2>
      <p className="text-sm text-slate-400 mt-3">
        Conecta tu cuenta de Google Ads y te avisamos qué campañas están gastando tu dinero sin resultados. Las pausas con un botón.
      </p>
      <button
        onClick={connectGoogle}
        className="mt-8 w-full sm:w-auto px-6 py-3 rounded-xl font-semibold bg-blue-600 hover:bg-blue-500 text-white"
      >
        Conectar con Google Ads
      </button>
      <div className="mt-4">
        <button onClick={onDemo} className="text-sm text-slate-400 underline underline-offset-4 hover:text-slate-200">
          Ver demo con datos de ejemplo
        </button>
      </div>
      <p className="text-[11px] text-slate-500 mt-10">Nunca cambiamos nada en tu cuenta sin que lo confirmes.</p>
    </div>
  );
}

function DemoView() {
  const [campaigns, setCampaigns] = useState(DEMO_CAMPAIGNS);
  const evaluation = useMemo(() => evaluateAccount(campaigns, { currency: DEMO_ACCOUNT.currency }), [campaigns]);

  const onSetStatus = async (campaign, status) => {
    setCampaigns((prev) => prev.map((c) => (c.id === campaign.id ? { ...c, status: status === 'ENABLED' ? 'active' : 'paused' } : c)));
  };

  return <Dashboard account={DEMO_ACCOUNT} evaluation={evaluation} onSetStatus={onSetStatus} />;
}

function ManagerNote({ managers }) {
  if (managers.length === 0) return null;
  const names = managers.map((m) => m.name).join(', ');
  return (
    <div className="mt-4 text-xs text-slate-400 bg-slate-900/60 border border-slate-800 px-3 py-2.5 rounded-lg">
      ℹ️ También tienes {managers.length === 1 ? 'una cuenta de administrador' : 'cuentas de administrador'} ({names}). Ese tipo de
      cuenta (MCC) sirve para gestionar otras cuentas y para conectar apps como esta, pero no tiene anuncios propios, por eso no
      aparece en la lista.
    </div>
  );
}

function AccountPicker({ accounts, managers, onSelect }) {
  return (
    <div>
      <h2 className="text-base font-semibold mb-1">¿Qué cuenta quieres revisar?</h2>
      <p className="text-xs text-slate-400 mb-4">Tienes acceso a {accounts.length} cuentas de Google Ads con anuncios.</p>
      <div className="space-y-2">
        {accounts.map((a) => (
          <button
            key={a.id}
            onClick={() => onSelect(a.id)}
            className="w-full text-left p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-600"
          >
            <div className="text-sm font-semibold">{a.name}</div>
            <div className="text-xs text-slate-400 mt-0.5">
              {a.id.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')} · {a.currency}
              {a.testAccount && ' · cuenta de prueba'}
            </div>
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

  return (
    <>
      {error ? (
        <ErrorState error={error} onRetry={retry} />
      ) : !evaluation ? (
        <Message>Revisando tus campañas…</Message>
      ) : (
        <Dashboard account={data.account} evaluation={evaluation} onSetStatus={onSetStatus} onChangeAccount={onChangeAccount} />
      )}
    </>
  );
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
  if (!accounts) return <Message>Buscando tus cuentas de Google Ads…</Message>;
  if (accounts.length === 0) {
    return (
      <>
        <Message>
          {notice ||
            (managers.length > 0
              ? 'Tu usuario sólo tiene acceso a una cuenta de administrador, sin cuentas con anuncios debajo.'
              : 'No encontramos cuentas de Google Ads asociadas a este usuario de Google. ¿Entraste con el correo correcto?')}
        </Message>
        <ManagerNote managers={managers} />
      </>
    );
  }
  if (!customerId) return <AccountPicker accounts={accounts} managers={managers} onSelect={select} />;

  const account = accounts.find((a) => a.id === customerId);
  return (
    <>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <p className="text-sm font-semibold truncate">{account.name}</p>
        {accounts.length > 1 && (
          <button onClick={() => select(null)} className="text-xs text-slate-400 underline underline-offset-4 shrink-0">
            Cambiar de cuenta
          </button>
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
    <button onClick={() => signOut()} className="text-xs text-slate-400 hover:text-slate-200 shrink-0">
      Salir
    </button>
  ) : demo ? (
    <button onClick={() => setDemo(false)} className="text-xs text-slate-400 hover:text-slate-200 shrink-0">
      Salir de la demo
    </button>
  ) : null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 font-sans max-w-2xl mx-auto w-full">
      <Header subtitle={demo && !connected ? 'Modo demo · datos de ejemplo' : 'Control de Anuncios Express'} right={headerAction} />
      {status === 'loading' ? (
        <Message>Cargando…</Message>
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
