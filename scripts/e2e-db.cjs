/**
 * Zera o banco de testes antes do e2e. Os testes NUNCA usam o banco real: o servidor de teste
 * sobe com MONGODB_DB=grafite-notas-e2e (ver docs/TESTES.md). Recusa qualquer outro nome.
 *
 *   node --env-file=.env.local scripts/e2e-db.cjs
 */
const { MongoClient } = require('mongodb')

const TEST_DB = 'grafite-notas-e2e'

;(async () => {
  const uri = process.env.MONGODB_URI?.trim().replace(/^(['"])(.*)\1$/, '$2')
  if (!uri) { console.error('Falta MONGODB_URI (use --env-file=.env.local).'); process.exit(1) }
  const client = new MongoClient(uri)
  await client.connect()
  await client.db(TEST_DB).dropDatabase()
  console.log(`banco de testes "${TEST_DB}" zerado`)
  await client.close()
})().catch((e) => { console.error(e.message); process.exit(1) })
