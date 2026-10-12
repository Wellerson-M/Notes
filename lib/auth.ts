import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

/**
 * Login de usuário único: a senha mora em APP_PASSWORD (.env.local / Vercel).
 * O cookie guarda um HMAC derivado da senha — trocar a senha desloga todos os aparelhos.
 */
export const SESSION_COOKIE = 'grafite_session'

function sessionToken(): string | null {
  const password = process.env.APP_PASSWORD
  if (!password) return null
  return createHmac('sha256', password).update('grafite-session-v1').digest('hex')
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

export function checkPassword(password: string): boolean {
  const expected = process.env.APP_PASSWORD
  return !!expected && safeEqual(password, expected)
}

export function createSessionValue(): string {
  const token = sessionToken()
  if (!token) throw new Error('APP_PASSWORD não configurada')
  return token
}

export async function isAuthenticated(): Promise<boolean> {
  const token = sessionToken()
  const value = (await cookies()).get(SESSION_COOKIE)?.value
  return !!token && !!value && safeEqual(value, token)
}

export const unauthorized = () => Response.json({ error: 'não autenticado' }, { status: 401 })

/**
 * Chave do link da agenda (feed .ics). Apps de agenda não mandam cookie, então o link leva uma
 * chave derivada da APP_PASSWORD: trocar a senha invalida o link antigo.
 */
export function calendarToken(): string | null {
  const password = process.env.APP_PASSWORD
  if (!password) return null
  return createHmac('sha256', password).update('grafite-calendar-v1').digest('hex').slice(0, 32)
}

export function checkCalendarToken(value: string | null): boolean {
  const token = calendarToken()
  return !!token && !!value && safeEqual(value, token)
}
