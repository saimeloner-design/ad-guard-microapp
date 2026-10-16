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
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          background: '#020617',
          color: '#f1f5f9',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Algo salió mal</h1>
        <button
          onClick={() => retry()}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.25rem',
            border: 'none',
            background: '#1e293b',
            color: 'inherit',
            cursor: 'pointer',
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
