import 'server-only'
import { MongoClient, type Collection } from 'mongodb'
import type { Note } from './types'

/** Documento no Atlas: a nota + o carimbo do servidor usado como cursor de sync */
export type NoteDoc = Omit<Note, 'id'> & { _id: string; syncedAt: number }

const globalForMongo = globalThis as unknown as { mongoClient?: Promise<MongoClient>; indexed?: Promise<unknown> }

function client(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI não configurada')
  // Reaproveita a conexão entre requisições (e entre hot reloads no dev)
  globalForMongo.mongoClient ??= new MongoClient(uri, { maxPoolSize: 5 }).connect()
  return globalForMongo.mongoClient
}

export async function notesCollection(): Promise<Collection<NoteDoc>> {
  const db = (await client()).db(process.env.MONGODB_DB ?? 'grafite-notas')
  const col = db.collection<NoteDoc>('notes')
  globalForMongo.indexed ??= col.createIndex({ syncedAt: 1 })
  await globalForMongo.indexed
  return col
}
