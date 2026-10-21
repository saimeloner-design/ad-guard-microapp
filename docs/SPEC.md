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

El monto sugerido es el doble del costo por resultado típico de la cuenta (o 3 días de gasto) redondeado. Activar pide confirmación; desactivar borra la regla. Cambiar el monto con una guardia activa la vuelve a crear. Las reglas se leen junto con las campañas; si no se pueden leer, Protección lo avisa y el resto del panel funciona igual.

### Tope de gasto
`spend_cap` de la cuenta publicitaria: cuando lo gastado desde que se puso (o se reinició) llega al tope, Meta detiene todos los anuncios. Protección muestra cuánto va, cuánto queda y en cuántos días se llega al ritmo de los últimos 30 días; permite ponerlo, cambiarlo, empezar de cero (`spend_cap_action=reset`) o quitarlo (`spend_cap_action=delete`), siempre con confirmación. Si la cuenta no tiene tope, se sugiere 1,2× lo gastado en los últimos 30 días, redondeado. Los montos van en la unidad mínima de la moneda (`toMetaAmount`).

Todas las acciones que escriben en Meta usan el permiso `ads_management`, que la app ya pide. Si Meta rechaza un cambio con un mensaje para el usuario (`error_user_msg`), se muestra ese mensaje.

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

Ambos sólo escriben logs en Sentry (proyecto `ad-guard-microapp`); el usuario no ve nada distinto.

**Consumo de Meta** (flujo `usage`): cada respuesta de Meta registra el consumo de sus límites que viene en los encabezados (`x-app-usage`, `x-ad-account-usage`, `x-business-use-case-usage`, en % del límite), y cada listado completo registra páginas, filas, bytes, duración y el mayor consumo visto. Sirve para saber cuánto "gasta" cada consulta antes de agregar otras.

**Calibración** (`lib/calibration.js`, flujo `calibration`): cada vez que se cargan las campañas se registra, por campaña, sus métricas (CTR, frecuencia, visitas/clics, costo por resultado, comparación con la referencia, ROAS) y qué alertas salieron. Con varias cuentas reales se mira la distribución y se ajustan los umbrales; por ejemplo, alertar sólo al 10% peor. Como cada recarga vuelve a registrar, al analizar hay que quedarse con un registro por campaña y día.

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
| **Campañas** | ¿Cuál anda mal? | Lista agrupada en Pausar ya / Para revisar / Van bien / Pausadas, una línea por campaña con lo gastado y por qué está en ese grupo. Al tocar una se abre el detalle: alertas (las de Revisar plegadas bajo la de Pausar), cifras con palabras explicadas, revisión de campaña nueva y diagnóstico (§4c, §4d) |
| **Lo que funciona** | ¿Qué repito? | Próximas fechas y mejores campañas con "Crear una campaña igual" |
| **Protección** | ¿Estoy cubierto? | Ganancia por venta, guardias y tope de gasto |

Reglas: una tarea a la vez; el detalle sólo al tocar; el botón donde está el problema; lo que se configura una vez queda aparte. El detalle de campaña usa `#campana-{id}` en la URL para que el gesto de "atrás" del celular vuelva a la lista. El número rojo sobre "Campañas" son las campañas para pausar. Con Google (hoy oculto) sólo hay Hoy y Campañas.
