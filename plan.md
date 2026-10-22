# Plan: login con Meta (versión 1)

En esta primera versión se usa un solo proveedor a la vez: si el usuario entra con Google ve los datos de Google Ads; si entra con Facebook, los de Meta Ads. Cada inicio de sesión reemplaza el token anterior.

## Variables de entorno que faltan

Agregarlas en `.env.local` (local) y en Vercel → Settings → Environment Variables (producción).

| Variable | Dónde se obtiene | Estado |
|---|---|---|
| `META_APP_ID` | `1121462050238748` | ✅ En Vercel (los 3 entornos) |
| `META_APP_SECRET` | Misma pantalla → "Clave secreta de la app" → **Mostrar** (pide la contraseña de Facebook) | ✅ En Vercel (production, development y preview de `develop`) |
| `META_LOGIN_CONFIG_ID` | `1901074967923391` ("AdsGuard login", confirmado) | ✅ En Vercel (los 3 entornos) |
| `META_GRAPH_API_VERSION` | Opcional. Por defecto `v26.0` | Opcional |

Variables que ya están en `.env.local`: `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_PROJECT`.

## Configuración en la app de Meta

- [x] **URI de redireccionamiento de OAuth válidos**: `https://ad-guard-microapp.vercel.app/api/auth/callback/facebook` (producción) y `https://ad-guard-microapp-dev.vercel.app/api/auth/callback/facebook` (desarrollo). Localhost no se usa (Meta exige HTTPS y no se prueba en local).
- [ ] **Roles de la app → Roles**: agregar a quienes vayan a probar. Mientras la app no pase la revisión de Meta, sólo ellos pueden iniciar sesión (ver "Alta de testers").
- "Dominios de la app" no hace falta: el login va por el servidor, no por el SDK de JavaScript.

## Alta de testers

Mientras la app no pase la revisión de Meta, sólo pueden iniciar sesión personas con rol en la app. Para cada tester:

1. **Invitarlo** en https://developers.facebook.com/apps/1121462050238748/roles/roles/ (menú **Roles de la app → Roles**) → **Agregar personas** → rol **Evaluador** (*Tester*) → buscarlo por su nombre de Facebook o su ID.
2. **El tester acepta** en https://developers.facebook.com/requests con su cuenta de Facebook. Si nunca usó developers.facebook.com, Meta le pide registrarse como desarrollador (gratis, un minuto). Hasta que acepte, el login le falla.
3. **Inicia sesión** en `https://ad-guard-microapp.vercel.app` (siempre producción: desarrollo está protegido por Vercel y es sólo para nosotros) y conecta con Meta. Ve las cuentas publicitarias en las que tenga permisos en su Business; sin ninguna, el panel sale vacío.

Para que cualquiera pueda entrar sin invitación hace falta pasar la revisión de Meta (verificación del negocio + acceso avanzado a `ads_read` y `ads_management`). Queda para más adelante.

## Pendiente en el código

- [x] Botón "Continuar con Meta" en `app/page.js` que llama a `signIn('facebook')`.
- [x] Rutas de datos de Meta equivalentes a las de Google (`/api/meta-ads/accounts`, `/api/meta-ads/campaigns`, `/api/meta-ads/campaigns/[campaignId]/status`).
- [x] Que el panel use los datos de Meta cuando `session.hasMetaAds` es verdadero.

Los criterios de alerta de Meta están en `docs/SPEC.md` §4b; la calibración y el análisis en sombra, en §7.
