import Link from 'next/link';

// Política de privacidad (docs/SPEC.md §9). Meta la exige para revisar la app.
// Si cambia lo que se guarda, hay que actualizarla junto con UPDATED.
const RESPONSIBLE = 'AdSmart';
const CONTACT_EMAIL = 'adsmart@gmail.com';
const UPDATED = '22 de octubre de 2026';

export const metadata = {
  title: 'AdSmart · Política de privacidad',
  description: 'Qué datos guarda AdSmart, para qué, por cuánto tiempo y cómo pedir que se borren.',
};

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-fg">{title}</h2>
      <div className="mt-2 space-y-3 text-sm text-fg-2 leading-relaxed">{children}</div>
    </section>
  );
}

function List({ items }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5">
      {items.map((item) => (
        <li key={typeof item === 'string' ? item : item.key}>{item}</li>
      ))}
    </ul>
  );
}

export default function PrivacyPage() {
  return (
    <main className="px-4 md:px-6 py-10 pb-16 max-w-2xl mx-auto w-full">
      <Link href="/" className="text-sm font-medium text-muted hover:text-fg underline underline-offset-4 decoration-line-strong">
        ← Volver a AdSmart
      </Link>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-fg">Política de privacidad</h1>
      <p className="mt-1 text-sm text-muted">Última actualización: {UPDATED}</p>

      <p className="mt-6 text-sm text-fg-2 leading-relaxed">
        AdSmart revisa tus campañas de Facebook e Instagram y te avisa cuáles gastan sin dar resultados. Aquí explicamos qué datos
        guardamos, para qué, cuánto tiempo y cómo pedir que se borren. No vendemos tus datos ni los usamos para mostrarte publicidad.
      </p>

      <Section title="Quién es responsable">
        <p>
          El responsable de tus datos es {RESPONSIBLE}. Para cualquier consulta o pedido sobre tus datos, escríbenos a {CONTACT_EMAIL}.
        </p>
      </Section>

      <Section title="Qué datos guardamos">
        <p>
          <strong className="text-fg">Al conectar tu cuenta de Meta.</strong> Inicias sesión con Facebook y nos das permiso para leer y
          administrar tus anuncios (permisos <code>ads_read</code> y <code>ads_management</code>). Guardamos:
        </p>
        <List
          items={[
            'Tu identificador de usuario de Meta para AdSmart y tu correo electrónico. Meta también nos envía tu nombre y tu foto, pero no los guardamos.',
            'Las cuentas publicitarias que revisas: su identificador, su moneda y su zona horaria.',
            'Un resumen diario de cada campaña: estado, objetivo, gasto, impresiones, resultados, costo por resultado, otras métricas de rendimiento y las alertas que mostramos. Las campañas se guardan por su identificador, sin sus nombres ni el texto o las imágenes de los anuncios.',
            'Tus ajustes: cuánto ganas por venta y qué tareas de "Hoy" marcaste como hechas.',
            'Lo que haces en AdSmart: pausar o activar campañas y anuncios, crear una copia de una campaña, activar guardias o un tope de gasto, e iniciar sesión (con el tipo de dispositivo, sistema y navegador, por ejemplo "celular, iOS, Safari").',
          ]}
        />
        <p>
          El permiso de acceso que nos da Meta (token) no se guarda en nuestra base de datos: queda cifrado en una cookie de tu navegador
          y vence en unos 60 días.
        </p>
        <p>
          <strong className="text-fg">En la demo.</strong> Si usas la demo con campañas de ejemplo, guardamos de forma anónima qué
          pantallas y botones usas, el tamaño de tu pantalla y desde qué sitio o anuncio llegaste. La visita se reconoce con un número al
          azar que se borra al cerrar la pestaña: no sabemos quién eres.
        </p>
        <p>
          <strong className="text-fg">En el formulario de la beta.</strong> Si te inscribes en la página de la beta, guardamos el nombre,
          el correo o teléfono y el rango de inversión que escribas, además de los datos del anuncio por el que llegaste. En esa página
          usamos el Pixel de Meta para medir los resultados de nuestra campaña.
        </p>
        <p>
          <strong className="text-fg">Registros técnicos.</strong> Para detectar errores registramos cómo funciona la app (por ejemplo, si
          Meta respondió o falló un inicio de sesión), con tu identificador y tu correo parcialmente oculto. No registramos tu dirección
          IP ni tus cookies.
        </p>
      </Section>

      <Section title="Para qué los usamos">
        <List
          items={[
            'Mostrarte tus campañas, las alertas y las tareas del día.',
            'Hacer en Meta lo que tú confirmes, como pausar una campaña. Nunca cambiamos nada en tu cuenta sin que lo confirmes.',
            'Mejorar los criterios de las alertas, por ejemplo para no alertar de más, mirando métricas de muchas campañas en conjunto.',
            'Escribirte sobre la beta o sobre tu cuenta.',
            'Detectar y corregir errores, y mantener la app segura.',
          ]}
        />
      </Section>

      <Section title="Con quién los compartimos">
        <p>No vendemos ni compartimos tus datos con otras empresas, salvo con los proveedores que necesitamos para que la app funcione:</p>
        <List
          items={[
            'Meta Platforms: inicio de sesión y lectura y cambios de tus anuncios, siempre con tu permiso.',
            'Vercel: aloja la app.',
            'Neon: aloja la base de datos.',
            'Sentry: registra errores y el funcionamiento técnico.',
            'Google: guarda las inscripciones del formulario de la beta.',
          ]}
        />
        <p>Estos proveedores guardan los datos en servidores ubicados principalmente en Estados Unidos.</p>
      </Section>

      <Section title="Cuánto tiempo los guardamos">
        <List
          items={[
            'Tu usuario, tus cuentas, tus ajustes y tus acciones: hasta que pidas borrarlos o quites AdSmart de tu cuenta de Facebook.',
            'Los resúmenes diarios de campañas: 13 meses.',
            'El uso anónimo de la demo: 6 meses.',
            'Los registros técnicos: el plazo limitado que define nuestro proveedor de registros, que suele ser de semanas.',
          ]}
        />
      </Section>

      <Section title="Cómo borrar tus datos">
        <p>Puedes pedir que borremos tus datos de tres formas:</p>
        <List
          items={[
            'Quita AdSmart desde Facebook: Configuración y privacidad → Configuración → Integraciones comerciales (o Apps y sitios web). Al quitarla, Meta nos avisa y borramos tus datos automáticamente.',
            'Desde esa misma pantalla, pide que se eliminen los datos que AdSmart tiene de ti. Te daremos un código para revisar el estado del borrado.',
            `Escríbenos a ${CONTACT_EMAIL}.`,
          ]}
        />
        <p>
          Borramos tu usuario, tu correo, tus ajustes y tu historial de acciones. Las cuentas publicitarias que sólo revisabas tú se borran
          con sus resúmenes diarios; si otra persona también usa AdSmart con esa cuenta, sus resúmenes se mantienen para ella.
        </p>
      </Section>

      <Section title="Tus derechos">
        <p>
          Puedes pedirnos acceder a tus datos, corregirlos, borrarlos u oponerte a su uso, según la legislación chilena de protección de
          datos personales. Escríbenos a {CONTACT_EMAIL} y te responderemos dentro del plazo legal.
        </p>
      </Section>

      <Section title="Seguridad">
        <p>
          Las conexiones van cifradas, el permiso de Meta queda cifrado en tu navegador y sólo el equipo de AdSmart puede acceder a la
          base de datos.
        </p>
      </Section>

      <Section title="Menores de edad">
        <p>AdSmart es para personas mayores de 18 años que administran anuncios de su negocio.</p>
      </Section>

      <Section title="Cambios a esta política">
        <p>Si cambiamos esta política, publicaremos aquí la nueva versión con su fecha. Si el cambio es importante, te avisaremos.</p>
      </Section>

      <p className="mt-10 text-xs text-muted">AdSmart no está afiliado a Meta Platforms, Inc.</p>
    </main>
  );
}
