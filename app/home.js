'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';
import { Bell, ChevronRight, LogOut, Pause, RefreshCw, Search, ShieldCheck, Sparkles, TriangleAlert, Wallet, X } from 'lucide-react';
import { evaluateAccount } from '@/lib/alerts';
import { evaluateMetaAccount } from '@/lib/alerts-meta';
import { DEMO_ACCOUNT, DEMO_CAMPAIGNS, DEMO_CONTEXT } from '@/lib/demo-data';
import { Dashboard } from './components/dashboard';
import { demoViewData, trackDemo } from './components/demo-track';
import { DONE_KEY, readDone } from './components/today';
import { GoogleLogo, MetaLogo } from './components/brand-icons';
import { ThemeToggle } from './components/theme';
import { Alert, Button, LoadingState, StateCard } from './components/ui';

function readStoredAccount(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Lo que el usuario gana por venta (Protección). Se guarda sólo en este navegador, por cuenta. */
function useProfit(accountKey) {
  const key = `adsguard.gananciaPorVenta.${accountKey}`;
  const [profit, setProfit] = useState(() => Number(readStoredAccount(key)) || 0);
  const change = useCallback(
    (value) => {
      setProfit(value);
      storeAccount(key, value ? String(value) : null);
    },
    [key]
  );
  return [profit, change];
}

const profitKey = (sourceId, accountId) => `adsguard.gananciaPorVenta.${sourceId}.${accountId}`;

/**
 * Meta: ganancia por venta y tareas de Hoy hechas, guardadas en la base de datos (docs/SPEC.md §9).
 * La primera vez sube lo que hubiera en este navegador y lo borra de aquí. Si la base de datos
 * no responde se sigue con el navegador, como antes. Google y la demo usan sólo el navegador.
 */
function useAccountSettings(source, account, post) {
  const enabled = source.id === 'meta';
  const [localProfit, setLocalProfit] = useProfit(`${source.id}.${account.id}`);
  // null: cargando (o Google); false: la base de datos falló; si no, { profit, done }.
  const [remote, setRemote] = useState(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const saved = await fetchJson(`${source.api}/settings?accountId=${encodeURIComponent(account.id)}`);
      let profit = saved.profitPerSale ?? 0;
      const done = new Set(saved.doneTasks);
      const key = profitKey(source.id, account.id);
      const stored = Number(readStoredAccount(key)) || 0;
      if (stored > 0 && !profit) {
        await post('/settings', { accountId: account.id, profitPerSale: stored });
        profit = stored;
      }
      storeAccount(key, null);
      const pending = [...readDone()].filter((id) => !done.has(id));
      if (pending.length) {
        await post('/tasks', { accountId: account.id, keys: pending });
        pending.forEach((id) => done.add(id));
      }
      try {
        localStorage.removeItem(DONE_KEY);
      } catch {}
      return { profit, done };
    })().then(
      (value) => !cancelled && setRemote(value),
      () => !cancelled && setRemote(false)
    );
    return () => {
      cancelled = true;
    };
    // `post` cambia en cada render; la carga sólo depende de la cuenta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, source, account.id]);

  if (!remote) return { profit: localProfit, setProfit: setLocalProfit };
  return {
    profit: remote.profit,
    setProfit: (value) => {
      setRemote((prev) => ({ ...prev, profit: value || 0 }));
      post('/settings', { accountId: account.id, profitPerSale: value || 0 }).catch(() => {});
    },
    doneTasks: remote.done,
    markTaskDone: (id) => {
      setRemote((prev) => ({ ...prev, done: new Set(prev.done).add(id) }));
      post('/tasks', { accountId: account.id, keys: [id] }).catch(() => {});
    },
  };
}

function storeAccount(key, id) {
  try {
    if (id) localStorage.setItem(key, id);
    else localStorage.removeItem(key);
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

// Lo que cambia entre Google Ads y Meta Ads; el resto del flujo (cuentas → panel) es el mismo.
const SOURCES = {
  google: {
    id: 'google',
    provider: 'google',
    label: 'Google',
    Logo: GoogleLogo,
    api: '/api/google-ads',
    storageKey: 'adguard.customerId',
    params: (a) => ({ customerId: a.id, ...(a.loginCustomerId && { loginCustomerId: a.loginCustomerId }) }),
    evaluate: (data) => evaluateAccount(data.campaigns, { currency: data.account.currency }),
    extraActions: false,
    formatId: (id) => id.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3'),
    searching: 'Buscando tus cuentas de Google Ads…',
    accountsLabel: 'cuentas de Google Ads con anuncios',
    noAccounts: 'No encontramos cuentas de Google Ads asociadas a este usuario de Google. ¿Entraste con el correo correcto?',
  },
  meta: {
    id: 'meta',
    provider: 'facebook',
    label: 'Meta',
    Logo: MetaLogo,
    api: '/api/meta-ads',
    storageKey: 'adguard.metaAccountId',
    params: (a) => ({ accountId: a.id }),
    evaluate: (data, profitPerSale) => evaluateMetaAccount(data.campaigns, { currency: data.account.currency, context: data.context, profitPerSale }),
    extraActions: true,
    formatId: (id) => `ID ${id}`,
    searching: 'Buscando tus cuentas publicitarias de Meta…',
    accountsLabel: 'cuentas publicitarias de Meta',
    noAccounts: 'No encontramos cuentas publicitarias asociadas a este usuario de Facebook. ¿Entraste con el perfil correcto?',
  },
};

// Por ahora sólo Meta; para volver a ofrecer Google basta con agregarlo aquí:
// { id: 'google', label: 'Continuar con Google', Logo: GoogleLogo },
const PROVIDERS = [
  { id: 'facebook', label: 'Continuar con Meta', Logo: MetaLogo },
];

const CANCELLED = 'La conexión no se completó. Si cancelaste o desmarcaste algún permiso, vuelve a intentarlo y acéptalos todos.';

// Códigos con los que next-auth vuelve a la página (pages.error en lib/auth.js).
const LOGIN_ERRORS = {
  OAuthSignin: 'No pudimos abrir la ventana de inicio de sesión. Intenta de nuevo en un momento.',
  OAuthCallback: CANCELLED,
  Callback: CANCELLED, // p. ej. el usuario canceló en el diálogo de Meta
  AccessDenied: 'No se concedió el acceso. Vuelve a intentarlo y acepta los permisos para que podamos revisar tus anuncios.',
  Configuration: 'Hay un problema de configuración de nuestro lado. Ya nos llegó el aviso; intenta más tarde.',
};

function LoginButtons() {
  const [connecting, setConnecting] = useState(null);
  const connect = (id) => {
    setConnecting(id);
    signIn(id);
  };
  return (
    <div className={`grid gap-3 ${PROVIDERS.length > 1 ? 'sm:grid-cols-2' : ''}`}>
      {PROVIDERS.map(({ id, label, Logo }) => (
        <Button
          key={id}
          size="lg"
          variant="secondary"
          icon={Logo}
          loading={connecting === id}
          disabled={connecting !== null}
          onClick={() => connect(id)}
          className="w-full text-fg"
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

function Header({ subtitle, right }) {
  return (
    <header className="sticky top-0 z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-3 mb-6 bg-page/80 backdrop-blur-md border-b border-line">
      <div className="flex justify-between items-center gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-9 shrink-0 grid place-items-center rounded-xl bg-linear-to-br from-indigo-500 to-emerald-500 text-white shadow-sm shadow-indigo-500/30">
            <Wallet className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold text-fg leading-tight">AdSmart</h1>
            <p className="text-xs text-muted truncate">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          {right}
        </div>
      </div>
    </header>
  );
}

function ErrorState({ source, error, onRetry }) {
  const reauth = error.code === 'REAUTH';
  return (
    <StateCard
      tone={reauth ? 'warning' : 'danger'}
      icon={reauth ? RefreshCw : TriangleAlert}
      title={reauth ? `Necesitamos que vuelvas a conectar ${source.label}` : 'No pudimos cargar tus datos'}
      action={
        reauth ? (
          <Button variant="secondary" icon={source.Logo} onClick={() => signIn(source.provider)}>
            Volver a conectar
          </Button>
        ) : (
          <Button icon={RefreshCw} onClick={onRetry}>
            Reintentar
          </Button>
        )
      }
    >
      {error.message}
    </StateCard>
  );
}

const FEATURES = [
  { Icon: Search, text: 'Revisamos tus campañas de los últimos 30 días' },
  { Icon: Bell, text: 'Te avisamos cuáles gastan sin traer clientes' },
  { Icon: Pause, text: 'Las pausas con un botón, cuando tú lo decidas' },
];

function Landing({ onDemo, notice }) {
  return (
    <div className="py-8 sm:py-14 text-center motion-safe:animate-fade-in">
      {notice}
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 dark:text-indigo-300 dark:bg-indigo-500/10 dark:border-indigo-500/20 px-3 py-1 rounded-full">
        <Sparkles className="size-3.5" aria-hidden="true" />
        Para negocios que anuncian en Facebook e Instagram
      </span>
      <h2 className="mt-5 text-3xl sm:text-4xl font-bold tracking-tight text-fg text-balance">
        Deja de pagar por anuncios que no te traen clientes
      </h2>
      <p className="mt-4 text-base text-muted leading-relaxed text-pretty max-w-md mx-auto">
        Conecta tu cuenta de Meta y te mostramos, en lenguaje simple, dónde se está yendo tu dinero.
      </p>

      <div className="mt-8 max-w-md mx-auto">
        <LoginButtons />
        <button
          onClick={onDemo}
          className="mt-4 text-sm font-medium text-muted hover:text-fg underline underline-offset-4 decoration-line-strong cursor-pointer"
        >
          Ver demo con campañas de Meta de ejemplo
        </button>
      </div>

      <ul className="mt-12 grid gap-3 text-left">
        {FEATURES.map(({ Icon, text }) => (
          <li key={text} className="flex items-center gap-3 bg-surface border border-line rounded-2xl px-4 py-3 shadow-xs">
            <span className="size-9 shrink-0 grid place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
              <Icon className="size-4.5" aria-hidden="true" />
            </span>
            <span className="text-sm text-fg-2">{text}</span>
          </li>
        ))}
      </ul>

      <p className="mt-8 inline-flex items-center gap-1.5 text-xs text-muted">
        <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        Nunca cambiamos nada en tu cuenta sin que lo confirmes.
      </p>
    </div>
  );
}

/** Marca como pausados los anuncios o conjuntos de una campaña, para reevaluarla sin volver a pedir los datos. */
function withPartsPaused(campaigns, campaignId, ids) {
  const off = new Set(ids);
  return campaigns.map((c) =>
    c.id === campaignId && c.parts
      ? { ...c, parts: Object.fromEntries(Object.entries(c.parts).map(([level, list]) => [level, list.map((p) => (off.has(p.id) ? { ...p, active: false } : p))])) }
      : c
  );
}

// Guardias y tope de la demo: se simulan en el navegador.
function demoProtection(prev, body) {
  const guards = { ...prev.guards };
  if (body.action === 'guard-on') guards[body.key] = { active: true, amount: body.amount, profit: body.profit, ruleIds: [] };
  if (body.action === 'guard-off') guards[body.key] = { active: false, ruleIds: [] };
  if (body.action === 'cap-set') return { ...prev, guards, spendCap: body.amount };
  if (body.action === 'cap-reset') return { ...prev, guards, amountSpent: 0 };
  if (body.action === 'cap-delete') return { ...prev, guards, spendCap: 0, amountSpent: 0 };
  return { ...prev, guards };
}

function DemoView() {
  const [campaigns, setCampaigns] = useState(DEMO_CAMPAIGNS);
  const [protection, setProtection] = useState(DEMO_CONTEXT.protection);
  const [profit, setDemoProfit] = useProfit('demo');
  const profitTimer = useRef(null);
  // Se escribe de a un dígito: se registra cuando deja de escribir.
  const setProfit = (value) => {
    setDemoProfit(value);
    clearTimeout(profitTimer.current);
    profitTimer.current = setTimeout(() => trackDemo('profit_set'), 1500);
  };
  useEffect(() => trackDemo('view', demoViewData()), []);
  const evaluation = useMemo(
    () => evaluateMetaAccount(campaigns, { currency: DEMO_ACCOUNT.currency, context: DEMO_CONTEXT, profitPerSale: profit }),
    [campaigns, profit]
  );

  const actions = useMemo(
    () => ({
      setStatus: async (campaign, status) => {
        trackDemo(status === 'ENABLED' ? 'enable' : 'pause', { campaignId: campaign.id });
        setCampaigns((prev) => prev.map((c) => (c.id === campaign.id ? { ...c, status: status === 'ENABLED' ? 'active' : 'paused' } : c)));
      },
      setPartStatus: async (campaign, parts) => {
        trackDemo('part_pause', { campaignId: campaign.id });
        setCampaigns((prev) => withPartsPaused(prev, campaign.id, parts.map((p) => p.id)));
      },
      copyCampaign: async (campaignId) => {
        trackDemo('copy', { campaignId });
        return {};
      },
      loadConfig: async (campaign) => DEMO_CONTEXT.configs[campaign.id] ?? null,
      protection: async (body) => {
        trackDemo('protection', { action: body.action, key: body.key });
        setProtection((prev) => demoProtection(prev, body));
      },
    }),
    []
  );

  return (
    <>
      <Alert
        tone="info"
        title="Estás viendo campañas de Meta de ejemplo"
        className="mb-6"
        action={
          <Button
            size="sm"
            variant="secondary"
            icon={MetaLogo}
            onClick={() => {
              trackDemo('connect_click');
              signIn('facebook', { callbackUrl: '/' });
            }}
          >
            Conectar Meta
          </Button>
        }
      >
        Pausar, copiar o activar guardias aquí no cambia nada real. Conecta tu cuenta de Meta para revisar tus propias campañas de Facebook e
        Instagram.
      </Alert>
      <Dashboard
        account={DEMO_ACCOUNT}
        evaluation={evaluation}
        actions={actions}
        platform="meta"
        profit={profit}
        onProfitChange={setProfit}
        protection={protection}
        onTrack={trackDemo}
      />
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

function AccountPicker({ source, accounts, managers, onSelect }) {
  return (
    <div className="motion-safe:animate-fade-in">
      <h2 className="text-xl font-semibold tracking-tight text-fg">¿Qué cuenta quieres revisar?</h2>
      <p className="text-sm text-muted mt-1 mb-5">Tienes acceso a {accounts.length} {source.accountsLabel}.</p>
      <div className="space-y-2.5">
        {accounts.map((a) => (
          <button
            key={a.id}
            onClick={() => onSelect(a.id)}
            className="group w-full flex items-center gap-3 text-left p-4 rounded-2xl bg-surface border border-line shadow-xs hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100 dark:hover:border-indigo-500/50 dark:hover:shadow-none transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            <span className="size-10 shrink-0 grid place-items-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 font-semibold">
              {a.name.trim().charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-fg truncate">{a.name}</span>
              <span className="block text-xs text-muted mt-0.5">
                {source.formatId(a.id)} · {a.currency}
                {a.testAccount && ' · cuenta de prueba'}
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-faint group-hover:text-indigo-500 transition-colors" aria-hidden="true" />
          </button>
        ))}
      </div>
      <ManagerNote managers={managers} />
    </div>
  );
}

function LiveView({ source, account, onChangeAccount }) {
  const params = source.params(account);
  // Uso interno para pruebas: ?inactivas=1 muestra también las campañas antiguas sin gasto (Meta).
  const searchParams = useSearchParams();
  const showInactive = searchParams.get('inactivas') === '1';
  // Uso interno: ?historial3=1 mide cuánto tarda y consume pedir 3 años de historial (Meta).
  const measureLongHistory = searchParams.get('historial3') === '1';
  const query = new URLSearchParams({
    ...params,
    ...(showInactive && { inactivas: '1' }),
    ...(measureLongHistory && { historial3: '1' }),
  }).toString();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const post = (path, body) =>
    fetchJson(`${source.api}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const { profit, setProfit, doneTasks, markTaskDone } = useAccountSettings(source, account, post);
  const configCache = useRef(new Map());

  const load = useCallback(() => {
    fetchJson(`${source.api}/campaigns?${query}`).then(setData, setError);
  }, [source, query]);

  useEffect(load, [load]);

  const retry = () => {
    setError(null);
    setData(null);
    load();
  };

  // Se reevalúa en el navegador para que las alertas se actualicen al pausar, activar o cambiar la ganancia por venta.
  const evaluation = useMemo(() => data && source.evaluate(data, profit), [data, source, profit]);

  const actions = {
    setStatus: async (campaign, status) => {
      // `alerts` y `cost` sólo se guardan como evento (docs/SPEC.md §9).
      const res = await post(`/campaigns/${campaign.id}/status`, {
        ...params,
        status,
        alerts: campaign.alerts?.map((a) => a.rule),
        cost: campaign.cost,
      });
      setData((prev) => ({
        ...prev,
        campaigns: prev.campaigns.map((c) => (c.id === campaign.id ? { ...c, status: res.status } : c)),
      }));
    },
    ...(source.extraActions && {
      setPartStatus: async (campaign, parts, status) => {
        const done = [];
        try {
          for (const p of parts) {
            await post(`/parts/${p.id}/status`, {
              status,
              accountId: account.id,
              campaignId: campaign.id,
              level: campaign.diagnosis?.cut?.level,
              alerts: campaign.alerts?.map((a) => a.rule),
              cost: p.cost,
            });
            done.push(p.id);
          }
        } finally {
          setData((prev) => ({ ...prev, campaigns: withPartsPaused(prev.campaigns, campaign.id, done) }));
        }
      },
      // Se pide a Meta sólo al abrir la sección, y una vez por campaña mientras la página esté abierta.
      loadConfig: async (campaign) => {
        const known = configCache.current.get(campaign.id) ?? data.context?.configs?.[campaign.id];
        if (known?.ads) return known;
        const { config } = await fetchJson(`${source.api}/campaigns/${campaign.id}/config?currency=${encodeURIComponent(data.account.currency)}`);
        configCache.current.set(campaign.id, config);
        return config;
      },
      copyCampaign: async (campaignId) => {
        const res = await post(`/campaigns/${campaignId}/copy`, { accountId: account.id });
        return {
          url: res.campaignId && `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${account.id}&selected_campaign_ids=${res.campaignId}`,
        };
      },
      protection: async (body) => {
        const next = await post('/protection', { ...body, accountId: account.id, currency: data.account.currency });
        setData((prev) => ({ ...prev, context: { ...prev.context, protection: next } }));
      },
    }),
  };

  if (error) return <ErrorState source={source} error={error} onRetry={retry} />;
  if (!evaluation) return <LoadingState>Revisando tus campañas…</LoadingState>;
  return (
    <Dashboard
      account={data.account}
      evaluation={evaluation}
      actions={actions}
      onChangeAccount={onChangeAccount}
      platform={source.id}
      hiddenCount={data.hiddenCount}
      profit={profit}
      onProfitChange={setProfit}
      doneTasks={doneTasks}
      onTaskDone={markTaskDone}
      protection={data.context?.protection}
    />
  );
}

function ConnectedView({ source }) {
  const [accounts, setAccounts] = useState(null);
  const [managers, setManagers] = useState([]);
  const [notice, setNotice] = useState(null);
  const [customerId, setCustomerId] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    fetchJson(`${source.api}/accounts`).then(({ accounts, managers = [], notice }) => {
      setAccounts(accounts);
      setManagers(managers);
      setNotice(notice);
      const stored = readStoredAccount(source.storageKey);
      if (accounts.some((a) => a.id === stored)) setCustomerId(stored);
      else if (accounts.length === 1) setCustomerId(accounts[0].id);
    }, setError);
  }, [source]);

  useEffect(load, [load]);

  const select = (id) => {
    storeAccount(source.storageKey, id);
    setCustomerId(id);
  };

  const retry = () => {
    setError(null);
    load();
  };

  if (error) return <ErrorState source={source} error={error} onRetry={retry} />;
  if (!accounts) return <LoadingState>{source.searching}</LoadingState>;
  if (accounts.length === 0) {
    return (
      <>
        <StateCard icon={Search} title="No encontramos cuentas con anuncios">
          {notice ||
            (managers.length > 0
              ? 'Tu usuario sólo tiene acceso a una cuenta de administrador, sin cuentas con anuncios debajo.'
              : source.noAccounts)}
        </StateCard>
        <ManagerNote managers={managers} />
      </>
    );
  }
  if (!customerId) return <AccountPicker source={source} accounts={accounts} managers={managers} onSelect={select} />;

  const account = accounts.find((a) => a.id === customerId);
  return (
    <>
      <div className="flex items-center gap-3 mb-6 p-3 pr-2 rounded-2xl bg-surface border border-line shadow-xs">
        <span className="size-9 shrink-0 grid place-items-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 text-sm font-semibold">
          {account.name.trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg truncate">{account.name}</p>
          <p className="text-xs text-muted">{source.formatId(account.id)}</p>
        </div>
        {accounts.length > 1 && (
          <Button size="sm" variant="ghost" onClick={() => select(null)} className="shrink-0">
            Cambiar
          </Button>
        )}
      </div>
      <LiveView key={customerId} source={source} account={account} onChangeAccount={accounts.length > 1 ? () => select(null) : null} />
    </>
  );
}

function LoginError({ code, onDismiss }) {
  return (
    <Alert tone="danger" title="No pudimos conectar tu cuenta" onDismiss={onDismiss} className="mb-8 text-left">
      {LOGIN_ERRORS[code] || 'Algo falló al iniciar sesión. Intenta de nuevo.'}
    </Alert>
  );
}

function Home({ demo }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const loginError = useSearchParams().get('error');
  const authenticated = status === 'authenticated';
  const google = authenticated && session?.hasGoogleAds;
  const meta = authenticated && !google && session?.hasMetaAds;

  const headerAction = demo ? (
    <Button
      size="sm"
      variant="ghost"
      icon={X}
      onClick={() => {
        trackDemo('exit');
        router.push('/');
      }}
    >
      Salir<span className="hidden sm:inline">&nbsp;de la demo</span>
    </Button>
  ) : authenticated ? (
    <Button size="sm" variant="ghost" icon={LogOut} onClick={() => signOut()}>
      Salir
    </Button>
  ) : null;

  const subtitle = demo
    ? 'Modo demo · datos de ejemplo'
    : google
      ? 'Conectado con Google Ads'
      : meta
        ? 'Conectado con Meta'
        : 'Control de Anuncios Express';

  // Sesión iniciada pero sin token de anuncios: el usuario no concedió los permisos.
  const notice =
    authenticated && !google && !meta ? (
      <Alert tone="warning" title="Falta el permiso para ver tus anuncios" className="mb-8 text-left">
        Iniciaste sesión, pero no recibimos acceso a tus anuncios. Vuelve a conectar y deja marcados todos los permisos.
      </Alert>
    ) : loginError ? (
      <LoginError code={loginError} onDismiss={() => router.replace('/', { scroll: false })} />
    ) : null;

  return (
    <main className="min-h-screen px-4 md:px-6 pb-16 max-w-2xl mx-auto w-full">
      <Header subtitle={subtitle} right={headerAction} />
      {demo ? (
        <DemoView />
      ) : status === 'loading' ? (
        <LoadingState>Cargando…</LoadingState>
      ) : google ? (
        <ConnectedView key="google" source={SOURCES.google} />
      ) : meta ? (
        <ConnectedView key="meta" source={SOURCES.meta} />
      ) : (
        <Landing onDemo={() => router.push('/demo')} notice={notice} />
      )}
    </main>
  );
}

// useSearchParams necesita un Suspense para que la página siga siendo estática.
// `demo`: la ruta /demo muestra siempre los datos de ejemplo, aunque haya sesión iniciada.
export function HomePage({ demo = false }) {
  return (
    <Suspense fallback={<LoadingState>Cargando…</LoadingState>}>
      <Home demo={demo} />
    </Suspense>
  );
}
