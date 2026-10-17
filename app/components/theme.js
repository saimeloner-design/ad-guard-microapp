'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { DARK_QUERY, THEME_KEY } from './theme-script';

function readPreference() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

function apply(pref) {
  const dark = pref === 'dark' || (pref === 'system' && matchMedia(DARK_QUERY).matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.dataset.theme = pref;
}

// La preferencia vive en <html data-theme>, así el selector se entera de cambios sin estado duplicado.
function subscribe(onChange) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

const getSnapshot = () => document.documentElement.dataset.theme || 'system';
const getServerSnapshot = () => null;

const OPTIONS = [
  { value: 'light', label: 'Claro', Icon: Sun },
  { value: 'system', label: 'Sistema', Icon: Monitor },
  { value: 'dark', label: 'Oscuro', Icon: Moon },
];

export function ThemeToggle() {
  const pref = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // En modo "Sistema" se sigue el cambio del navegador en vivo (p. ej. el modo noche automático).
  useEffect(() => {
    const media = matchMedia(DARK_QUERY);
    const onChange = () => readPreference() === 'system' && apply('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const select = useCallback((value) => {
    try {
      if (value === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, value);
    } catch {}
    apply(value);
  }, []);

  return (
    <div role="radiogroup" aria-label="Tema" className="flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-3 border border-line">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={pref === value}
          aria-label={label}
          title={label}
          onClick={() => select(value)}
          className={`size-7 grid place-items-center rounded-md transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-indigo-500 ${
            pref === value ? 'bg-surface text-fg shadow-xs' : 'text-muted hover:text-fg'
          }`}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
