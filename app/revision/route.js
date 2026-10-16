// Muestra qué commit está desplegado. Vercel inyecta estas variables en cada deployment.
export async function GET() {
  return Response.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
    branch: process.env.VERCEL_GIT_COMMIT_REF || null,
    message: process.env.VERCEL_GIT_COMMIT_MESSAGE || null,
    environment: process.env.VERCEL_ENV || 'development',
    deploymentUrl: process.env.VERCEL_URL || null,
  });
}
