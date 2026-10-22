# AdsGuard — Especificación

Desde el 2026-10-21 la app se muestra como **AdSmart** (app, `/demo` y `/beta`). La URL, el repositorio, el código, los logs y los nombres de las guardias en Meta ("AdsGuard · …", que sirven para reconocerlas) siguen con el nombre anterior.

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
- Modo demo con datos de ejemplo, para mostrar la app sin cuenta conectada. Usa campañas de Meta Ads (`lib/demo-data.js`) con un caso de cada alerta principal. Tiene su propia URL, `/demo`, que se puede compartir y muestra la demo aunque haya sesión iniciada; "Conectar Meta" desde la demo vuelve a `/` después del login.

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
| GET | `/api/meta-ads/campaigns/[campaignId]/config?currency=` | Configuración y texto de los anuncios de una campaña, al abrir esa sección (§4f). |
| POST | `/api/meta-ads/campaigns/[campaignId]/status` | Body `{ status: "PAUSED" \| "ENABLED" }`. |
| GET / POST | `/api/meta-ads/settings?accountId=` | Ganancia por venta y tareas de Hoy hechas de la cuenta (§9). POST `{ accountId, profitPerSale }`. |
| POST | `/api/meta-ads/tasks` | Tareas de Hoy hechas: `{ accountId, keys: [...] }` (§9). |
| POST | `/api/meta/data-deletion`, `/api/meta/deauthorize` | Avisos de Meta para borrar los datos de un usuario (`signed_request`, §9). |
| POST | `/api/demo/events` | Uso anónimo de la demo `{ session, type, data }` (§9). Público. |

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
| M9 | Pierde plata en cada venta | Ventas medidas, ≥ 3 compras (`minProfitPurchases`) y costo por compra > lo que el usuario dijo que gana por venta (Protección, §4e). Si no lo supera, el detalle muestra cuánto le queda por venta | **Pausar** |

Alertas de cuenta:
- **A1 Sin medición**: las campañas de ventas y contactos gastaron y no registran ningún resultado (probable falta de píxel). En ese caso M1, M2 y M3 no se evalúan para ellas.
- **A2 Estado de la cuenta**: pago pendiente, pago fallido (período de gracia) o cuenta en revisión.

En el panel, si una campaña tiene alguna alerta de Pausar, esa queda a la vista y sus alertas de Revisar van plegadas debajo ("Otras N cosas para revisar · Te sirven para armar mejor la próxima campaña"), cerradas al entrar. Nunca se esconden. Maqueta aprobada: "AdsGuard Alertas para revisar" (https://claude.ai/artifact/7tZCAZ5opFJn4NCLh21CHb, privada).

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
Se muestra cuando, en una campaña con resultados medidos, un anuncio que hoy publica **gastó ≥ 2× el costo por resultado de la campaña sin ningún resultado** y otro anuncio de la misma campaña sí trae resultados. Si no hay caso a nivel de anuncio, se busca lo mismo entre conjuntos de anuncios. Si todas las partes fallan no aparece: queda la alerta de la campaña completa. Se lista lo que funciona (hasta 3) y lo que gasta sin resultados, con un botón para pausar sólo esas partes desde AdsGuard (con confirmación; `POST /api/meta-ads/parts/{id}/status`).

El detalle por conjunto y anuncio (`getMetaBreakdownRows`) se pide en paralelo con las campañas. Si falla, se reporta a Sentry y el panel se muestra sin esta parte.

La calibración registra `funnelBreak`, `cutLevel` y `cutParts` por campaña para ajustar estos criterios.

## 4d. Lo que te funcionó antes (Meta)

Código: `lib/winners-meta.js` (elegir la ganadora y comparar configuraciones), `findPast` en `lib/diagnosis-meta.js` (el texto) y `getMetaCampaignConfigs` en `lib/meta-ads.js`. Diseño aprobado: maqueta "AdsGuard Lo que te funcionó" (https://claude.ai/artifact/HBTLvk5RyQhD1jzifTy4fn, privada). Sin base de datos: la "memoria" es el historial de la cuenta de Meta, que se recalcula en cada visita.

### Campaña exitosa
- **Horizonte: 18 meses** (`WINNER_HISTORY_DAYS` en `lib/meta-ads.js`). Se partió con 12; la medición de 3 años (abajo) mostró que en una cuenta chica cuesta poco, pero que las campañas viejas cambian la ganadora y en cuentas grandes la consulta crece con campañas × meses. 18 meses cubre la misma temporada del año anterior (p. ej. Navidad o Día de la Madre) sin ir tan atrás. Se pide por mes (`time_increment=monthly`) para mostrar cuándo funcionó (el mes en que más gastó).
- **Condiciones:** al menos 10 resultados (`minWinnerResults`) y ninguna condición de alerta que se pueda calcular con el total del año: M2 (contra las demás campañas con el mismo objetivo), M3, M7 y M8. M1 no aplica (se exigen resultados) y M4 necesita el detalle semanal.
- No cuentan las campañas que **hoy** tienen alertas, aunque en el año les haya ido bien.
- Por cada objetivo gana la de **menor costo por resultado**. Reconocimiento no participa (no tiene costo por resultado comparable).
- Las campañas borradas deducen su objetivo del campo `objective`. Una campaña de mensajes borrada puede quedar como interacción o contactos.

### Dónde se ve
1. **Pestaña "Lo que funciona"** (§8): la ganadora de cada objetivo con su costo por resultado, cuántos resultados trajo, el mes, su configuración y el botón "Crear una campaña igual" (§4e).
2. **"Lo que te funcionó antes"**, plegable en la tarjeta de una campaña activa **con alertas**, si hay ganadora con el mismo objetivo y esta campaña cuesta ≥ 1,2× por resultado (`pastMinImprovement`) o no consigue ninguno. Incluye:
   - Comparación de 4 filas, sólo con los datos que existen en las dos: presupuesto diario (distinto si difiere > 20%), ubicación, edad y formato (video, carrusel, foto).
   - Sugerencia en texto con lo distinto. El presupuesto sólo se sugiere **bajar**, nunca subir. Si no hay diferencias: "la diferencia puede estar en la imagen, el texto o la oferta".
   - Cómo hacerlo: desde el Administrador de anuncios o con el botón que crea una copia en pausa de la campaña que funcionó.

### Consultas a Meta
El historial de 18 meses va en paralelo con las demás consultas de `getMetaCampaigns`. La configuración (presupuesto, conjuntos con su segmentación, formato de hasta 10 anuncios) se lee después, **sólo** de las campañas que se comparan, de las ganadoras de cada objetivo y de las campañas nuevas (§4e). Si una falla, se registra un aviso y esa tarjeta muestra el titular sin la tabla. Los presupuestos de Meta vienen en centavos, salvo en monedas sin decimales (CLP, entre otras: `NO_DECIMAL_CURRENCIES`).

La calibración registra `pastShown` y `pastCompared` (filas comparadas) por campaña.

### Medición de un horizonte de 3 años
Uso interno: abrir la app con `?historial3=1` (p. ej. `https://ad-guard-microapp.vercel.app/?historial3=1`). Después de responder se pide en sombra el historial de 3 años con el mismo formato que el de 18 meses y se registra en Sentry (flujo `usage`, mensaje "Meta: prueba de historial de 3 años") cuánto tardó, cuántas filas y campañas trajo, y en qué objetivos la ganadora de 3 años es otra que la de 18 meses (`winnersChanged`).

Primera medición (2026-10-20, cuenta de prueba con 10 campañas en 3 años): 3 años tardó 1,4 s y 68 filas (1 página) contra 0,87 s y 21 filas de 12 meses; ambos consumieron 1% del límite de Meta. Con 3 años cambiaba la ganadora de mensajes por una campaña más antigua. El usuario no ve nada distinto.

## 4e. Fase 2: menos que pensar (Meta)

Ideas aprobadas el 2026-10-20 que no necesitan base de datos ni IA. Las de IA (revisar el anuncio antes de publicar, ideas de anuncio nuevo y "Pregúntale a AdsGuard") quedan para una fase 3 como suscripción. Maquetas: "AdsGuard Fase 2" (https://claude.ai/artifact/R8aGFLWzzP9CGxDbKJ3x3n) y "AdsGuard Nueva estructura" (https://claude.ai/artifact/G1WBTbFbFB6DBsR3smmvPC), privadas.

### Hoy haz esto
Pestaña Hoy (§8): una sola tarea a la vez, de la más urgente a la menos. Se arman en el navegador a partir de las alertas (`buildTasks` en `app/components/today.js`):
1. Pausar cada campaña con alerta de Pausar (la de más gasto primero), con su botón.
2. Pausar los anuncios o conjuntos de "Pausa solo esta parte".
3. Revisar las campañas nuevas con problemas de configuración.
4. Revisar las campañas con alertas de Revisar.

Las dos primeras desaparecen al hacerlas. Las de revisar se marcan con "Ya lo hice" (se recuerda en el navegador, `adsguard.tareasHechas`). "Después" la manda al final de la lista mientras la página esté abierta. Las alertas de cuenta (A1, A2) se muestran siempre arriba de la tarea, no como tarea.

### Revisión de campaña nueva
`lib/setup-review-meta.js`. Campañas activas creadas hace menos de 7 días (`NEW_CAMPAIGN_DAYS`, por `created_time`), aunque Meta todavía esté aprendiendo. Revisa, sólo con los datos que existen:
- **Objetivo**: ventas, contactos, mensajes o app → bien; tráfico, interacción o reconocimiento → aviso ("Meta va a buscar gente que vea o toque el anuncio, no que te compre").
- **Ubicación** y **presupuesto diario** contra la ganadora del mismo objetivo (§4d): ubicación distinta → problema; presupuesto > 1,5× → problema.
- **Píxel** (ventas y contactos): si ninguna campaña registró ventas ni contactos en 90 días → aviso.

Una campaña nueva con problemas va al grupo "Para revisar" y genera una tarea en Hoy. La calibración registra `setupProblems`.

### Cuánto ganas por venta
Se pregunta en Protección y se guarda sólo en el navegador, por cuenta (`adsguard.gananciaPorVenta.{plataforma}.{cuenta}`); si cambia de dispositivo hay que volver a escribirlo. Con ese dato las alertas se reevalúan en el navegador y aparece M9 (§4b). Hoy invita a responderlo si hay campañas de ventas activas.

### Palabras explicadas
Las etiquetas de las cifras de cada campaña (gasto, compras, costo por…) se pueden tocar y abren una hoja con una explicación de una línea (`app/components/glossary.js`).

### Pausar un anuncio
Ver §4c, "Pausa solo esta parte".

### Crear una igual
Botón en cada ganadora de "Lo que funciona" y en "Lo que te funcionó antes": copia la campaña con sus conjuntos y anuncios **en pausa** (`POST /{campaign_id}/copies` con `deep_copy` y `status_option=PAUSED`; nombre con " (copia AdSmart)"). Meta sólo copia de una vez campañas chicas; si es más grande devuelve un error, que se muestra al usuario. Después se ofrece abrirla en el Administrador de anuncios.

### Fechas importantes
`lib/key-dates.js`. Fechas del comercio en Chile: San Valentín, Día de la Madre (2.º domingo de mayo), Día del Padre (3.er domingo de junio), Día del Niño (2.º domingo de agosto), Fiestas Patrias, Halloween, Black Friday y Navidad. Se muestran las de los próximos 120 días (hasta 3) en "Lo que funciona" y la más cercana (≤ 45 días) en Hoy. Recomiendan crear la campaña 28 días antes (`LEAD_DAYS`). Si en el historial de 18 meses hay una campaña con palabras de esa fecha en el nombre (p. ej. "navidad") y con resultados, se cuenta cuántos trajo y a qué costo. CyberDay no está porque su fecha cambia cada año.

### Guardias
`lib/guards-meta.js`. Reglas automáticas que AdsGuard crea en la cuenta de Meta (`/act_{id}/adrules_library`), revisadas por Meta cada 30 minutos (`SEMI_HOURLY`) aunque el usuario no abra la app. Se reconocen por su nombre, que empieza con "AdsGuard ·"; nunca se tocan las reglas del usuario.

| Guardia | Nivel | Condición (últimos 7 días) |
|---|---|---|
| Sin resultados | Campaña | gasto > monto elegido y 0 resultados |
| Pierde plata | Campaña de ventas | gasto > 3× la ganancia por venta y costo por compra (`cost_per_purchase_fb`) > ganancia por venta |
| Anuncio sin resultados | Anuncio | gasto > monto elegido y 0 resultados |

En Protección se muestran agrupadas por el problema que evitan, en una sola tarjeta con todo plegado (maqueta "AdSmart Guardias", variante C, https://claude.ai/artifact/3phB1tGJV92cgx9QXU5e4G, privada, aprobada el 2026-10-22). Cada grupo muestra a la vista su resumen y una etiqueta de estado ("1 de 2 activa", "Apagada"):
- **Gasta sin traer resultados**: el monto y dos interruptores, "Pausar la campaña completa" (cuando nada de la campaña funciona) y "Pausar solo el anuncio que falla" (cuando otros anuncios sí traen resultados). Se complementan: como la de campaña mide el gasto total, salta primero cuando nada funciona; la de anuncio sirve cuando la campaña sí trae resultados. El monto se mide en cada campaña o anuncio por separado.
- **Ventas que te hacen perder**: un interruptor, con la espera de 3 ventas explicada y un acceso a la ganancia por venta.
- **¿Cómo funcionan?**: se crea una regla en Meta, Meta la revisa cada 30 minutos mirando 7 días, pausa y avisa en Facebook; si el usuario reactiva lo pausado y sigue igual, se pausa otra vez.

El monto sugerido es el doble del costo por resultado típico de la cuenta (o 3 días de gasto) redondeado. Activar pide confirmación; desactivar borra la regla. Cambiar el monto con una guardia activa la vuelve a crear. Las reglas se leen junto con las campañas; si no se pueden leer, Protección lo avisa y el resto del panel funciona igual.

### Tope de gasto
`spend_cap` de la cuenta publicitaria: cuando lo gastado desde que se puso (o se reinició) llega al tope, Meta detiene todos los anuncios. Protección muestra cuánto va, cuánto queda y en cuántos días se llega al ritmo de los últimos 30 días; permite ponerlo, cambiarlo, empezar de cero (`spend_cap_action=reset`) o quitarlo (`spend_cap_action=delete`), siempre con confirmación. Si la cuenta no tiene tope, se sugiere 1,2× lo gastado en los últimos 30 días, redondeado. Los montos van en la unidad mínima de la moneda (`toMetaAmount`).

Todas las acciones que escriben en Meta usan el permiso `ads_management`, que la app ya pide. Si Meta rechaza un cambio con un mensaje para el usuario (`error_user_msg`), se muestra ese mensaje.

## 4f. Campañas que van bien y campañas aprendiendo (Meta)

Código: `lib/health-meta.js` (funciones puras, se llaman desde `evaluateMetaAccount`), `CalmSections` y vecinos en `app/components/campaign.js`. Diseño aprobado el 2026-10-22: maqueta "AdSmart Campañas que van bien" (https://claude.ai/artifact/SY4xesEjrsuzYQKGGp6qu4, privada), pantallas "Va bien · C", "Aprendiendo · Meta" y "Aprendiendo · faltan datos". Nada de esto agrega ni quita alertas.

### Grupos de la lista
Campañas queda en Pausar ya / Para revisar / **Van bien** / **Aprendiendo** / Pausadas. Aprendiendo (`levelOf` = `learning`) son las activas que todavía no se evalúan (Meta aprendiendo o pocos datos) y sin alertas; antes iban en Van bien. Hoy muestra el contador "aprendiendo" sólo si hay alguna.

### Van bien
Sólo campañas evaluadas por completo, sin alertas ni problemas de configuración nueva:
- **Línea en la lista** (`health.headline`): "25 compras a $5.000 · tu mejor de ventas" (o "· más barato que tus otras" si cuesta ≤ 90% de la referencia).
- **Recuadro verde plegado** "Va bien: pasó las N revisiones" con un resumen; al abrirlo, cada revisión con su cifra (consigue resultados, precio contra la referencia, CTR, visitas/clics, frecuencia de 7 días, valor/gasto), sólo las que se pueden calcular, y el consejo "Déjala como está".
- **Plegados**: el recorrido de la gente en verde, "Tu mejor campaña de {objetivo}" (si es la ganadora de §4d, con "Crear una campaña igual") y la configuración.

### Aprendiendo
- **Meta aprende** (`learningStatus` = LEARNING): "N de ~50 {resultados}" con barra. Sale de `learning_stage_info.conversions` del conjunto más atrasado, en la misma consulta de conjuntos que ya se hacía. Meta suele necesitar unos 50 resultados en la semana desde el último cambio grande (`last_sig_edit_ts`); si al ritmo actual no llega, se avisa que puede quedar con aprendizaje limitado (M5). Se agrega "No la cambies por ahora" con la fecha del último cambio grande.
- **Faltan datos** (< 1.000 impresiones y < 30 clics): dos barras ("620 de 1.000 veces vista" o "8 de 30 clics") y en cuántos días llega al ritmo de su vida (máx. 30 días).
- Las cifras se marcan como provisorias. Plegados: "Cuando termine / tenga datos, revisamos" (las reglas que le aplicarán según el objetivo) y la configuración.

### Configuración de esta campaña
Plegada. Presupuesto diario, qué busca Meta (optimización del conjunto), ubicación, edad, formato, fechas y el **texto** de los anuncios que publican, con los resultados de cada uno (del desglose de §4c). No se piden imágenes ni videos. Enlace al Administrador de anuncios.

**Cuidado con las consultas a Meta:** la configuración no se pide al cargar el panel sino al abrir la sección (`GET /api/meta-ads/campaigns/{id}/config?currency=`, una consulta), y el navegador la guarda mientras la página esté abierta. Si la campaña ya venía con su configuración (§4d: comparadas, ganadoras y nuevas) no se pide de nuevo.

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
3. Panel con 4 pestañas (§8): Hoy, Campañas, Lo que funciona y Protección.
4. Cada alerta: título simple, explicación de una línea, botón "Pausar" con confirmación que repite el monto en juego.
5. Errores traducidos: token no aprobado, cuenta sin permisos, sesión expirada → mensaje claro y qué hacer.

## 7. Calibración y análisis en sombra

Hoy ambos escriben logs en Sentry (proyecto `ad-guard-microapp`); el usuario no ve nada distinto. Con la base de datos (§9) pasan a guardarse **sólo** en la base de datos y Sentry queda únicamente para los logs de funcionamiento y errores.

**Consumo de Meta** (flujo `usage`): cada respuesta de Meta registra el consumo de sus límites que viene en los encabezados (`x-app-usage`, `x-ad-account-usage`, `x-business-use-case-usage`, en % del límite), y cada listado completo registra páginas, filas, bytes, duración y el mayor consumo visto. Sirve para saber cuánto "gasta" cada consulta antes de agregar otras.

**Calibración** (`lib/calibration.js`; Meta en la tabla `campaign_days`, §9; Google en el flujo `calibration`): cada vez que se cargan las campañas se registra, por campaña, sus métricas (CTR, frecuencia, visitas/clics, costo por resultado, comparación con la referencia, ROAS) y qué alertas salieron. Con varias cuentas reales se mira la distribución y se ajustan los umbrales; por ejemplo, alertar sólo al 10% peor. En la base de datos cada recarga sobrescribe el registro del día, así que hay uno por campaña y día.

**Análisis en sombra** (`lib/shadow.js`, flujo `shadow`): después de responder, con el gasto y los resultados por grupo de anuncios, anuncio y palabra clave (Google) o por conjunto y anuncio (Meta; en Meta es el mismo detalle que usa el diagnóstico, §4c), se registra por campaña:
- `partsWithSpend`: cuántas partes gastaron (¿la mayoría tiene una sola?);
- `wastedShare`: qué parte del gasto se fue en partes sin resultados;
- `top1WastedShare` / `top2WastedShare`: cuánto de ese gasto se concentra en la peor parte o las dos peores;
- `campaignFlaggedPause`: si la campaña entera ya tenía alerta de pausar.

La pregunta a responder tras 2 o 3 semanas con usuarios piloto: ¿en cuántas campañas que se ven "aceptables" el dinero se pierde en 1 o 2 partes? Si es frecuente, se agrega "Ver dónde se pierde el dinero" con pausa por parte; si casi todos tienen campañas de una sola parte, no vale la pena. En Meta ya se muestra como "Pausa solo esta parte" (§4c); el registro sirve para ajustar su umbral.

### Seguimiento de los intentos de login
`lib/login-tracking.js` envuelve la ruta de next-auth. Cuando Facebook se queda pegado (p. ej. en su pantalla "¿Guardar información de inicio de sesión?" en el celular), el usuario nunca vuelve a AdsGuard y el servidor no se entera. Por eso se registran dos eventos en el flujo `login`, unidos por `attemptId`:
- **"Intento de login: sale hacia el proveedor"** al tocar "Continuar con Meta" (POST `/api/auth/signin/facebook`), con `device` (celular, tablet, computador), `os`, `browser` e `inApp` (navegador dentro de Facebook, Instagram, WhatsApp…). Deja una cookie `adsguard_login` de 30 minutos.
- **"Intento de login: vuelve del proveedor"** en `/api/auth/callback/facebook`, con `seconds` (cuánto tardó), `result` (ok, cancelado o el error) y `sameBrowser` (false si volvió sin la cookie: otro navegador, la app de Facebook o más de 30 minutos).

Un `attemptId` que sale y no vuelve es un login trabado o abandonado. No se registran datos personales.

## 8. Estructura del panel

Diseño aprobado el 2026-10-20 (maqueta "AdsGuard Nueva estructura"). Cuatro pestañas en una barra fija abajo, al alcance del pulgar; cada una responde una sola pregunta:

| Pestaña | Pregunta | Qué tiene |
|---|---|---|
| **Hoy** | ¿Qué hago ahora? | Gasto de 30 días, cuántas campañas hay para pausar, para revisar y que van bien, cuánto se ahorra pausando, alertas de cuenta, **una sola tarea** (§4e) y accesos a la próxima fecha, a la ganancia por venta y a Protección |
| **Campañas** | ¿Cuál anda mal? | Lista agrupada en Pausar ya / Para revisar / Van bien / Aprendiendo / Pausadas (§4f), una línea por campaña con lo gastado y por qué está en ese grupo. Al tocar una se abre el detalle: alertas (las de Revisar plegadas bajo la de Pausar), cifras con palabras explicadas, revisión de campaña nueva y diagnóstico (§4c, §4d) |
| **Lo que funciona** | ¿Qué repito? | Próximas fechas y mejores campañas con "Crear una campaña igual" |
| **Protección** | ¿Estoy cubierto? | Ganancia por venta, guardias y tope de gasto |

Reglas: una tarea a la vez; el detalle sólo al tocar; el botón donde está el problema; lo que se configura una vez queda aparte. El detalle de campaña usa `#campana-{id}` en la URL para que el gesto de "atrás" del celular vuelva a la lista. El número rojo sobre "Campañas" son las campañas para pausar. Con Google (hoy oculto) sólo hay Hoy y Campañas.

## 9. Base de datos

Propuesta del 2026-10-22; decisiones tomadas el mismo día (ver «Decisiones»), falta aprobar la propuesta completa. Hasta ahora todo vive en la cookie de sesión, en el navegador o en logs de Sentry (§7). La base de datos sirve para analizar con consultas, y no con búsquedas de logs, cómo rinden las alertas y qué hace el usuario con ellas. Más adelante también para lo que hoy no se puede: resumen semanal, avisos y revisión programada.

### Proveedor
- **Neon** (Postgres), recurso `adsmart-db` (instalado el 2026-10-22), plan gratuito desde el Marketplace de Vercel, región `iad1` (junto a las funciones de Vercel). Da 1 GB por proyecto, 100 CU-hora al mes y se apaga solo tras 5 min sin uso. Sin Neon Auth: el login sigue con next-auth.
- **Una rama por entorno**: producción usa la rama principal de Neon. En Preview la integración crea una rama `preview/<rama de git>` antes de cada deploy ("Create Database Branch For Deployment": sólo Preview), así que `develop` usa `preview/develop` y nunca toca los datos de producción. La integración pone las variables (`DATABASE_URL` con pool, `DATABASE_URL_UNPOOLED` directa, marcadas como sensibles); no se configuran a mano.
- **Driver `pg`** en el runtime de Node, con `attachDatabasePool` de `@vercel/functions` y `DATABASE_URL` (con pool); las migraciones usan `DATABASE_URL_UNPOOLED`. Con `pg`, `@sentry/nextjs` traza esas consultas solo y aparecen como spans en las trazas que ya hay. Sin ORM: SQL directo junto a cada módulo (`lib/calibration.js`, `lib/shadow.js`, `lib/users.js`), conexión en `lib/db.js` y migraciones como archivos `.sql` numerados en `db/migrations/`.

### Principios
1. **Nada de tokens.** El token de Meta sigue sólo en el JWT (§5). Si algún día hace falta para tareas en segundo plano, se guarda cifrado y se decide aparte.
2. **El mínimo de datos personales.** El usuario se identifica por su ID de Meta para esta app (app-scoped) y se guarda su email (decisión 1), sin nombre ni foto. Las campañas se guardan por ID, sin nombres ni textos de anuncios.
3. **Nunca rompe ni demora la respuesta.** Las escrituras van después de responder (`after()`, como `runInShadow`) en un solo upsert por carga. Si fallan, `reportError` en el flujo `db` y el usuario no nota nada.
4. **Un registro por día.** Las tablas diarias usan `(id, día)` como clave y cada recarga sobrescribe la del día. Así se resuelve el "quedarse con un registro por campaña y día" de §7. El día es la fecha en la zona horaria de la cuenta publicitaria.
5. **Cada cosa en su lugar.** La base de datos guarda los datos de análisis y de los usuarios; Sentry, sólo los logs de funcionamiento y errores (consumo de la API, intentos de login, fallos).

### Tablas

Esquema en `db/migrations/001_inicial.sql`. Las claves son los IDs de Meta (sin `act_` en las cuentas): cada guardado es un upsert directo, sin buscar antes un ID interno. Todo lo de un usuario o una cuenta se borra en cascada.

| Tabla | Clave | Qué guarda | Viene de | Estado |
|---|---|---|---|---|
| `users` | `meta_user_id` (`token.sub`) | `email`, `first_device` (celular, tablet o computador del primer login), `created_at`, `last_seen_at` | carga de campañas y login (`lib/users.js`) | hecho |
| `ad_accounts` | `meta_account_id` | `currency`, `timezone` (`timezone_name` de Meta), `first_seen_at`, `last_seen_at` | carga de campañas | hecho |
| `user_ad_accounts` | `(meta_user_id, meta_account_id)` | qué usuario ve qué cuenta (una cuenta puede tener varios usuarios) | carga de campañas | hecho |
| `account_days` | `(meta_account_id, day)` | resumen de cuenta: `campaigns`, `active_count`, `alert_count`, `total_cost`, `potential_savings`, `account_alerts text[]` | `saveMetaCalibration` | hecho |
| `campaign_days` | `(meta_campaign_id, day)` | `meta_account_id`, `status`, `objective`, `result_type`, `cost`, `impressions`, `results`, `cost_per_result`, `learning`, `alerts text[]` y el resto de las métricas de calibración en `metrics jsonb` | `saveMetaCalibration` | hecho |
| `shadow_days` | `(meta_campaign_id, day, level)` | `measured`, `campaign_alerts`, `campaign_flagged_pause`, `parts`, `parts_with_spend` y, si se mide, `wasted_parts`, `wasted_share`, `top1_wasted_share`, `top2_wasted_share` | `saveMetaWasteConcentration` | hecho |
| `account_settings` | `(meta_user_id, meta_account_id)` | `profit_per_sale` (Cuánto ganas por venta) y `updated_at` | `GET/POST /api/meta-ads/settings` | hecho |
| `events` | `id` | `meta_user_id`, `meta_account_id`, `meta_campaign_id` (opcional), `type`, `at`, `data jsonb` | acciones del usuario (`lib/events.js`) | hecho |

Todo se guarda en `GET /api/meta-ads/campaigns`, después de responder (`saveAfterResponse` en `lib/db.js`), en una sola transacción. El día es la fecha de hoy en la zona horaria de la cuenta; las métricas son las de 30 días que se ven en el panel.

**Migraciones**: `npm run build` corre `scripts/migrate.mjs` antes de `next build`. Aplica en orden los `.sql` de `db/migrations/` que falten (registrados en `schema_migrations`), cada uno en una transacción y con un candado para que dos builds no migren a la vez. En Vercel cada entorno migra su propia rama: producción la principal y `develop` la suya. Si falla, el deploy falla y queda el anterior. Sólo cambios compatibles hacia atrás (agregar tablas o columnas), porque la migración corre antes de que el deploy nuevo reemplace al anterior.

En `campaign_days` sólo van como columnas las métricas que se filtran o agrupan. El resto va en `metrics jsonb`, para poder agregar métricas sin migración.

**Tipos de `events`** (`recordEvent` en `lib/events.js`, después de responder; si el usuario o la cuenta todavía no están guardados, los crea):
- `pause` / `enable`: campaña. `data`: `alerts` (reglas que se veían al confirmar) y `cost` (gasto de 30 días).
- `part_pause` / `part_enable`: anuncio o conjunto de "Pausa solo esta parte". `data`: `partId`, `level`, `alerts` de la campaña y `cost` de la parte.
- `copy`: Crear una igual. `data`: `copiedCampaignId`.
- `guard_create` / `guard_remove`, `spend_cap_set` / `spend_cap_reset` / `spend_cap_remove`: Protección. `data`: `key` de la guardia, `amount` y `currency`.
- `login`: cada inicio de sesión con Meta (también guarda el email y, la primera vez, `first_device`). `data`: `device`, `os`, `browser` e `inApp` (navegador dentro de Facebook, Instagram…), con `deviceFrom` de `lib/login-tracking.js`.
- `task_done`: Hoy haz esto (`POST /api/meta-ads/tasks`, guardado antes de responder). `data.key` es la tarea (`pausar:123`, `revisar:123:M1,M6`…) y las tareas hechas se leen de aquí (las de los últimos 90 días).

El navegador manda `accountId`, `alerts` y `cost` junto a cada acción; el servidor los limpia y, si faltan, guarda el evento igual. Con esto se responde, por ejemplo: ¿qué alertas terminan en pausa?, ¿cuánto se ahorró?, ¿se reactivan campañas que la app mandó a pausar (posible alerta falsa)?

**Se quedan donde están**: los intentos de login (anónimos, antes de saber quién es el usuario) y el consumo de la API de Meta (flujo `usage`) siguen en Sentry. Los leads de `/beta` siguen en la Google Sheet. El tema y la cuenta elegida siguen en el navegador. La calibración y la sombra dejan de ir a Sentry.

### Uso anónimo de la demo
Tabla `demo_events` (migración `003_demo.sql`): qué hacen las visitas en `/demo`, sin saber quiénes son. `session_id` es un UUID al azar en `sessionStorage` (se borra al cerrar la pestaña); no hay usuario, email, IP ni cookie.
- **Tipos**: `view` (con `utm_*`, `referrer` si viene de otro sitio y `width` de la pantalla), `tab`, `campaign_open`, `pause`, `enable`, `part_pause`, `copy`, `protection` (`action`, `key`), `profit_set` (cuando deja de escribir), `task_done` (`key`: tipo de tarea), `connect_click` (tocó "Conectar Meta") y `exit` (tocó "Salir de la demo").
- **Cómo llega**: `trackDemo` (`app/components/demo-track.js`) usa `sendBeacon` y no espera respuesta. `POST /api/demo/events` es público: acepta sólo los tipos y campos de la lista (`lib/demo-events.js`), textos de hasta 100 caracteres y cuerpos de hasta 2 KB, y guarda después de responder.
- **Preguntas que responde**: ¿cuántas visitas llegan desde cada anuncio (`utm_content`)?, ¿qué pestañas miran?, ¿cuántas tocan "Conectar Meta"?, ¿en qué paso se van?
- Riesgo: al ser pública, alguien podría mandar muchos eventos válidos. Si pasa, se limita con el firewall de Vercel (límite por IP en `/api/demo/events`).

### Espacio
Una fila de `campaign_days` con su índice ocupa unos 0,7 KB y una de `shadow_days`, unos 0,2 KB por nivel. Con 50 cuentas de 20 campañas activas son unos 0,4 GB al año, lo que cabe en el 1 GB del plan gratuito. Retención:
- `campaign_days` y `shadow_days`: 13 meses (permite comparar con el mismo mes del año anterior).
- `account_days` y `events`: sin límite, son pocas.
- `demo_events`: 6 meses.
- **Cron** (`vercel.json`): `GET /api/cron/retention` los lunes a las 07:00 UTC (plan Hobby: Vercel lo corre en algún momento de esa hora). Borra lo vencido (`lib/retention.js`) y registra cuántas filas en el flujo `retention`. Vercel manda `Authorization: Bearer $CRON_SECRET`; sin eso responde 401. `CRON_SECRET` está en Production y en Preview (`develop`), distinto en cada uno. Los crons de Vercel sólo corren en producción: la rama de `develop` no se limpia sola.
- Al 70% del espacio se decide entre agregar por semana lo antiguo o pasar a Neon Launch (pago por uso).

### Borrado de datos (requisito de Meta)
Hecho en `lib/data-deletion.js`. Meta llama a dos URLs con un `signed_request` firmado con `META_APP_SECRET`; si la firma no es válida se responde 400 y no se borra nada.
- **`POST /api/meta/data-deletion`**: URL de devolución de llamada para eliminación de datos. Borra todo lo del usuario y responde `{ url, confirmation_code }`; Meta le muestra ambos al usuario.
- **`POST /api/meta/deauthorize`**: URL de devolución de llamada para desautorizar (el usuario quitó la app desde Facebook). Hace el mismo borrado.
- **Qué se borra**: el usuario (con su email), y en cascada sus vínculos con cuentas, su ganancia por venta y sus eventos. También las cuentas que quedan sin nadie (sin vínculos, ajustes ni eventos de otro usuario), con sus registros diarios. Las cuentas compartidas con otro usuario se conservan.
- **`/borrado-de-datos?codigo=`**: página pública con el estado del pedido. La tabla `deletion_requests` (migración `002_borrado.sql`) guarda sólo el código, el origen y las fechas, no a quién pertenecían los datos. El log del borrado (flujo `data-deletion`) tampoco lleva el ID del usuario.
- **En la app de Meta** (Configuración → Básica / Inicio de sesión con Facebook): poner las dos URLs de producción, `https://ad-guard-microapp.vercel.app/api/meta/data-deletion` y `…/api/meta/deauthorize`.
- **Política de privacidad**: `/privacidad` (`app/privacidad/page.js`), enlazada desde la portada y el pie de `/beta`. Versión del 2026-10-22; responsable AdSmart, contacto adsmart@gmail.com. Si cambia lo que se guarda (§9), hay que actualizarla. Su URL va en la app de Meta (Configuración → Básica → URL de la política de privacidad).

### Decisiones (2026-10-22)
1. **Se guarda el email** en `users`, para escribirles a los testers y unir el uso de la app con la hoja de leads de `/beta`. Lo borran los endpoints de borrado de datos.
2. **La ganancia por venta y las tareas hechas pasan a la base de datos**, para que no se pierdan al cambiar de dispositivo y se puedan analizar. La ganancia va en `account_settings` y las tareas hechas son eventos `task_done`. Al entrar por primera vez con base de datos, lo que haya en el navegador (`adsguard.gananciaPorVenta.{cuenta}`, `adsguard.tareasHechas`) se sube una vez y después se borra del navegador. Si la base de datos no responde, el panel sigue con lo del navegador, como antes. Google (oculto) y la demo siguen sólo en el navegador.
3. **La calibración y la sombra van sólo a la base de datos**, sin período en paralelo. En Meta, `saveMetaCalibration` y `saveMetaWasteConcentration` reemplazan a los logs en Sentry, que queda sólo para los logs de funcionamiento y errores. Si la escritura falla, eso sí va a Sentry (flujo `db`). Google (oculto) sigue con `logCalibration` y `logWasteConcentration` en Sentry hasta que vuelva.
