# AdsGuard — Especificación

## 0. Prompt original (referencia)

> quiero transofmar este mockup en realidad. necesito que me ayudes a conectar a los datos reales incialmente de google ads de manera que sea simple para el cliente, pensando que los clientes son usuarios basicos, emprendedores que hacen sus anuncios y no tienen a una persona especializada en ads. El objetivo incial es ahorrarles dinero entregando alertas para que detenga los anuncios que no estan rindiendo segun una serie de critieros que definiremos y que algunos de ellos ya estan definidos pero se pueden mejorar. quiero que este promp quede como referncia en un archivo de especificacion

(Fecha: 2026-10-07. Se conserva el texto tal cual fue escrito.)

## 1. Objetivo

Ayudar a emprendedores que gestionan sus propios anuncios —sin especialista en ads— a **dejar de gastar dinero en campañas que no rinden**. La app se conecta a su cuenta de Google Ads, revisa las campañas con criterios claros y les dice, en lenguaje simple, qué pausar y por qué. Pausar se hace con un botón, sin entrar a Google Ads.

### Usuario objetivo
- Dueño(a) de un negocio pequeño que creó sus campañas solo(a).
- No conoce términos como CTR, CPA o "conversión", o los conoce a medias.
- Entra desde el celular, poco tiempo, quiere una respuesta: "¿estoy perdiendo plata?".

### Principios de producto
1. **Cero configuración técnica para el cliente**: iniciar sesión con Google y listo. Nada de IDs de cliente, tokens ni "developer token".
2. **Lenguaje humano**: cada alerta dice qué pasa, cuánto dinero está en juego y qué hacer. Los términos técnicos van como dato secundario.
3. **Prudencia**: no alertar con pocos datos (campañas nuevas o con poco tráfico). Una alerta falsa que haga pausar una campaña buena es peor que no alertar.
4. **El usuario decide**: la app recomienda; pausar siempre requiere confirmación.

## 2. Alcance

### Fase 1 (esta entrega) — Google Ads
- Inicio de sesión con Google (OAuth) pidiendo permiso de Google Ads.
- Detección automática de las cuentas de Google Ads del usuario; si hay una sola, se usa directamente; si hay varias, selector simple.
- Lectura de campañas activas y pausadas con métricas de los **últimos 30 días**.
- Motor de alertas (sección 4) con mensajes en español simple.
- Pausar / reactivar campaña desde la app (con confirmación).
- Modo demo con datos de ejemplo, para mostrar la app sin cuenta conectada. Usa campañas de Meta Ads (`lib/demo-data.js`) con un caso de cada alerta principal.

### Fuera de alcance por ahora
- Meta Ads (fase 2; la UI vuelve a tener pestañas por canal cuando exista).
- Alertas por email/WhatsApp y revisión automática programada (requiere base de datos).
- Cuentas administradas vía MCC (agencias). La fase 1 apunta a cuentas propias.
- Análisis por anuncio o palabra clave (fase 1 trabaja a nivel campaña).

## 3. Arquitectura

```
Navegador ──► NextAuth (Google OAuth, scope adwords)
                 │  refresh_token guardado en el JWT cifrado (cookie httpOnly)
                 ▼
         Route handlers (/api/google-ads/*)  ──►  Google Ads API REST (v25)
                 │
                 ▼
          lib/alerts.js  (reglas puras, sin red → testeables)
```

- **Sin base de datos** en fase 1: el refresh token vive en la cookie de sesión cifrada de NextAuth y nunca se expone al navegador.
- `lib/google-ads.js`: cliente REST mínimo (listar cuentas, consultar campañas con GAQL, cambiar estado).
- `lib/alerts.js`: recibe métricas crudas y devuelve alertas. Umbrales en `ALERT_CONFIG`.
- Versión de API configurable con `GOOGLE_ADS_API_VERSION` (por defecto `v25`, vigente hasta ~ago 2027). Google publica versiones mayores cada ~3 meses; revisar la fecha de baja periódicamente: https://developers.google.com/google-ads/api/docs/sunset-dates

### Endpoints
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/google-ads/accounts` | Cuentas accesibles (id, nombre, moneda). Excluye cuentas administradoras. |
| GET | `/api/google-ads/campaigns?customerId=` | Campañas + métricas 30 días + alertas + resumen de cuenta. |
| POST | `/api/google-ads/campaigns/[campaignId]/status` | Body `{ customerId, status: "PAUSED" \| "ENABLED" }`. |
| GET | `/api/meta-ads/accounts` | Cuentas publicitarias de Meta (excluye desactivadas y cerradas). |
| GET | `/api/meta-ads/campaigns?accountId=` | Igual que en Google, con métricas de Meta (ver `plan.md`). |
| POST | `/api/meta-ads/campaigns/[campaignId]/status` | Body `{ status: "PAUSED" \| "ENABLED" }`. |

## 4. Criterios de alerta

Ventana: últimos 30 días. Todas las reglas sólo aplican a campañas **activas**.

### Requisito de datos mínimos
Una campaña sólo se evalúa si tiene **≥ 1.000 impresiones o ≥ 30 clics** en la ventana. Si no, se marca "Aprendiendo — aún sin datos suficientes".

### Reglas

| # | Regla | Condición | Severidad | Mensaje al usuario (resumen) |
|---|---|---|---|---|
| R1 | Gasto sin resultados | La cuenta mide conversiones, la campaña tiene 0 conversiones y gastó ≥ 2× el costo promedio por conversión de la cuenta **o** tiene ≥ 50 clics | **Pausar** | "Gastaste $X y no conseguiste ninguna venta/contacto." |
| R2 | Resultados muy caros | Conversiones > 0 y costo por conversión ≥ 2,5× el promedio de la cuenta (requiere ≥ 2 campañas con conversiones) | Revisar | "Cada resultado te cuesta $X, más del doble que en tus otras campañas." |
| R3 | Pocas personas hacen clic | CTR bajo el mínimo según tipo: Búsqueda < 1%, Shopping < 0,5%, Display/Video/otras < 0,1% | Revisar | "Tu anuncio se muestra mucho pero casi nadie hace clic." |
| R4 | Clics muy caros | CPC promedio ≥ 3× el CPC promedio de la cuenta (requiere ≥ 2 campañas con clics) | Revisar | "Cada clic te cuesta $X, el triple que en tus otras campañas." |

Alerta a nivel cuenta:
- **A1 Sin medición**: la cuenta gastó en 30 días y no registra ninguna conversión → "No estamos viendo ventas ni contactos. Puede que no tengas configurada la medición." En ese caso R1 y R2 no se evalúan (no se puede juzgar resultados sin medirlos).

### Cambios respecto al mockup
| Antes | Ahora | Motivo |
|---|---|---|
| `impressions > 1000 && ctr < 1%` para toda campaña | CTR mínimo por tipo de campaña | En Display un CTR de 0,3% es normal; con la regla anterior casi todas las campañas Display alertaban. |
| `gasto > 20.000 && clics < 5` | R4 relativa al promedio de la cuenta | Monto fijo sólo sirve en CLP y para un tamaño de cuenta. Relativo funciona en cualquier moneda y presupuesto. |
| — | R1 "gasto sin resultados" | Es la regla que más dinero ahorra: pagar clics que nunca convierten. |
| — | Datos mínimos | Evita alertar campañas recién creadas. |

### Pendiente por definir con el cliente
- ¿Usar ventana de 30 días o 14? (30 da más datos, 14 reacciona más rápido).
- Valores exactos de los multiplicadores (2×, 2,5×, 3×) tras ver cuentas reales.
- Mostrar "dinero que podrías ahorrar" = gasto mensual de campañas con alerta Pausar.

## 4b. Criterios de alerta de Meta Ads

Código: `lib/alerts-meta.js` (umbrales en `META_ALERT_CONFIG`). Ventana: últimos 30 días.

### El resultado depende del objetivo
| Objetivo | Resultado | Costo mostrado |
|---|---|---|
| Ventas | Compras (+ valor de las ventas si se mide) | Costo por compra |
| Clientes potenciales | Formularios, contactos y registros | Costo por contacto |
| Mensajes (conjunto optimizado para conversaciones) | Conversaciones iniciadas | Costo por conversación |
| Promoción de app | Instalaciones | Costo por instalación |
| Tráfico | Clics en el enlace | Costo por clic |
| Interacción | Interacciones | Costo por interacción |
| Reconocimiento | Personas alcanzadas | Costo por 1.000 personas |

Los clics son siempre clics en el enlace (`inline_link_clicks`); los clics totales incluyen me gusta y comentarios.

### Referencia para decir "caro"
En orden, se usa la primera que exista (mínimo 5 resultados):
1. Otras campañas con el mismo tipo de resultado en los últimos 90 días (incluye pausadas y terminadas).
2. La misma campaña en los 30 días anteriores.
3. Ninguna: no se juzga si es caro; sólo aplican las reglas que no comparan.

### Campañas que se muestran
Las que gastaron algo en los últimos 90 días y las creadas en ese período (aunque todavía no gasten). Las demás se ocultan y sólo se informa cuántas son, estén pausadas o activas: Meta deja en estado activo las campañas cuyo conjunto terminó por fecha, así que en cuentas antiguas se acumulan promociones de hace años, a veces de varias páginas. Meta da acceso a todas las cuentas publicitarias del usuario aunque en el login elija un negocio, así que sin este filtro aparecían campañas viejas de otras páginas.

Uso interno para pruebas: agregar `?inactivas=1` a la URL de la app (por ejemplo `https://ad-guard-microapp.vercel.app/?inactivas=1`) muestra también las ocultas.

### Datos mínimos
No se evalúa (se marca "Aprendiendo") si algún conjunto que publica está en fase de aprendizaje de Meta, o si tiene < 1.000 impresiones y < 30 clics en el enlace. Una campaña activa sin conjuntos publicando se muestra como "Activa, sin publicar" y sólo recibe M6.

### Reglas
| # | Regla | Condición | Severidad |
|---|---|---|---|
| M1 | Gasta sin resultados | Objetivo con resultado concreto (ventas, contactos, mensajes, app), 0 resultados y gasto ≥ 2× el costo por resultado de referencia **o** ≥ 50 clics en el enlace **o**, sólo en mensajes (casi no generan clics en el enlace), ≥ 5.000 impresiones | **Pausar** |
| M2 | Resultado caro | Costo por resultado ≥ 2,5× otras campañas con el mismo objetivo, o ≥ 2× el mes anterior de la misma campaña | Revisar |
| M3 | Vende menos de lo que gasta | Ventas con valor medido, ≥ 5 compras y valor/gasto < 1 | Revisar |
| M4 | Anuncio desgastado | Frecuencia de 7 días ≥ 3 y CTR de 7 días ≥ 30% menor que el de los 23 días anteriores (≥ 1.000 impresiones en cada período). No aplica a reconocimiento | Revisar |
| M5 | Aprendizaje limitado | Meta marca un conjunto activo con aprendizaje limitado | Revisar |
| M6 | Anuncios rechazados | Anuncios rechazados o con problemas en una campaña activa (siempre, aunque esté aprendiendo) | Revisar |
| M7 | Clics que no llegan a la web | Ventas, contactos o tráfico; ≥ 100 clics y visitas a la página / clics < 50% (sólo si el píxel mide visitas) | Revisar |
| M8 | Casi nadie hace clic | Ventas, contactos, tráfico o app; ≥ 3.000 impresiones y CTR del enlace < 0,4% | Revisar |

Alertas de cuenta:
- **A1 Sin medición**: las campañas de ventas y contactos gastaron y no registran ningún resultado (probable falta de píxel). En ese caso M1, M2 y M3 no se evalúan para ellas.
- **A2 Estado de la cuenta**: pago pendiente, pago fallido (período de gracia) o cuenta en revisión.

Los valores fijos (frecuencia 3, CTR 0,4%, 50% de visitas, 50 clics, 5.000 impresiones en mensajes) son reglas prácticas, no datos de mercado verificados. Se ajustan con el registro de calibración (§7).

## 4c. Diagnóstico de campañas de Meta

Código: `lib/diagnosis-meta.js` (se llama desde `evaluateMetaAccount`; umbral en `META_ALERT_CONFIG.wastedPartCostMultiplier`). Diseño aprobado: maqueta "AdsGuard Diagnóstico" (https://claude.ai/artifact/UgydpGY6JrQU7Mjxysp8Do, privada).

El diagnóstico **no agrega ni quita alertas**: todas siguen visibles aunque el recorrido muestre lo mismo, porque muchos usuarios no lo deducen solos. Sólo explica dónde está la falla y qué cambiar. Es texto: la app no hace el cambio. Sólo para campañas activas que ya se evalúan (no aprendiendo ni sin publicar).

### 1. ¿Dónde se pierde la plata?
Recorrido de la gente con los pasos que se pueden medir según el objetivo:

| Paso | Dato | Cuándo aparece |
|---|---|---|
| Personas lo vieron | Alcance (o impresiones si no hay alcance) | Siempre |
| Hicieron clic | Clics en el enlace | Ventas, contactos, tráfico, app |
| Llegaron a tu web | Visitas a la página | Ventas, contactos, tráfico, y sólo si el píxel mide visitas |
| Te compraron / dejaron sus datos / te escribieron / instalaron tu app | Resultados | Ventas, contactos, mensajes, app, si se miden |

Interacción y reconocimiento no tienen recorrido. El paso que falla se deduce de las alertas, y se marca **el primero** (la fuga más temprana es la que hay que arreglar antes):
1. M4 → clic ("Cambia la imagen o el video").
2. M8 → clic ("Cambia la imagen o el texto").
3. M7 → web ("Revisa tu web: muchos se van antes de que cargue").
4. M1, M2 o M3 → resultado (texto según el objetivo: página, formulario, mensajes, tienda de apps; M3 sin M1/M2: "Tus ventas no alcanzan a cubrir lo que gastas"). En tráfico el resultado es el clic, así que se marca el clic.

Cada recorrido trae un "Qué cambiar": un titular visible y la explicación plegada.

### 2. Pausa solo esta parte
Se muestra cuando, en una campaña con resultados medidos, un anuncio que hoy publica **gastó ≥ 2× el costo por resultado de la campaña sin ningún resultado** y otro anuncio de la misma campaña sí trae resultados. Si no hay caso a nivel de anuncio, se busca lo mismo entre conjuntos de anuncios. Si todas las partes fallan no aparece: queda la alerta de la campaña completa. Se lista lo que funciona (hasta 3) y lo que gasta sin resultados, y se indica pausarlo desde el Administrador de anuncios.

El detalle por conjunto y anuncio (`getMetaBreakdownRows`) se pide en paralelo con las campañas. Si falla, se reporta a Sentry y el panel se muestra sin esta parte.

La calibración registra `funnelBreak`, `cutLevel` y `cutParts` por campaña para ajustar estos criterios.

## 5. Requisitos para producción (no son del cliente, son del operador de la app)

1. **Proyecto en Google Cloud** con OAuth Client (tipo "Aplicación web"), redirect URI `https://<dominio>/api/auth/callback/google` (y `http://localhost:3000/api/auth/callback/google` en desarrollo).
2. **Google Ads API habilitada** en ese proyecto.
3. **Developer token** (se obtiene en una cuenta administradora MCC → Centro de API). Con nivel *Test* sólo funciona con cuentas de prueba; para clientes reales se necesita **Basic access** (solicitud a Google, días a semanas).
4. **Verificación de la app OAuth**: el scope `adwords` es sensible. Mientras no esté verificada, sólo funcionan usuarios agregados como "test users" (máx. 100) y verán un aviso de "app no verificada".
5. **App de Meta** (fase 2): caso de uso "Crear y administrar anuncios" + "Inicio de sesión con Facebook para empresas". El login usa la configuración `META_LOGIN_CONFIG_ID` ("AdsGuard login", token de usuario) que pide sólo `email`, `ads_read` y `ads_management` (+ `public_profile`). Redirect URI `https://<dominio>/api/auth/callback/facebook`. Meta no entrega refresh token: al iniciar sesión el token se cambia por uno de larga duración (~60 días) y se guarda sólo en el JWT. Mientras la app no pase la revisión de Meta, sólo funciona con usuarios con rol en la app.
6. Variables de entorno: ver `.env.example`.

## 6. Experiencia de usuario

1. Pantalla inicial: qué hace la app en una frase + botón "Conectar con Google Ads" + link "Ver demo".
2. Tras conectar: si hay varias cuentas, elegir una (se recuerda en el navegador).
3. Panel: resumen (gasto 30 días, resultados, alertas, "podrías ahorrar"), luego campañas ordenadas por severidad de alerta.
4. Cada alerta: título simple, explicación de una línea, botón "Pausar" con confirmación que repite el monto en juego.
5. Errores traducidos: token no aprobado, cuenta sin permisos, sesión expirada → mensaje claro y qué hacer.

## 7. Calibración y análisis en sombra

Ambos sólo escriben logs en Sentry (proyecto `ad-guard-microapp`); el usuario no ve nada distinto.

**Calibración** (`lib/calibration.js`, flujo `calibration`): cada vez que se cargan las campañas se registra, por campaña, sus métricas (CTR, frecuencia, visitas/clics, costo por resultado, comparación con la referencia, ROAS) y qué alertas salieron. Con varias cuentas reales se mira la distribución y se ajustan los umbrales; por ejemplo, alertar sólo al 10% peor. Como cada recarga vuelve a registrar, al analizar hay que quedarse con un registro por campaña y día.

**Análisis en sombra** (`lib/shadow.js`, flujo `shadow`): después de responder, con el gasto y los resultados por grupo de anuncios, anuncio y palabra clave (Google) o por conjunto y anuncio (Meta; en Meta es el mismo detalle que usa el diagnóstico, §4c), se registra por campaña:
- `partsWithSpend`: cuántas partes gastaron (¿la mayoría tiene una sola?);
- `wastedShare`: qué parte del gasto se fue en partes sin resultados;
- `top1WastedShare` / `top2WastedShare`: cuánto de ese gasto se concentra en la peor parte o las dos peores;
- `campaignFlaggedPause`: si la campaña entera ya tenía alerta de pausar.

La pregunta a responder tras 2 o 3 semanas con usuarios piloto: ¿en cuántas campañas que se ven "aceptables" el dinero se pierde en 1 o 2 partes? Si es frecuente, se agrega "Ver dónde se pierde el dinero" con pausa por parte; si casi todos tienen campañas de una sola parte, no vale la pena. En Meta ya se muestra como "Pausa solo esta parte" (§4c); el registro sirve para ajustar su umbral.
