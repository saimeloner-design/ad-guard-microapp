'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Button } from './ui';

// Palabras explicadas (idea 10): las cifras con subrayado de puntos abren una explicación corta.
const TERMS = {
  gasto: 'Lo que Meta te cobró por esta campaña en los últimos 30 días.',
  compras: 'Ventas que tu web le avisó a Meta que vinieron de tus anuncios.',
  contactos: 'Personas que dejaron sus datos (nombre, teléfono o correo) desde el anuncio.',
  conversaciones: 'Conversaciones nuevas que empezaron por WhatsApp, Messenger o Instagram desde el anuncio.',
  instalaciones: 'Veces que alguien instaló tu app desde el anuncio.',
  'clics al enlace': 'Personas que tocaron el anuncio para ir a tu web.',
  interacciones: 'Me gusta, comentarios, veces compartido y otras reacciones a tu anuncio.',
  'personas alcanzadas': 'Cuántas personas distintas vieron tu anuncio al menos una vez (Meta lo llama "alcance").',
  'costo por 1.000 personas': 'Lo que te cuesta que 1.000 personas distintas vean tu anuncio.',
  costo: 'El gasto dividido por los resultados: lo que te costó en anuncios conseguir cada uno.',
  frecuencia: 'Cuántas veces vio tu anuncio cada persona, en promedio.',
};

function explain(label) {
  const key = label.toLowerCase();
  if (TERMS[key]) return TERMS[key];
  if (key.startsWith('costo por ')) return `${TERMS.costo} Por ejemplo, si gastaste $10.000 y conseguiste 5, cada uno te costó $2.000.`;
  return null;
}

const GlossaryContext = createContext(() => {});

/** Envuelve el panel y muestra la hoja con la explicación de la palabra tocada. */
export function GlossaryProvider({ children }) {
  const [open, setOpen] = useState(null);
  const closeRef = useRef(null);
  const lastFocus = useRef(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const show = (term) => {
    lastFocus.current = document.activeElement;
    setOpen(term);
  };
  const close = () => {
    setOpen(null);
    lastFocus.current?.focus?.();
  };

  return (
    <GlossaryContext.Provider value={show}>
      {children}
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 flex items-end justify-center motion-safe:animate-fade-in" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="term-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-surface rounded-t-3xl px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl motion-safe:animate-slide-up flex flex-col gap-2"
          >
            <span className="self-center w-10 h-1 rounded-full bg-line mb-2" aria-hidden="true" />
            <h2 id="term-title" className="text-lg font-semibold text-fg">
              {open.label}
            </h2>
            <p className="text-[15px] text-fg-2 leading-relaxed">{open.text}</p>
            <Button ref={closeRef} variant="secondary" onClick={close} className="mt-3">
              Entendido
            </Button>
          </div>
        </div>
      )}
    </GlossaryContext.Provider>
  );
}

/** Etiqueta de una cifra. Si es una palabra conocida, se puede tocar para ver qué significa. */
export function Term({ label, className = '' }) {
  const show = useContext(GlossaryContext);
  const text = explain(label);
  if (!text) return <span className={className}>{label}</span>;
  return (
    <button
      type="button"
      onClick={() => show({ label, text })}
      className={`cursor-help text-left underline decoration-dotted decoration-faint underline-offset-[3px] hover:text-fg focus-visible:outline-2 focus-visible:outline-indigo-500 rounded-sm ${className}`}
    >
      {label}
    </button>
  );
}
