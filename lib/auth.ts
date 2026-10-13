import 'server-only'
import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { cookies } from 'next/headers'
import { mongoDb } from './mongo'

/**
 * Login de usuário único. A senha de fábrica mora em APP_PASSWORD (.env.local / Vercel); se ela
 * for trocada pelo app (Ajustes → Trocar senha), a nova fica no Atlas só como hash scrypt
 * (`app_meta/auth`) e passa a valer no lugar da de fábrica.
 * O cookie guarda um HMAC da APP_PASSWORD + a "versão" da senha: trocar a senha desloga todos os aparelhos.
 * Esqueceu a senha nova? Apague o documento `auth` da coleção `app_meta` no Atlas: volta a valer a APP_PASSWORD.
 */
export const SESSION_COOKIE = 'grafite_session'

/** Cookie de sessão: httpOnly, 1 ano */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
}

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>

type AuthDoc = { _id: string; hash: string; salt: string; version: string; changedAt: number }

/** Senha trocada pelo app (ou null = vale a APP_PASSWORD). Guardada 60s em memória por instância. */
let cached: { at: number; doc: AuthDoc | null } | null = null
const CACHE_MS = 60_000

async function authDoc(): Promise<AuthDoc | null> {
  if (!process.env.MONGODB_URI) return null
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.doc
  try {
    const doc = await (await mongoDb()).collection<AuthDoc>('app_meta').findOne({ _id: 'auth' })
    cached = { at: Date.now(), doc }
    return doc
  } catch (err) {
    // Banco fora do ar: segue com o último valor conhecido; sem nenhum, não dá para confirmar a sessão
    if (cached) return cached.doc
    throw err
  }
}

function sessionToken(version?: string): string | null {
  const password = process.env.APP_PASSWORD
  if (!password) return null
  return createHmac('sha256', password).update(version ? `grafite-session-v1|${version}` : 'grafite-session-v1').digest('hex')
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

export async function checkPassword(password: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD
  if (!expected) return false
  const doc = await authDoc()
  if (!doc) return safeEqual(password, expected)
  const hash = await scryptAsync(password, Buffer.from(doc.salt, 'hex'), 64)
  return timingSafeEqual(hash, Buffer.from(doc.hash, 'hex'))
}

export async function createSessionValue(): Promise<string> {
  const token = sessionToken((await authDoc())?.version)
  if (!token) throw new Error('APP_PASSWORD não configurada')
  return token
}

export async function isAuthenticated(): Promise<boolean> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value
  if (!value) return false
  const doc = await authDoc().catch(() => undefined)
  if (doc === undefined) return false
  const token = sessionToken(doc?.version)
  return !!token && safeEqual(value, token)
}

/** Grava a senha nova (como hash) e devolve o cookie novo deste aparelho; os outros saem */
export async function changeAppPassword(next: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scryptAsync(next, salt, 64)
  const doc: AuthDoc = { _id: 'auth', hash: hash.toString('hex'), salt: salt.toString('hex'), version: randomBytes(8).toString('hex'), changedAt: Date.now() }
  await (await mongoDb()).collection<AuthDoc>('app_meta').replaceOne({ _id: 'auth' }, doc, { upsert: true })
  cached = { at: Date.now(), doc }
  return sessionToken(doc.version)!
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
