'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, LoaderCircle } from 'lucide-react';
import { normalizeFacebookProfile, SPEND_OPTIONS, TRACKING_PARAMS } from '@/lib/leads';
import { trackLead } from './meta-pixel';
import styles from './landing.module.css';

const INVALID = 'Escribe tu email o WhatsApp y elige cuánto inviertes para que podamos contactarte.';
const NO_FACEBOOK = 'Pega el enlace de tu perfil de Facebook: lo necesitamos para darte acceso a la beta.';

export function LeadForm() {
  const [state, setState] = useState('idle'); // idle | sending | done
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const contact = String(form.get('contact') || '').trim();
    const spend = String(form.get('spend') || '');
    const facebook = String(form.get('facebook') || '').trim();
    if (!contact || !spend) return setError(INVALID);
    if (!normalizeFacebookProfile(facebook)) return setError(NO_FACEBOOK);

    setError(null);
    setState('sending');
    const params = new URLSearchParams(window.location.search);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          contact,
          facebook,
          spend,
          website: form.get('website'),
          tracking: Object.fromEntries(TRACKING_PARAMS.map((key) => [key, params.get(key) || ''])),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No pudimos guardar tus datos. Intenta de nuevo en unos minutos.');
      trackLead({ content_name: 'beta', spend });
      setState('done');
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'No hay conexión. Revisa tu internet e intenta de nuevo.' : err.message);
      setState('idle');
    }
  };

  if (state === 'done') {
    return (
      <div className={styles.thanks} role="status">
        <span className={styles.ok}>
          <Check aria-hidden="true" />
        </span>
        <h3>¡Listo, ya estás en la lista!</h3>
        <p>Te escribiremos en las próximas 24 horas con tu acceso a AdSmart. Te llegará una invitación de Meta que tendrás que aceptar.</p>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <label htmlFor="f-name">
        Tu nombre
        <input id="f-name" name="name" type="text" autoComplete="given-name" placeholder="Camila" maxLength={80} />
      </label>
      <label htmlFor="f-contact">
        Email o WhatsApp
        <input
          id="f-contact"
          name="contact"
          type="text"
          autoComplete="email"
          placeholder="camila@tutienda.cl o +56 9 1234 5678"
          maxLength={120}
          required
        />
      </label>
      <label htmlFor="f-facebook">
        Enlace a tu perfil de Facebook
        <input
          id="f-facebook"
          name="facebook"
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder="facebook.com/camila.rojas"
          maxLength={200}
          required
          aria-describedby="f-facebook-hint"
        />
        <span id="f-facebook-hint" className={styles.hint}>
          Mientras dure la beta, Meta solo deja entrar a quienes invitamos por su perfil. En la app de Facebook: tu perfil → ··· →
          Copiar enlace.
        </span>
      </label>
      <label htmlFor="f-spend">
        ¿Cuánto inviertes al mes en anuncios? (en pesos chilenos)
        <select id="f-spend" name="spend" required defaultValue="">
          <option value="">Elige una opción</option>
          {SPEND_OPTIONS.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </label>
      {/* Campo trampa para bots: oculto para las personas y para lectores de pantalla. */}
      <input className={styles.trap} name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      {error && (
        <p className={styles.err} role="alert">
          {error}
        </p>
      )}
      <button className={styles.btn} type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? (
          <>
            Enviando… <LoaderCircle className={styles.spin} aria-hidden="true" />
          </>
        ) : (
          <>
            Quiero mi revisión gratis <ArrowRight aria-hidden="true" />
          </>
        )}
      </button>
      <p className={styles.fine}>
        <Check aria-hidden="true" />
        Sin tarjeta. Solo te escribimos para darte acceso.
      </p>
    </form>
  );
}

/** Botón fijo en el celular; se esconde cuando el formulario ya está a la vista. */
export function StickyCta() {
  const ref = useRef(null);
  useEffect(() => {
    const target = document.getElementById('revision');
    if (!target || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      ([entry]) => ref.current?.classList.toggle(styles.away, entry.isIntersecting),
      { threshold: 0.15 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.sticky} ref={ref}>
      <a className={styles.btn} href="#revision">
        Revisar mis anuncios gratis
      </a>
    </div>
  );
}
