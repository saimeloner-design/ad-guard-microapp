import { saveAfterResponse } from '@/lib/db';
import { cleanDemoEvent, saveDemoEvent } from '@/lib/demo-events';

// Uso anónimo de la demo (docs/SPEC.md §9). El navegador lo manda con sendBeacon y no espera
// respuesta: se guarda después de responder.
const MAX_BYTES = 2000;

export async function POST(request) {
  const text = await request.text().catch(() => '');
  if (text.length > MAX_BYTES) return new Response(null, { status: 413 });
  let event;
  try {
    event = cleanDemoEvent(JSON.parse(text));
  } catch {
    event = null;
  }
  if (!event) return new Response(null, { status: 400 });
  saveAfterResponse(`demo ${event.type}`, (db) => saveDemoEvent(db, event));
  return new Response(null, { status: 204 });
}
