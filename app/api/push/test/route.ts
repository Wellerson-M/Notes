import { isAuthenticated, unauthorized } from '@/lib/auth'
import { sendToAll } from '@/lib/push'

/** Notificação de teste: só para o aparelho que pediu (ou todos, sem endpoint) */
export async function POST(request: Request) {
  if (!(await isAuthenticated())) return unauthorized()
  const body = await request.json().catch(() => null) as { endpoint?: unknown } | null
  const only = typeof body?.endpoint === 'string' ? body.endpoint : undefined
  const delivered = await sendToAll({ title: 'Notas', body: 'Os lembretes estão funcionando ✓', url: '/settings', tag: 'teste' }, only)
  return Response.json({ delivered })
}
