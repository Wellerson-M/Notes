export const dynamic = 'force-dynamic'

/** Versão do deploy que está no ar — o app compara com a sua para saber se ficou velho */
export function GET() {
  return Response.json(
    { version: process.env.APP_VERSION, builtAt: process.env.APP_BUILT_AT },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
