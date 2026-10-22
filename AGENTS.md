## Consideraciones generales
- Responde siempre en español
- Se trabaja siempre en la rama `develop`. Después de hacer un commit, haz siempre `git push` (a `develop`)
- Nunca hagas commit ni push directamente a `main`. Sólo cuando el usuario pida pasar a producción: `git checkout main && git merge --ff-only develop && git push`, y vuelve a `develop`
- Después de cada `git push`, lanza `npm run notify:deploy` en segundo plano (desde la rama que acabas de subir) para que avise con terminal-notifier cuando termine el deploy

## Datos del proyecto
- Next.js 16 con next-auth
- desplegado en Vercel
- Dos entornos, ambos en Vercel (no se usa localhost):
  - **Producción** — rama `main`, `https://ad-guard-microapp.vercel.app`. La usan los testers: no se toca salvo para publicar lo probado en desarrollo.
  - **Desarrollo** — rama `develop`, `https://ad-guard-microapp-dev.vercel.app` (entorno Preview con dominio fijo). Aquí se prueban los cambios. Sus variables propias (`NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `META_APP_SECRET`) están en Preview limitadas a la rama `develop`; no tiene Pixel de Meta ni hoja de leads de `/beta`.
- Los deploys de preview de otras ramas no se usan: no hace falta configurar variables ni redirect URIs para ellos.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
