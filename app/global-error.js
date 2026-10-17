'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

// global-error no incluye globals.css, por eso los estilos van en línea.
export default function GlobalError({ error, retry }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          minHeight: '100vh',
          margin: 0,
          padding: '1rem',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          color: '#0f172a',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          role="alert"
          style={{
            width: '100%',
            maxWidth: '24rem',
            textAlign: 'center',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '1rem',
            padding: '2.5rem 1.5rem',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
          }}
        >
          <div
            style={{
              width: '3rem',
              height: '3rem',
              margin: '0 auto',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '1rem',
              background: '#fef2f2',
              color: '#dc2626',
              boxShadow: '0 0 0 4px #fee2e2',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
          </div>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '1rem 0 0' }}>Algo salió mal</h1>
          <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: '#64748b', margin: '0.5rem 0 0' }}>
            Tuvimos un problema inesperado. Ya nos llegó el aviso; intenta de nuevo en un momento.
          </p>
          <button
            onClick={() => retry()}
            style={{
              marginTop: '1.5rem',
              height: '2.5rem',
              padding: '0 1.25rem',
              borderRadius: '0.75rem',
              border: 'none',
              background: '#4f46e5',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
