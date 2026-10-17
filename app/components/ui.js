'use client';

import { useEffect } from 'react';

// Íconos de trazo (estilo Lucide) para no depender de emojis, que se ven distinto en cada sistema.
const ICONS = {
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  octagon: (
    <>
      <path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86z" />
      <path d="M12 8v4M12 16h.01" />
    </>
  ),
  triangle: (
    <>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  sprout: (
    <>
      <path d="M7 20h10M10 20c5.5-2.5.8-6.4 3-10" />
      <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
      <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
    </>
  ),
  x: <path d="M18 6 6 18M6 6l12 12" />,
  refresh: (
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </>
  ),
  pause: <path d="M9 5v14M15 5v14" />,
  play: <path d="M7 4.5v15l12-7.5z" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  wallet: (
    <>
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  piggy: (
    <>
      <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z" />
      <path d="M2 9v1c0 1.1.9 2 2 2h1M16 11h.01" />
    </>
  ),
  sparkles: (
    <>
      <path d="M9.94 14.5 8.5 20l-1.44-5.5L2 13l5.06-1.5L8.5 6l1.44 5.5L15 13z" />
      <path d="M19 3v4M21 5h-4" />
    </>
  ),
};

export function Icon({ name, className = 'size-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

export function Spinner({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`animate-spin ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const BUTTON_VARIANTS = {
  primary: 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-500',
  secondary: 'bg-white text-slate-700 border border-slate-200 shadow-xs hover:bg-slate-50 hover:border-slate-300',
  ghost: 'text-slate-500 hover:text-slate-900 hover:bg-slate-100',
  danger: 'bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-500',
  success: 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-500',
};

const BUTTON_SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2 rounded-xl',
};

export function Button({ variant = 'primary', size = 'md', icon, loading, className = '', children, ...props }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex items-center justify-center font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
    >
      {loading ? <Spinner /> : icon && <Icon name={icon} className={size === 'sm' ? 'size-3.5' : 'size-4'} />}
      {children}
    </button>
  );
}

const ALERT_TONES = {
  danger: { box: 'bg-red-50 border-red-200 text-red-900', icon: 'text-red-600', name: 'octagon' },
  warning: { box: 'bg-amber-50 border-amber-200 text-amber-900', icon: 'text-amber-600', name: 'triangle' },
  info: { box: 'bg-sky-50 border-sky-200 text-sky-900', icon: 'text-sky-600', name: 'info' },
  success: { box: 'bg-emerald-50 border-emerald-200 text-emerald-900', icon: 'text-emerald-600', name: 'check' },
  neutral: { box: 'bg-slate-50 border-slate-200 text-slate-700', icon: 'text-slate-500', name: 'info' },
};

/** Aviso en línea: ícono según el tono, título opcional, texto y acción o cierre opcionales. */
export function Alert({ tone = 'info', icon, title, children, action, onDismiss, className = '' }) {
  const t = ALERT_TONES[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-xl border px-3.5 py-3 text-sm ${t.box} ${className}`}
    >
      <Icon name={icon || t.name} className={`size-5 shrink-0 mt-px ${t.icon}`} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold leading-snug">{title}</p>}
        {children && <div className={`leading-relaxed ${title ? 'mt-0.5 opacity-85' : ''}`}>{children}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Cerrar aviso"
          className="shrink-0 -mr-1 -mt-0.5 size-7 grid place-items-center rounded-lg opacity-60 hover:opacity-100 hover:bg-black/5 cursor-pointer"
        >
          <Icon name="x" className="size-4" />
        </button>
      )}
    </div>
  );
}

const STATE_TONES = {
  danger: 'bg-red-50 text-red-600 ring-red-100',
  warning: 'bg-amber-50 text-amber-600 ring-amber-100',
  neutral: 'bg-slate-100 text-slate-500 ring-slate-200/60',
  brand: 'bg-indigo-50 text-indigo-600 ring-indigo-100',
};

/** Estado de pantalla completa (vacío, error) con ícono grande, título, texto y acción. */
export function StateCard({ tone = 'neutral', icon, title, children, action }) {
  return (
    <div className="motion-safe:animate-fade-in text-center px-6 py-12 bg-white border border-slate-200/80 rounded-2xl shadow-sm">
      <div className={`mx-auto size-12 grid place-items-center rounded-2xl ring-4 ${STATE_TONES[tone]}`}>
        <Icon name={icon} className="size-6" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-slate-900">{title}</h2>
      {children && <p className="mt-1.5 text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">{children}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export function LoadingState({ children }) {
  return (
    <div role="status" className="motion-safe:animate-fade-in flex flex-col items-center justify-center gap-3 py-20 text-sm text-slate-500">
      <Spinner className="size-7 text-indigo-500" />
      {children}
    </div>
  );
}

const TOAST_TONES = {
  success: { icon: 'check', color: 'text-emerald-400' },
  danger: { icon: 'octagon', color: 'text-red-400' },
};

/** Notificación flotante abajo de la pantalla. Las de éxito se cierran solas; las de error esperan al usuario. */
export function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (toast?.tone !== 'success') return;
    const id = setTimeout(onDismiss, 4000);
    return () => clearTimeout(id);
  }, [toast, onDismiss]);

  if (!toast) return null;
  const t = TOAST_TONES[toast.tone];
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-4 flex justify-center pointer-events-none">
      <div
        role={toast.tone === 'danger' ? 'alert' : 'status'}
        className="motion-safe:animate-slide-up pointer-events-auto w-full max-w-md flex gap-3 items-start rounded-2xl bg-slate-900 text-white px-4 py-3.5 shadow-2xl shadow-slate-900/30"
      >
        <Icon name={t.icon} className={`size-5 shrink-0 mt-px ${t.color}`} />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">{toast.title}</p>
          {toast.message && <p className="mt-0.5 text-slate-300 leading-relaxed">{toast.message}</p>}
        </div>
        <button
          onClick={onDismiss}
          aria-label="Cerrar"
          className="shrink-0 -mr-1 size-7 grid place-items-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
        >
          <Icon name="x" className="size-4" />
        </button>
      </div>
    </div>
  );
}
