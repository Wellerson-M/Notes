import 'server-only'
import { usageCollection, type UsageDoc } from './mongo'
import { quotaDay } from './ai-models'

type Tokens = { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }
export type Outcome = 'ok' | 'limited' | 'error'

/** Soma um pedido ao contador do dia. Nunca derruba a resposta: se o banco falhar, só não conta. */
export async function recordUsage(model: string, outcome: Outcome, tokens?: Tokens) {
  try {
    const day = quotaDay()
    const col = await usageCollection()
    await col.updateOne(
      { _id: `${day}|${model}` },
      {
        $setOnInsert: { day, model },
        $inc: {
          requests: outcome === 'ok' ? 1 : 0,
          limited: outcome === 'limited' ? 1 : 0,
          errors: outcome === 'error' ? 1 : 0,
          inputTokens: tokens?.promptTokenCount ?? 0,
          outputTokens: (tokens?.candidatesTokenCount ?? 0) + (tokens?.thoughtsTokenCount ?? 0),
        },
        ...(outcome === 'limited' ? { $set: { lastLimitedAt: Date.now() } } : {}),
      },
      { upsert: true },
    )
  } catch (err) {
    console.error('[usage]', err)
  }
}

/** Uso de hoje (por modelo) e dos últimos 7 dias */
export async function usageReport() {
  const today = quotaDay()
  const week = quotaDay(new Date(Date.now() - 6 * 86400000))
  const col = await usageCollection()
  const rows = await col.find({ day: { $gte: week } }).toArray()
  const clean = ({ _id: _i, ...r }: UsageDoc) => r
  return {
    today,
    todayByModel: rows.filter((r) => r.day === today).map(clean),
    week: rows.map(clean),
  }
}
