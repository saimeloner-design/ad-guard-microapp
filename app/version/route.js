// Muestra el hash corto del commit desplegado. Vercel inyecta esta variable en cada deployment.
export async function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  return new Response(sha ? sha.slice(0, 7) : 'local', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
