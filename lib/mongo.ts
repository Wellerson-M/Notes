import 'server-only'
import { MongoClient, type Collection } from 'mongodb'
import type { Note } from './types'

/** Documento no Atlas: a nota + o carimbo do servidor usado como cursor de sync */
export type NoteDoc = Omit<Note, 'id'> & { _id: string; syncedAt: number }

const globalForMongo = globalThis as unknown as { mongoClient?: Promise<MongoClient>; indexed?: Promise<unknown> }

/** Valor de variável de ambiente sem espaços nem aspas em volta (é comum colar `"mongodb+srv://..."` na Vercel) */
export function cleanEnv(value: string | undefined): string | undefined {
  const v = value?.trim().replace(/^(['"])(.*)\1$/, '$2').trim()
  return v || undefined
}

function client(): Promise<MongoClient> {
  const uri = cleanEnv(process.env.MONGODB_URI)
  if (!uri) throw new Error('MONGODB_URI não configurada')
  // Reaproveita a conexão entre requisições (e entre hot reloads no dev). Se falhar, a próxima tenta de novo.
  globalForMongo.mongoClient ??= new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 })
    .connect()
    .catch((err) => { globalForMongo.mongoClient = undefined; globalForMongo.indexed = undefined; throw err })
  return globalForMongo.mongoClient
}

/** Traduz falhas do banco num motivo que dá para resolver (sem expor a URI) */
export function describeDbError(err: unknown): string {
  const e = err as { name?: string; code?: number; codeName?: string; message?: string }
  if (e.name === 'MongoParseError' || /Invalid scheme|URI/i.test(e.message ?? '')) {
    return 'A MONGODB_URI na Vercel está mal formatada (tem aspas ou espaços?). Cole só mongodb+srv://... e faça o Redeploy.'
  }
  if (e.code === 18 || e.codeName === 'AuthenticationFailed' || /auth/i.test(e.message ?? '')) {
    return 'O Atlas recusou o usuário ou a senha da MONGODB_URI.'
  }
  if (e.name === 'MongoServerSelectionError' || /ENOTFOUND|ECONNREFUSED|timed out/i.test(e.message ?? '')) {
    return 'O Atlas não deixou a Vercel conectar. Em Network Access, libere 0.0.0.0/0.'
  }
  return 'O banco de dados falhou agora. Tente de novo em instantes.'
}

export async function notesCollection(): Promise<Collection<NoteDoc>> {
  const db = (await client()).db(cleanEnv(process.env.MONGODB_DB) ?? 'grafite-notas')
  const col = db.collection<NoteDoc>('notes')
  globalForMongo.indexed ??= col.createIndex({ syncedAt: 1 })
  await globalForMongo.indexed
  return col
}
