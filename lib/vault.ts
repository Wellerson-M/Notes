'use client'
import { db, getMeta, setMeta } from './db'
import { useUIStore } from '@/store/ui'

/**
 * Vault cifrado no aparelho. Título, conteúdo e tags das notas do Vault viram um único
 * `cipher` (AES-GCM 256) antes de gravar — o Atlas, o sync e os backups só veem o cifrado.
 *
 * A chave sai de uma senha do Vault (PBKDF2-SHA256) e vive só na memória enquanto o Vault
 * está aberto. O sal vai dentro de cada `cipher`, então outro aparelho consegue derivar a
 * mesma chave com a mesma senha. Esquecer a senha = perder as notas do Vault (não há volta).
 *
 * Biometria (WebAuthn) é uma conveniência por aparelho: guarda a chave como CryptoKey não
 * extraível no IndexedDB e só a libera depois de o sistema confirmar a digital/rosto/PIN.
 */

const VERSION = 'gv1'
const ITERATIONS = 310_000
const AUTO_LOCK_MS = 60_000

export class VaultLockedError extends Error {
  constructor() { super('O Vault está trancado') }
}

type Payload = { title: string | null; content: string; tags: string[] }

/** Chaves derivadas da senha, por sal (normalmente um só) */
let keys = new Map<string, CryptoKey>()

// ── base64url ──────────────────────────────────────────────────────────
function toB64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n))

async function deriveKey(password: string, salt: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(salt), iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function parse(cipher: string) {
  const [v, salt, iv, data] = cipher.split('.')
  if (v !== VERSION || !salt || !iv || !data) throw new Error('cipher inválido')
  return { salt, iv, data }
}

// ── Estado ─────────────────────────────────────────────────────────────
export const isUnlocked = () => keys.size > 0

/**
 * Sal "oficial" deste Vault: o criado neste aparelho, ou o de qualquer nota cifrada que veio
 * pelo sync. O descoberto não é gravado: se essas notas forem apagadas, o Vault volta a "não criado".
 */
async function primarySalt(): Promise<string | undefined> {
  const saved = await getMeta<string>('vaultSalt')
  if (saved) return saved
  const any = await db.notes.filter((n) => !!n.cipher && !n.deleted).first()
  return any?.cipher ? parse(any.cipher).salt : undefined
}

export async function isConfigured(): Promise<boolean> {
  return !!(await primarySalt())
}

function setUnlocked(next: Map<string, CryptoKey>) {
  keys = next
  useUIStore.getState().setVaultLocked(next.size === 0)
}

export function lock() {
  setUnlocked(new Map())
}

// ── Cifrar / decifrar ──────────────────────────────────────────────────
export async function encrypt(payload: Payload): Promise<string> {
  const salt = await primarySalt()
  const key = salt && keys.get(salt)
  if (!salt || !key) throw new VaultLockedError()
  const iv = random(12)
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(payload)))
  return [VERSION, salt, toB64(iv), toB64(new Uint8Array(data))].join('.')
}

/** Decifra com as chaves abertas; lança VaultLockedError se não houver chave para esse sal */
export async function decrypt(cipher: string): Promise<Payload> {
  const { salt, iv, data } = parse(cipher)
  const key = keys.get(salt)
  if (!key) throw new VaultLockedError()
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, key, fromB64(data))
  return JSON.parse(new TextDecoder().decode(plain)) as Payload
}

// ── Senha ──────────────────────────────────────────────────────────────
/** Todos os sais em uso (aparelhos diferentes podem ter criado o Vault com sais diferentes) */
async function allSalts(): Promise<string[]> {
  const salts = new Set<string>()
  const main = await primarySalt()
  if (main) salts.add(main)
  await db.notes.each((n) => { if (n.cipher && !n.deleted) salts.add(parse(n.cipher).salt) })
  return [...salts]
}

/** Primeira vez: cria o sal e a senha do Vault (e guarda um verificador local) */
export async function setup(password: string) {
  const salt = toB64(random(16))
  const key = await deriveKey(password, salt)
  await setMeta('vaultSalt', salt)
  setUnlocked(new Map([[salt, key]]))
  await setMeta('vaultCheck', await encrypt({ title: null, content: 'ok', tags: [] }))
}

/** Confere a senha decifrando algo existente. Devolve false se a senha estiver errada. */
export async function unlock(password: string): Promise<boolean> {
  const salts = await allSalts()
  if (!salts.length) return false
  const next = new Map<string, CryptoKey>()
  for (const salt of salts) next.set(salt, await deriveKey(password, salt))

  const sample = (await getMeta<string>('vaultCheck')) ??
    (await db.notes.filter((n) => !!n.cipher && !n.deleted).first())?.cipher
  if (sample) {
    const { salt, iv, data } = parse(sample)
    try {
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, next.get(salt)!, fromB64(data))
    } catch {
      return false
    }
  }
  setUnlocked(next)
  if (await biometricEnabled()) await db.secrets.put({ key: 'vaultKeys', value: next })
  return true
}

// ── Biometria (WebAuthn) ───────────────────────────────────────────────
export function biometricSupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential && window.isSecureContext
}

export async function biometricEnabled(): Promise<boolean> {
  return !!(await getMeta<string>('vaultCredential'))
}

/** Liga a biometria neste aparelho (precisa do Vault aberto) */
export async function enableBiometric(): Promise<boolean> {
  if (!isUnlocked() || !biometricSupported()) return false
  const cred = (await navigator.credentials.create({
    publicKey: {
      rp: { name: 'Notas', id: location.hostname },
      user: { id: random(16), name: 'vault', displayName: 'Vault das Notas' },
      challenge: random(32),
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60_000,
    },
  }).catch(() => null)) as PublicKeyCredential | null
  if (!cred) return false
  await setMeta('vaultCredential', toB64(new Uint8Array(cred.rawId)))
  await db.secrets.put({ key: 'vaultKeys', value: keys })
  return true
}

export async function disableBiometric() {
  await db.meta.delete('vaultCredential')
  await db.secrets.delete('vaultKeys')
}

/** Pede a biometria ao sistema e, se confirmada, abre o Vault com a chave guardada */
export async function unlockWithBiometric(): Promise<boolean> {
  const credId = await getMeta<string>('vaultCredential')
  const stored = (await db.secrets.get('vaultKeys'))?.value as Map<string, CryptoKey> | undefined
  if (!credId || !stored?.size) return false
  const ok = await navigator.credentials.get({
    publicKey: {
      challenge: random(32),
      allowCredentials: [{ type: 'public-key', id: fromB64(credId) }],
      userVerification: 'required',
      timeout: 60_000,
    },
  }).catch(() => null)
  if (!ok) return false
  setUnlocked(stored)
  return true
}

/** Tranca sozinho quando o app fica em segundo plano por mais de um minuto */
export function startAutoLock() {
  let timer: ReturnType<typeof setTimeout> | null = null
  const onVisibility = () => {
    if (timer) { clearTimeout(timer); timer = null }
    if (document.visibilityState === 'hidden' && isUnlocked()) timer = setTimeout(lock, AUTO_LOCK_MS)
  }
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    document.removeEventListener('visibilitychange', onVisibility)
    if (timer) clearTimeout(timer)
  }
}
