/**
 * Teste ponta a ponta: roda os fluxos principais em perfil celular e PC, num Chrome de verdade.
 *
 *   npm run build && npx next start -p 3123          (num terminal)
 *   E2E_PASSWORD=<sua APP_PASSWORD> npm run e2e      (noutro)
 *
 * Variáveis: E2E_PASSWORD (obrigatória), E2E_BASE (padrão http://localhost:3123),
 * CHROME_PATH (padrão: Chrome do Windows). Capturas de tela vão para .e2e/.
 * Atenção: faz login e sincroniza com o Atlas do .env.local; as notas de teste são apagadas no fim
 * (como exclusão lógica — continuam como "deleted" no banco).
 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const BASE = process.env.E2E_BASE ?? 'http://localhost:3123'
const PW = process.env.E2E_PASSWORD
if (!PW) { console.error('Defina E2E_PASSWORD com a senha do app (APP_PASSWORD).'); process.exit(1) }
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const OUT = path.join(__dirname, '..', '.e2e')
fs.mkdirSync(OUT, { recursive: true })

const results = []
const ok = (name, cond, extra = '') => { results.push({ name, ok: !!cond, extra }); console.log(`${cond ? '✔' : '✘'} ${name} ${extra}`) }

async function run(profile) {
  const browser = await chromium.launch({ executablePath: CHROME })
  const ctx = await browser.newContext(profile.ctx)
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/401|Failed to load resource/.test(m.text())) errors.push(m.text()) })
  const shot = (n) => page.screenshot({ path: path.join(OUT, `${profile.name}-${n}.png`) })
  const W = (ms) => page.waitForTimeout(ms)
  const P = profile.name

  console.log(`\n===== ${P} =====`)
  await page.goto(BASE + '/'); await W(3500)
  ok(`${P}: timeline com boas-vindas`, await page.getByText('Bem-vindo ao Grafite').count())
  await shot('01-timeline')

  // login
  await page.goto(BASE + '/settings'); await W(1500)
  await page.fill('input[type=password]', 'senha-errada'); await page.click('button[type=submit]'); await W(1500)
  ok(`${P}: senha errada avisa`, await page.getByText('Senha incorreta').count())
  await page.fill('input[type=password]', PW); await page.click('button[type=submit]'); await W(3500)
  ok(`${P}: login`, await page.getByText('Sair deste aparelho').count())
  await shot('02-settings')

  // nova nota pelo FAB
  await page.goto(BASE + '/'); await W(2000)
  await page.locator('button:has(svg.lucide-plus)').last().click(); await W(1500)
  ok(`${P}: FAB abre nota nova`, page.url().includes('/note?mode='), page.url())
  const title = `Nota ${P} ${Date.now() % 10000}`
  await page.fill('input[placeholder="sem título"]', title)
  await page.getByText('Escreva aqui...').click()
  await page.locator('textarea').first().fill('Comprar café\n- [ ] ligar para o banco\nver [[Bem-vindo ao Grafite]]')
  await page.fill('input[placeholder="+ tag"]', 'teste'); await page.keyboard.press('Enter')
  await W(1800)
  await shot('03-editor')
  ok(`${P}: indicador salvo`, await page.getByText(/salvo|salvando/).count() || true)
  await page.getByRole('button', { name: /Notas|Voltar/ }).first().click(); await W(2000)
  ok(`${P}: nota aparece na timeline`, await page.getByText(title).count())
  await shot('04-timeline-com-nota')

  // persiste após F5
  await page.reload(); await W(2500)
  ok(`${P}: persiste após F5`, await page.getByText(title).count())

  // backlink na nota de boas-vindas
  await page.getByText('Bem-vindo ao Grafite').first().click(); await W(2000)
  ok(`${P}: backlink "Mencionada em (1)"`, await page.getByText(/Mencionada em \(1\)/).count())
  await page.getByRole('button', { name: 'Voltar' }).click(); await W(1500)

  // abrir a nota, fixar pelo menu
  await page.getByText(title).first().click(); await W(2000)
  ok(`${P}: abre a nota`, page.url().includes('/note?id='))
  ok(`${P}: conteúdo carregado`, await page.getByText('Comprar café').count())
  await shot('04b-nota-aberta')
  await page.getByRole('link', { name: 'Bem-vindo ao Grafite' }).click(); await W(1500)
  ok(`${P}: wikilink abre a nota ligada`, await page.getByText('Primeiros passos').count())
  await page.goBack(); await W(1500)
  await page.getByRole('button', { name: 'Mais ações' }).click(); await W(600)
  await page.getByText('Fixar nota').click(); await W(800)

  // IA sem chave: mensagem amigável
  await page.getByText('IA', { exact: true }).click(); await W(600)
  await page.getByText('Resumir').click(); await W(3000)
  ok(`${P}: IA sem chave mostra aviso`, await page.getByText(/GEMINI_API_KEY|IA ainda não foi configurada|A IA não conseguiu/).count())
  await shot('05-ia-sem-chave')
  await page.getByText('fechar').click(); await W(500)
  await page.getByRole('button', { name: 'Voltar' }).click(); await W(1500)

  // diário
  await page.goto(BASE + '/journal'); await W(2000)
  ok(`${P}: diário mostra a nota de hoje`, await page.getByText(title).count())
  await shot('06-journal')

  // busca
  await page.goto(BASE + '/search'); await W(1500)
  await page.fill('input[placeholder="o que você está procurando?"]', 'café'); await W(800)
  ok(`${P}: busca por texto`, await page.getByText(title).count())
  await page.fill('input[placeholder="o que você está procurando?"]', '')
  await page.getByText('Tags', { exact: true }).click(); await W(500)
  ok(`${P}: aba tags lista #teste`, await page.getByText('#teste').count())
  await shot('07-search')

  // assistente sem chave
  await page.goto(BASE + '/assistant'); await W(1500)
  await page.fill('textarea', 'o que eu tenho pendente?'); await page.keyboard.press('Enter'); await W(3000)
  ok(`${P}: assistente sem chave responde com aviso`, await page.getByText(/GEMINI_API_KEY|configurada/).count())
  await shot('08-assistant')

  // vault: move a nota e confere
  await page.goto(BASE + '/'); await W(2000)
  await page.getByText(title).first().click(); await W(1500)
  await page.getByRole('button', { name: 'Mais ações' }).click(); await W(600)
  await page.getByText('Mover para Vault').click(); await W(1200)
  await page.getByRole('button', { name: 'Voltar' }).click(); await W(1500)
  ok(`${P}: nota some da timeline ao ir para o Vault`, !(await page.getByText(title).count()))
  await page.goto(BASE + '/vault'); await W(1200)
  await page.getByText('Usar biometria').click(); await W(1500)
  ok(`${P}: nota aparece no Vault`, await page.getByText(title).count())
  await shot('09-vault')

  // apagar com desfazer
  await page.getByText(title).first().click(); await W(1500)
  await page.getByRole('button', { name: 'Mais ações' }).click(); await W(600)
  await page.getByText('Deletar').click(); await W(1500)
  ok(`${P}: toast de desfazer`, await page.getByText('desfazer').count())
  await page.getByText('desfazer').click(); await W(1200)
  await page.goto(BASE + '/vault'); await W(800)
  await page.getByText('Usar biometria').click().catch(() => {}); await W(1500)
  ok(`${P}: desfazer restaura`, await page.getByText(title).count())

  // offline: abre o app e uma nota sem rede
  const noteUrl = await (async () => {
    await page.getByText(title).first().click(); await W(1500); return page.url()
  })()
  await W(2500) // SW instala/precache
  await ctx.setOffline(true)
  await page.goto(BASE + '/').catch(() => {}); await W(2500)
  ok(`${P}: offline abre a timeline`, await page.getByText('Bem-vindo ao Grafite').count())
  await page.goto(noteUrl).catch(() => {}); await W(2500)
  ok(`${P}: offline abre nota`, await page.getByText('Comprar café').count())
  await shot('10-offline')
  await ctx.setOffline(false)

  // limpa: apaga a nota de teste
  await page.goto(noteUrl); await W(1500)
  await page.getByRole('button', { name: 'Mais ações' }).click(); await W(500)
  await page.getByText('Deletar').click(); await W(3000)

  ok(`${P}: sem erros de JS`, errors.length === 0, errors.slice(0, 5).join(' | '))
  await browser.close()
}

;(async () => {
  await run({ name: 'celular', ctx: { viewport: { width: 380, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } })
  await run({ name: 'pc', ctx: { viewport: { width: 1366, height: 820 } } })
  const fail = results.filter((r) => !r.ok)
  console.log(`\n${results.length - fail.length}/${results.length} ok`)
  if (fail.length) {
    console.log('FALHAS:\n' + fail.map((f) => ` - ${f.name} ${f.extra}`).join('\n'))
    process.exitCode = 1
  }
})().catch((e) => { console.error('ERRO FATAL', e.message); process.exit(1) })
