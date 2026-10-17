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

- [x] Botón "Continuar con Meta" en `app/page.js` que llama a `signIn('facebook')`.
- [x] Rutas de datos de Meta equivalentes a las de Google (`/api/meta-ads/accounts`, `/api/meta-ads/campaigns`, `/api/meta-ads/campaigns/[campaignId]/status`).
- [x] Que el panel use los datos de Meta cuando `session.hasMetaAds` es verdadero.

## Cómo se adaptan los datos de Meta al motor de alertas

- **Clics**: clics en el enlace (`inline_link_clicks`), no los clics totales (que incluyen me gusta y comentarios).
- **Resultados**: suma de compras, clientes potenciales, conversaciones de mensajería iniciadas, contactos y registros (`RESULT_ACTIONS` en `lib/meta-ads.js`). De cada grupo se toma un solo nombre de acción para no contar dos veces la misma conversión.
- **Tipo de campaña**: el objetivo de Meta (Ventas, Clientes potenciales, etc.). Para la regla de CTR usa el mínimo por defecto (0,1%).
- **Estado**: el de la campaña (`ACTIVE`/`PAUSED`); no mira si sus conjuntos de anuncios están pausados.
