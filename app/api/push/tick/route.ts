import { timingSafeEqual } from 'node:crypto'
import { cronToken, runReminders } from '@/lib/push'

/**
 * O "relógio" dos lembretes: um serviço de cron (cron-job.org) chama esta rota a cada minuto.
 * Acesso pela chave do link (?k=), sem cookie. Chamar a mais é inofensivo.
 */
async function tick(request: Request) {
  const token = cronToken()
  const k = new URL(request.url).searchParams.get('k') ?? ''
  if (!token || k.length !== token.length || !timingSafeEqual(Buffer.from(k), Buffer.from(token))) {
    return new Response('não autorizado', { status: 401 })
  }
  try {
    const result = await runReminders('relógio')
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[api/push/tick]', err)
    return Response.json({ error: 'falhou' }, { status: 500 })
  }
}

export const GET = tick
export const POST = tick
