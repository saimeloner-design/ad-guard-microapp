import { CircleCheck, Clock, SearchX } from 'lucide-react';
import { getDeletionRequest } from '@/lib/data-deletion';

// Estado de un pedido de borrado de datos hecho desde Facebook (docs/SPEC.md §9).
// Meta le muestra al usuario esta URL con su código de confirmación.
export const metadata = {
  title: 'AdSmart · Borrado de datos',
  robots: { index: false },
};

const formatDate = (date) =>
  new Date(date).toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Santiago' });

async function statusFor(code) {
  if (!code) return { icon: SearchX, title: 'Falta el código de confirmación', text: 'Abre el enlace que te mostró Facebook al pedir el borrado.' };
  let request;
  try {
    request = await getDeletionRequest(code);
  } catch {
    return { icon: Clock, title: 'No pudimos revisar tu pedido ahora', text: 'Intenta de nuevo en unos minutos.' };
  }
  if (!request) return { icon: SearchX, title: 'No encontramos ese código', text: `Revisa que el código ${code} esté completo.` };
  if (!request.completed_at) return { icon: Clock, title: 'Estamos borrando tus datos', text: `Pedido recibido el ${formatDate(request.requested_at)}.` };
  return {
    icon: CircleCheck,
    title: 'Tus datos fueron borrados',
    text: `Borramos tu cuenta, tu correo, tus ajustes y tu historial de AdSmart el ${formatDate(request.completed_at)}. Código: ${code}.`,
  };
}

export default async function Page({ searchParams }) {
  const code = (await searchParams).codigo;
  const { icon: Icon, title, text } = await statusFor(typeof code === 'string' ? code : undefined);
  return (
    <main className="flex-1 grid place-items-center px-4 py-12">
      <div className="w-full max-w-md text-center px-6 py-12 bg-surface border border-line rounded-2xl shadow-sm">
        <div className="mx-auto size-12 grid place-items-center rounded-2xl ring-4 bg-indigo-50 text-indigo-600 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/10">
          <Icon className="size-6" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-base font-semibold text-fg">{title}</h1>
        <p className="mt-1.5 text-sm text-muted leading-relaxed">{text}</p>
      </div>
    </main>
  );
}
