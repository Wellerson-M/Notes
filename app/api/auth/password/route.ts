import { cookies } from 'next/headers'
import { changeAppPassword, checkPassword, isAuthenticated, SESSION_COOKIE, SESSION_COOKIE_OPTIONS, unauthorized } from '@/lib/auth'

const MIN_LENGTH = 8

/**
 * Troca a senha do app. Pede a senha atual (mesmo logado), grava a nova como hash no Atlas e
 * renova o cookie deste aparelho; os outros aparelhos saem e entram de novo com a senha nova.
 */
export async function POST(request: Request) {
  if (!(await isAuthenticated())) return unauthorized()
  const { current, next } = (await request.json().catch(() => ({}))) as { current?: string; next?: string }
  if (!current || !(await checkPassword(current).catch(() => false))) {
    await new Promise((r) => setTimeout(r, 800)) // freia tentativa e erro
    return Response.json({ error: 'A senha atual não confere.' }, { status: 403 })
  }
  if (typeof next !== 'string' || next.length < MIN_LENGTH) {
    return Response.json({ error: `A senha nova precisa de pelo menos ${MIN_LENGTH} caracteres.` }, { status: 400 })
  }
  if (next === current) return Response.json({ error: 'A senha nova é igual à atual.' }, { status: 400 })
  try {
    const token = await changeAppPassword(next)
    ;(await cookies()).set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS)
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[api/auth/password]', err)
    return Response.json({ error: 'Não deu para gravar a senha nova agora. Tente de novo.' }, { status: 500 })
  }
}
