import { ArrowRight, Check, Hand, Lock, Unplug, Wallet } from 'lucide-react';
import { ThemeToggle } from '../components/theme';
import { LeadForm, StickyCta } from './lead-form';
import { MetaPixel } from './meta-pixel';
import styles from './landing.module.css';

// Landing de la campaña de Instagram. La app sigue en "/"; aquí sólo se juntan registros para la beta.
export const metadata = {
  title: 'AdSmart · Revisa tus anuncios gratis',
  description:
    'AdSmart revisa tus campañas de Instagram y Facebook y te avisa en palabras simples cuáles gastan sin dar resultados.',
};

const PANEL_ALERTS = [
  { tone: 'red', title: 'Gasta dinero sin traer resultados', detail: 'Promo Cyber · 0 mensajes en 21 días', amount: '$96.400' },
  { tone: 'red', title: 'Cada resultado te sale muy caro', detail: 'Tráfico web · $12.300 por venta', amount: '$61.500' },
  { tone: 'amber', title: 'Tu anuncio se está desgastando', detail: 'Reel otoño · frecuencia 4,8', amount: '$26.100' },
];

const PAINS = [
  ['Promocionas una publicación', ' y no sabes si te trajo clientes o solo "me gusta".'],
  ['El Administrador de Anuncios', ' tiene mil números y ninguno te dice qué hacer.'],
  ['Te enteras tarde', ' de que una campaña llevaba semanas gastando sin traer ni un mensaje.'],
];

const STEPS = [
  ['Conecta tu cuenta de Meta', 'Con el inicio de sesión oficial de Facebook. Toma menos de un minuto.'],
  ['Revisamos tus últimos 30 días', 'Analizamos cada campaña y detectamos dónde se te va la plata.'],
  ['Te aconsejamos qué hacer', 'Cada alerta trae una sugerencia. Tú decides: si quieres pausar una campaña, lo haces con un botón.'],
];

// Mismos títulos y sugerencias que lib/alerts-meta.js.
const ALERTS = [
  {
    tone: 'red',
    title: 'Gasta dinero sin traer resultados',
    detail: 'La campaña consume presupuesto y no llegan ventas ni mensajes.',
    todo: 'Te sugerimos pausarla y mover ese dinero a una que funcione.',
  },
  {
    tone: 'red',
    title: 'Cada resultado te sale muy caro',
    detail: 'Cada cliente te cuesta mucho más que en tus otras campañas.',
    todo: 'Te mostramos cuánto pagas en las otras para que decidas si seguir.',
  },
  {
    tone: 'amber',
    title: 'Casi nadie hace clic en tu anuncio',
    detail: 'Lo ven, pero no les llama la atención.',
    todo: 'Te sugerimos probar con otra imagen o texto.',
  },
  {
    tone: 'amber',
    title: 'Tu anuncio se está desgastando',
    detail: 'Las mismas personas lo vieron demasiadas veces y cada vez hacen menos clic.',
    todo: 'Te sugerimos cambiar la imagen o el texto para volver a llamar la atención.',
  },
  {
    tone: 'amber',
    title: 'Muchos clics no llegan a tu web',
    detail: 'La gente toca el anuncio y se va antes de ver tu página.',
    todo: 'Te sugerimos revisar que tu web cargue rápido y que el enlace esté bien.',
  },
  {
    tone: 'red',
    title: 'Un pago a Meta falló',
    detail: 'Tu cuenta entra en período de gracia y tus anuncios pueden detenerse.',
    todo: 'Te sugerimos actualizar tu medio de pago en Meta antes de que eso pase.',
  },
];

const AUDIENCE = ['Emprendedores', 'Tiendas online', 'Negocios locales', 'Profesionales independientes', 'Restaurantes y cafés'];

const TRUST = [
  { Icon: Lock, title: 'Conexión oficial con Meta', text: 'Entras con tu cuenta de Facebook, sin compartir contraseñas.' },
  {
    Icon: Hand,
    title: 'No cambiamos nada por ti',
    text: 'AdSmart solo te sugiere. Si quieres pausar una campaña, eres tú quien aprieta el botón.',
  },
  { Icon: Unplug, title: 'Te desconectas cuando quieras', text: 'Quitas el acceso desde Facebook en un par de clics.' },
];

const FAQ = [
  ['¿Cuánto cuesta?', 'Durante la beta es gratis. Te avisaremos con tiempo antes de que eso cambie.'],
  ['¿Necesito saber de marketing?', 'No. Te explicamos todo en palabras simples y te decimos qué conviene hacer con cada campaña.'],
  ['¿Sirve si solo "promociono" publicaciones?', 'Sí. Las publicaciones promocionadas también son campañas de Meta y las revisamos igual.'],
  [
    '¿Y si solo promociono desde Instagram?',
    <div key="ig" id="solo-instagram">
      <p>
        Funciona igual, pero necesitas una cuenta de Facebook para conectarte, aunque no la uses para publicar: Meta solo
        deja ver los anuncios, también los de Instagram, entrando con Facebook.
      </p>
      <ol>
        <li>Si no tienes, crea una cuenta en facebook.com.</li>
        <li>En Instagram: tu perfil → menú ☰ → Centro de cuentas → Cuentas → Agregar cuentas, y entra con tu Facebook.</li>
        <li>Con esa cuenta, regístrate gratis en developers.facebook.com. Meta lo pide mientras dure la beta.</li>
        <li>Pega el enlace de ese perfil de Facebook en el formulario de abajo.</li>
      </ol>
      <p>Si ya promocionaste sin tener Facebook, cuéntanos cuando te escribamos y lo revisamos contigo.</p>
    </div>,
  ],
  [
    '¿Cómo acepto la invitación a la beta?',
    <div key="invitacion">
      <p>Meta no siempre avisa con una notificación o un correo, así que conviene hacerlo a mano:</p>
      <ol>
        <li>
          Antes de que te invitemos, regístrate gratis en{' '}
          <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer">
            developers.facebook.com
          </a>{' '}
          con tu cuenta de Facebook: toca «Empezar» y verifica tu teléfono.
        </li>
        <li>Cuando te escribamos para avisarte que ya te invitamos, entra desde un computador con esa misma cuenta.</li>
        <li>
          Abre{' '}
          <a href="https://developers.facebook.com/requests/" target="_blank" rel="noopener noreferrer">
            developers.facebook.com/requests
          </a>{' '}
          y acepta la invitación de AdSmart.
        </li>
        <li>Vuelve a AdSmart y entra con Facebook.</li>
      </ol>
    </div>,
  ],
  [
    '¿Funciona con Google Ads o TikTok?',
    'Por ahora solo con Meta: Instagram y Facebook. Si te interesa otra plataforma, cuéntanos cuando te escribamos.',
  ],
  [
    '¿Pueden gastar mi dinero o cambiar mis anuncios?',
    'No. AdSmart no crea anuncios ni sube presupuestos. Solo puedes pausar una campaña tú mismo, con un botón y cuando lo decidas.',
  ],
];

function AlertRow({ tone, children, aside }) {
  return (
    <div className={`${styles.alert} ${styles[tone]}`}>
      <div className={styles.alertBody}>{children}</div>
      <span className={styles.amt}>{aside}</span>
    </div>
  );
}

export default function BetaLanding() {
  return (
    <div className={styles.root}>
      <MetaPixel />

      <header className={styles.top}>
        <div className={styles.wrap}>
          <div className={styles.logo}>
            <span className={styles.logoMark}>
              <Wallet aria-hidden="true" />
            </span>
            AdSmart
          </div>
          <div className={styles.topRight}>
            <span className={styles.beta}>Beta gratuita</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.wrap}>
            <div className={styles.heroCopy}>
              <h1>
                Deja de pagar anuncios que <span className={styles.money}>no te traen clientes</span>
              </h1>
              <p className={styles.lede}>
                AdSmart revisa tus campañas de Instagram y Facebook y te avisa en palabras simples cuáles gastan sin dar
                resultados. Sin planillas y sin ser experto.
              </p>
              <div className={styles.ctaRow}>
                <a className={styles.btn} href="#revision">
                  Revisar mis anuncios gratis <ArrowRight aria-hidden="true" />
                </a>
                <p className={styles.fine}>
                  <Check aria-hidden="true" />
                  Toma 1 minuto. Nada se pausa sin que tú lo decidas.
                </p>
              </div>
            </div>

            <div className={styles.panel} role="img" aria-label="Ejemplo del panel de AdSmart con alertas de campañas de Meta">
              <div className={styles.panelHead}>
                <b>Tus campañas · últimos 30 días</b>
                <span className={styles.tag}>Ejemplo</span>
              </div>
              <div className={styles.save}>
                <span>Podrías ahorrar al mes</span>
                <strong>
                  $184.000 <small>CLP</small>
                </strong>
              </div>
              {PANEL_ALERTS.map((a) => (
                <AlertRow key={a.title} tone={a.tone} aside={a.amount}>
                  <b>{a.title}</b>
                  <small>{a.detail}</small>
                </AlertRow>
              ))}
              <p className={styles.panelFoot}>Datos de ejemplo en pesos chilenos. Con tu cuenta verás tus propias campañas.</p>
            </div>
          </div>
        </section>

        <section className={`${styles.block} ${styles.alt}`}>
          <div className={styles.wrap}>
            <p className={styles.eyebrow}>¿Te ha pasado?</p>
            <h2>Pones plata en anuncios y no sabes si están funcionando</h2>
            <div className={styles.pains}>
              {PAINS.map(([strong, rest]) => (
                <p key={strong} className={styles.pain}>
                  <b>{strong}</b>
                  {rest}
                </p>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.block}>
          <div className={styles.wrap}>
            <p className={styles.eyebrow}>Cómo funciona</p>
            <h2>Así de simple</h2>
            <ol className={styles.steps}>
              {STEPS.map(([title, text], i) => (
                <li key={title} className={styles.step}>
                  <span className={styles.n}>{i + 1}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={`${styles.block} ${styles.alt}`}>
          <div className={styles.wrap}>
            <p className={styles.eyebrow}>Qué te avisa</p>
            <h2>Alertas que entiendes a la primera</h2>
            <p className={styles.sub}>
              Nada de siglas raras. Cada alerta te dice qué pasa y te sugiere qué hacer. La decisión siempre es tuya.
            </p>
            <div className={styles.alerts}>
              {ALERTS.map((a) => (
                <AlertRow key={a.title} tone={a.tone}>
                  <b>{a.title}</b>
                  <small>{a.detail}</small>
                  <p className={styles.todo}>
                    <ArrowRight aria-hidden="true" />
                    {a.todo}
                  </p>
                </AlertRow>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.block}>
          <div className={`${styles.wrap} ${styles.who}`}>
            <div>
              <p className={styles.eyebrow}>Para quién es</p>
              <h2>Hecho para quien maneja sus propios anuncios</h2>
              <p className={styles.sub}>Si inviertes en Instagram y Facebook sin una agencia detrás, AdSmart es para ti.</p>
              <div className={styles.chips}>
                {AUDIENCE.map((a) => (
                  <span key={a} className={styles.chip}>
                    {a}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className={styles.eyebrow}>Tu cuenta, tus decisiones</p>
              <ul className={styles.trust}>
                {TRUST.map(({ Icon, title, text }) => (
                  <li key={title}>
                    <span className={styles.ic}>
                      <Icon aria-hidden="true" />
                    </span>
                    <div>
                      <b>{title}</b>
                      <span>{text}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className={`${styles.block} ${styles.alt}`}>
          <div className={styles.wrap}>
            <p className={styles.eyebrow}>Preguntas frecuentes</p>
            <h2>Lo que más nos preguntan</h2>
            <div className={styles.faq}>
              {FAQ.map(([q, a]) => (
                <details key={q}>
                  <summary>{q}</summary>
                  {typeof a === 'string' ? <p>{a}</p> : a}
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.signup} id="revision">
          <div className={styles.wrap}>
            <div className={styles.signupCard}>
              <div>
                <p className={styles.eyebrow}>Cupos limitados en la beta</p>
                <h2>Tus anuncios deberían traer clientes, no gastos</h2>
                <p className={styles.sub}>Déjanos tus datos y te enviamos el acceso para revisar tus campañas gratis.</p>
              </div>
              <LeadForm />
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.wrap}>
          <span>© 2026 AdSmart</span>
          <a href="/privacidad">Política de privacidad</a>
          <span>AdSmart no está afiliado a Meta Platforms, Inc.</span>
        </div>
      </footer>

      <StickyCta />
    </div>
  );
}
