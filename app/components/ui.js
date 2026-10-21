'use client';

import { useEffect } from 'react';
import { CircleCheck, Info, LoaderCircle, OctagonAlert, TriangleAlert, X } from 'lucide-react';

export function Spinner({ className = 'size-4' }) {
  return <LoaderCircle className={`animate-spin ${className}`} aria-hidden="true" />;
}

const BUTTON_VARIANTS = {
  primary: 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-500',
  secondary: 'bg-surface text-fg-2 border border-line shadow-xs hover:bg-surface-2 hover:border-line-strong',
  ghost: 'text-muted hover:text-fg hover:bg-surface-3',
  danger: 'bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-500',
  success: 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-500',
};

const BUTTON_SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-xl',
};

/** `icon` recibe un componente (de lucide-react o un logo de marca). */
export function Button({ variant = 'primary', size = 'md', icon: IconComponent, loading, className = '', children, ...props }) {
  const iconClass = size === 'sm' ? 'size-3.5' : size === 'lg' ? 'size-5' : 'size-4';
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex items-center justify-center font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
    >
      {loading ? <Spinner className={iconClass} /> : IconComponent && <IconComponent className={`shrink-0 ${iconClass}`} aria-hidden="true" />}
      {children}
    </button>
  );
}

const ALERT_TONES = {
  danger: {
    box: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-500/10 dark:border-red-500/25 dark:text-red-200',
    icon: 'text-red-600 dark:text-red-400',
    Icon: OctagonAlert,
  },
  warning: {
    box: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-500/10 dark:border-amber-500/25 dark:text-amber-200',
    icon: 'text-amber-600 dark:text-amber-400',
    Icon: TriangleAlert,
  },
  info: {
    box: 'bg-sky-50 border-sky-200 text-sky-900 dark:bg-sky-500/10 dark:border-sky-500/25 dark:text-sky-200',
    icon: 'text-sky-600 dark:text-sky-400',
    Icon: Info,
  },
  success: {
    box: 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-500/10 dark:border-emerald-500/25 dark:text-emerald-200',
    icon: 'text-emerald-600 dark:text-emerald-400',
    Icon: CircleCheck,
  },
  neutral: { box: 'bg-surface-2 border-line text-fg-2', icon: 'text-muted', Icon: Info },
};

/** Aviso en línea: ícono según el tono, título opcional, texto y acción o cierre opcionales. */
export function Alert({ tone = 'info', icon, title, children, action, onDismiss, className = '' }) {
  const t = ALERT_TONES[tone];
  const AlertIcon = icon || t.Icon;
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-xl border px-3.5 py-3 text-sm ${t.box} ${className}`}
    >
      <AlertIcon className={`size-5 shrink-0 mt-px ${t.icon}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold leading-snug">{title}</p>}
        {children && <div className={`leading-relaxed ${title ? 'mt-0.5 opacity-85' : ''}`}>{children}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Cerrar aviso"
          className="shrink-0 -mr-1 -mt-0.5 size-7 grid place-items-center rounded-lg opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

const STATE_TONES = {
  danger: 'bg-red-50 text-red-600 ring-red-100 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/10',
  warning: 'bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/10',
  neutral: 'bg-surface-3 text-muted ring-surface-2',
  brand: 'bg-indigo-50 text-indigo-600 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/10',
};

/** Estado de pantalla completa (vacío, error) con ícono grande, título, texto y acción. */
export function StateCard({ tone = 'neutral', icon: StateIcon, title, children, action }) {
  return (
    <div className="motion-safe:animate-fade-in text-center px-6 py-12 bg-surface border border-line rounded-2xl shadow-sm">
      <div className={`mx-auto size-12 grid place-items-center rounded-2xl ring-4 ${STATE_TONES[tone]}`}>
        <StateIcon className="size-6" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-fg">{title}</h2>
      {children && <p className="mt-1.5 text-sm text-muted leading-relaxed max-w-sm mx-auto">{children}</p>}
      {action && <div className="mt-6 flex flex-wrap gap-2 justify-center">{action}</div>}
    </div>
  );
}

export function LoadingState({ children }) {
  return (
    <div role="status" className="motion-safe:animate-fade-in flex flex-col items-center justify-center gap-3 py-20 text-sm text-muted">
      <Spinner className="size-7 text-indigo-500" />
      {children}
    </div>
  );
}

const TOAST_TONES = {
  success: { Icon: CircleCheck, color: 'text-emerald-400' },
  danger: { Icon: OctagonAlert, color: 'text-red-400' },
};

/** Notificación flotante abajo de la pantalla. Las de éxito se cierran solas; las de error esperan al usuario. */
export function Toast({ toast, onDismiss, className = 'bottom-0' }) {
  useEffect(() => {
    if (toast?.tone !== 'success') return;
    const id = setTimeout(onDismiss, 4000);
    return () => clearTimeout(id);
  }, [toast, onDismiss]);

  if (!toast) return null;
  const { Icon: ToastIcon, color } = TOAST_TONES[toast.tone];
  return (
    <div className={`fixed inset-x-0 z-40 p-4 flex justify-center pointer-events-none ${className}`}>
      <div
        role={toast.tone === 'danger' ? 'alert' : 'status'}
        className="motion-safe:animate-slide-up pointer-events-auto w-full max-w-md flex gap-3 items-start rounded-2xl bg-slate-900 text-white border border-transparent dark:bg-slate-800 dark:border-white/10 px-4 py-3.5 shadow-2xl shadow-slate-900/30"
      >
        <ToastIcon className={`size-5 shrink-0 mt-px ${color}`} aria-hidden="true" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">{toast.title}</p>
          {toast.message && <p className="mt-0.5 text-slate-300 leading-relaxed">{toast.message}</p>}
        </div>
        <button
          onClick={onDismiss}
          aria-label="Cerrar"
          className="shrink-0 -mr-1 size-7 grid place-items-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
