# Plan: login con Meta (versión 1)

En esta primera versión se usa un solo proveedor a la vez: si el usuario entra con Google ve los datos de Google Ads; si entra con Facebook, los de Meta Ads. Cada inicio de sesión reemplaza el token anterior.

## Variables de entorno que faltan

Agregarlas en `.env.local` (local) y en Vercel → Settings → Environment Variables (producción).

| Variable | Dónde se obtiene | Estado |
|---|---|---|
| `META_APP_ID` | `1121462050238748` | ✅ En Vercel (los 3 entornos) |
| `META_APP_SECRET` | Misma pantalla → "Clave secreta de la app" → **Mostrar** (pide la contraseña de Facebook) | ✅ En Vercel (production y development); falta en preview |
| `META_LOGIN_CONFIG_ID` | `1901074967923391` ("AdsGuard login", confirmado) | ✅ En Vercel (los 3 entornos) |
| `META_GRAPH_API_VERSION` | Opcional. Por defecto `v26.0` | Opcional |

Variables que ya están en `.env.local`: `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_PROJECT`.

## Configuración en la app de Meta

- [x] **URI de redireccionamiento de OAuth válidos**: `https://ad-guard-microapp.vercel.app/api/auth/callback/facebook`. Localhost no se usa (Meta exige HTTPS y no se prueba en local).
- [ ] **Roles de la app → Roles**: agregar a quienes vayan a probar. Mientras la app no pase la revisión de Meta, sólo ellos pueden iniciar sesión.

## Pendiente en el código

- [x] Botón "Continuar con Meta" en `app/page.js` que llama a `signIn('facebook')`. Mientras no haya panel de Meta, muestra que la cuenta quedó conectada.
- [ ] Rutas de datos de Meta equivalentes a las de Google (`/api/meta-ads/accounts`, `/api/meta-ads/campaigns`).
- [ ] Que el panel use los datos de Meta cuando `session.hasMetaAds` es verdadero.
