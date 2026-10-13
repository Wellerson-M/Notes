import { isAuthenticated, unauthorized } from '@/lib/auth'
import { dailyBackup, getBackup, listBackups } from '@/lib/backups'
import { describeDbError } from '@/lib/mongo'

/**
 * Cópias automáticas do servidor (ver lib/backups.ts).
 * GET → lista; GET ?day=AAAA-MM-DD → baixa a cópia daquele dia (mesmo formato do backup .json).
 * POST → faz a cópia de hoje agora, se ainda não existir.
 */
export async function GET(request: Request) {
  if (!(await isAuthenticated())) return unauthorized()
  try {
    const day = new URL(request.url).searchParams.get('day')
    if (!day) return Response.json({ backups: await listBackups() })
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return Response.json({ error: 'dia inválido' }, { status: 400 })
    const data = await getBackup(day)
    if (!data) return Response.json({ error: 'cópia não encontrada' }, { status: 404 })
    return new Response(data, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="grafite-notas-servidor-${day}.json"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[api/backup]', err)
    return Response.json({ error: describeDbError(err) }, { status: 500 })
  }
}

export async function POST() {
  if (!(await isAuthenticated())) return unauthorized()
  try {
    return Response.json({ result: await dailyBackup() })
  } catch (err) {
    console.error('[api/backup]', err)
    return Response.json({ error: describeDbError(err) }, { status: 500 })
  }
}
