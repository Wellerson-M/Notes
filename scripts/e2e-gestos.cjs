/**
 * Teste dos gestos do card (deslizar para fixar/apagar, peteleco, toque) e do login direto na
 * folha da IA. O sync é simulado: nada é gravado no Atlas.
 *
 *   npm run build && npx next start -p 3123          (num terminal)
 *   E2E_PASSWORD=<sua APP_PASSWORD> npm run e2e:gestos
 */
const { chromium } = require('playwright-core')
const PW = process.env.E2E_PASSWORD
if (!PW) { console.error('Defina E2E_PASSWORD com a senha do app (APP_PASSWORD).'); process.exit(1) }
const BASE = process.env.E2E_BASE ?? 'http://localhost:3123'
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
let failures = 0
const ok = (n, c, extra = '') => { if (!c) failures++; console.log(`${c ? '✔' : '✘'} ${n} ${extra}`) }

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const ctx = await b.newContext({ viewport: { width: 400, height: 820 } })
  const page = await ctx.newPage()
  const W = (ms) => page.waitForTimeout(ms)
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/api/sync', (r) => r.fulfill({ status: 401, body: '{}' })) // não toca no Atlas

  await page.goto(BASE + '/'); await W(3000)
  const card = page.getByText('Bem-vindo ao Grafite').first()
  const box = await card.boundingBox()
  const y = box.y + 10
  const x0 = box.x + 150
  const translate = () => page.evaluate(() => {
    const el = [...document.querySelectorAll('[style*="touch-action: pan-y"]')][0]
    return new DOMMatrix(getComputedStyle(el).transform).m41
  })
  const pinned = () => page.evaluate(() => new Promise((res) => {
    const r = indexedDB.open('grafite-notas')
    r.onsuccess = () => { const g = r.result.transaction('notes').objectStore('notes').get('bem-vindo'); g.onsuccess = () => res(g.result?.pinned) }
  }))

  // 1. segue o dedo 1:1 (antes travava em ~80px)
  await page.mouse.move(x0, y); await page.mouse.down()
  await page.mouse.move(x0 - 100, y, { steps: 15 }); await W(50)
  const t100 = await translate()
  ok('segue o dedo 1:1 a -100px', Math.abs(t100 + 100) < 12, `translateX=${t100.toFixed(0)}`)
  // 2. arraste curto e lento volta sozinho
  await page.mouse.move(x0 - 60, y, { steps: 10 }); await page.mouse.up(); await W(600)
  ok('arraste curto volta ao lugar', Math.abs(await translate()) < 1 && await page.getByText('Bem-vindo ao Grafite').count())
  ok('arraste curto não apaga nem abre', !(await page.getByText('Nota apagada').count()) && !page.url().includes('/note'))

  // 3. deslizar para a direita além de 35% fixa/solta
  const before = await pinned()
  await page.mouse.move(x0 - 100, y); await page.mouse.down()
  await page.mouse.move(x0 + 80, y, { steps: 20 }); await page.mouse.up(); await W(800)
  ok('deslizar à direita alterna fixar', (await pinned()) === !before, `${before} → ${await pinned()}`)

  // 4. vertical não dispara deslize (trava de direção)
  await page.mouse.move(x0, y); await page.mouse.down()
  await page.mouse.move(x0 - 15, y + 120, { steps: 15 }); await W(50)
  ok('movimento vertical não arrasta o card', Math.abs(await translate()) < 20, `translateX=${(await translate()).toFixed(0)}`)
  await page.mouse.up(); await W(400)

  // 4b. arraste lento e curto (70px em ~0,7s) NÃO apaga
  await page.mouse.move(x0, y); await page.mouse.down()
  for (let dx = 7; dx <= 70; dx += 7) { await page.mouse.move(x0 - dx, y); await W(70) }
  await page.mouse.up(); await W(700)
  ok('arraste lento e curto não apaga nem abre', !(await page.getByText('Nota apagada').count()) && !page.url().includes('/note') && Math.abs(await translate()) < 1)

  // 5. peteleco rápido e curto apaga (com desfazer)
  await page.mouse.move(x0, y); await page.mouse.down()
  for (const dx of [20, 45, 70, 90]) { await page.mouse.move(x0 - dx, y); await W(16) } // ~16ms por evento, como um dedo real
  await page.mouse.up(); await W(900)
  ok('peteleco à esquerda apaga', await page.getByText('Nota apagada').count())
  await page.getByText('desfazer').click(); await W(1200)
  ok('desfazer traz de volta', await page.getByText('Bem-vindo ao Grafite').count())

  // 6. toque abre a nota
  await page.getByText('Bem-vindo ao Grafite').first().click(); await W(1500)
  ok('toque abre a nota', page.url().includes('/note?id='))

  // 7. IA sem conexão: campo de senha na própria folha, e depois funciona
  await page.unroute('**/api/sync')
  await page.route('**/api/sync', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"notes":[],"cursor":0}' }))
  await page.getByRole('button', { name: 'IA', exact: true }).click(); await W(600)
  await page.getByText('Resumir').click(); await W(2500)
  ok('IA pede a senha ali mesmo', await page.locator('input[placeholder="senha do app"]').count())
  await page.fill('input[placeholder="senha do app"]', PW); await page.getByRole('button', { name: 'Entrar' }).click(); await W(2500)
  ok('conecta pela folha da IA', await page.getByText('conectado ✓').count())
  await page.getByText('fechar').click(); await W(500)
  await page.getByRole('button', { name: 'IA', exact: true }).click(); await W(600)
  await page.getByText('Resumir').click()
  await page.getByText(/Inserir no fim|Limite gratuito|sobrecarregada/).first().waitFor({ timeout: 45000 }).catch(() => {})
  ok('IA responde depois de conectar', await page.getByText(/Inserir no fim/).count(), (await page.getByText(/Limite gratuito|sobrecarregada/).count()) ? '(limite/sobrecarga)' : '')
  await page.screenshot({ path: '.e2e/swipe-ia.png' })

  ok('sem erros de JS', !errors.length, errors.join(' | '))
  await b.close()
  if (failures) process.exitCode = 1
})().catch((e) => { console.error('ERRO FATAL', e.message); process.exit(1) })
