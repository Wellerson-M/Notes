import { cookies } from 'next/headers'
import { checkPassword, createSessionValue, isAuthenticated, SESSION_COOKIE } from '@/lib/auth'

/** Diz se este aparelho está logado e se o servidor tem o que precisa */
export async function GET() {
  return Response.json({
    authenticated: await isAuthenticated(),
    configured: !!process.env.APP_PASSWORD && !!process.env.MONGODB_URI,
    ai: !!process.env.GEMINI_API_KEY,
  })
}

export async function POST(request: Request) {
  const { password } = (await request.json().catch(() => ({}))) as { password?: string }
  if (!password || !checkPassword(password)) {
    await new Promise((r) => setTimeout(r, 800)) // freia tentativa e erro
    return Response.json({ error: 'senha incorreta' }, { status: 401 })
  }
  ;(await cookies()).set(SESSION_COOKIE, createSessionValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return Response.json({ ok: true })
}

export async function DELETE() {
  ;(await cookies()).delete(SESSION_COOKIE)
  return Response.json({ ok: true })
}
