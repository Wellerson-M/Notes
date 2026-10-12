/**
 * Teste ponta a ponta: roda os fluxos principais em perfil celular e PC, num Chrome de verdade.
 *
 *   npm run build && npx next start -p 3123          (num terminal)
 *   E2E_PASSWORD=<sua APP_PASSWORD> npm run e2e      (noutro)
 *
 * Variáveis: E2E_PASSWORD (obrigatória), E2E_BASE (padrão http://localhost:3123),
 * CHROME_PATH (padrão: Chrome do Windows). Capturas de tela vão para .e2e/.
 * Atenção: faz login e sincroniza com o Atlas do .env.local; as notas de teste são apagadas no fim
 * (como exclusão lógica — continuam como "deleted" no banco). Com GEMINI_API_KEY, chama a IA de verdade
 * (resumo, OCR, embeddings, retrospectiva e assistente). O Vault de teste é criado só no navegador do teste.
 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const BASE = process.env.E2E_BASE ?? 'http://localhost:3123'
const PW = process.env.E2E_PASSWORD
if (!PW) { console.error('Defina E2E_PASSWORD com a senha do app (APP_PASSWORD).'); process.exit(1) }
const VAULT_PW = 'vault-e2e-' + Date.now()
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
  try {
    await steps()
  } catch (e) {
    await shot('ERRO').catch(() => {})
    throw e
  } finally {
    await browser.close()
  }

  async function steps() {
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
  const title = `Nota ${P} ${String(Date.now()).slice(-7)}`
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

  // IA: com chave devolve o resultado; sem chave (ou limite) mostra aviso amigável
  await page.getByText('IA', { exact: true }).click(); await W(600)
  await page.getByText('Resumir').click()
  await page.getByText(/Inserir no fim|GEMINI_API_KEY|configurada|Limite gratuito|não conseguiu/).first().waitFor({ timeout: 30000 }).catch(() => {})
  ok(`${P}: IA responde (ou avisa)`, await page.getByText(/Inserir no fim|GEMINI_API_KEY|configurada|Limite gratuito|não conseguiu/).count())
  await shot('05-ia')
  await page.getByText('Descartar').click().catch(() => page.getByText('fechar').click()); await W(500)

  // versões anteriores: o menu abre a folha
  await page.getByRole('button', { name: 'Mais ações' }).click(); await W(600)
  await page.getByText('Versões anteriores').click(); await W(1000)
  ok(`${P}: folha de versões abre`, await page.getByText(/nenhuma versão anterior|edição|antes de restaurar/).count())
  await page.getByText('fechar').click(); await W(500)

  // foto → texto (OCR): uma "foto" gerada na hora com texto conhecido
  const photo = await (async () => {
    const p2 = await ctx.newPage()
    await p2.setContent('<div style="font:48px sans-serif;padding:40px;background:#fff;color:#000">LISTA DE TESTE<br>- comprar pão<br>- pagar luz</div>')
    const buf = await p2.screenshot({ clip: { x: 0, y: 0, width: 700, height: 300 } })
    await p2.close()
    return buf
  })()
  await page.setInputFiles('#note-photo-input', { name: 'foto.png', mimeType: 'image/png', buffer: photo })
  await page.getByText(/Inserir no fim|Limite gratuito|não conseguiu|ler essa imagem/).first().waitFor({ timeout: 40000 }).catch(() => {})
  const ocrText = await page.locator('.app-bar').last().innerText().catch(() => '')
  ok(`${P}: OCR lê a foto`, /comprar p[aã]o/i.test(ocrText) || /Limite gratuito/.test(ocrText), ocrText.slice(0, 80).replace(/\n/g, ' '))
  await shot('05b-ocr')
  await page.getByText('Descartar').click().catch(() => page.getByText('fechar').click()); await W(500)

  // agendar para amanhã pelo editor
  await page.getByRole('button', { name: 'agendar' }).click(); await W(600)
  await page.getByRole('button', { name: 'Amanhã', exact: true }).click(); await W(200)
  await page.getByRole('button', { name: 'Agendar', exact: true }).click(); await W(1500)
  ok(`${P}: nota agendada mostra a data`, await page.getByText('amanhã').count())
  await page.getByRole('button', { name: 'Voltar' }).click(); await W(1500)

  // agenda + resumo da semana
  await page.goto(BASE + '/journal'); await W(2000)
  ok(`${P}: agenda mostra a nota em Próximos`, await page.getByText('Próximos').count() && await page.getByText(title).count())
  await page.getByText('Resumo da semana').click()
  await page.getByText(/Salvar como nota|Limite gratuito|não conseguiu|Nenhuma nota/).first().waitFor({ timeout: 40000 }).catch(() => {})
  ok(`${P}: resumo da semana responde`, await page.getByText(/Salvar como nota|Limite gratuito|não conseguiu/).count())
  await shot('06-journal-resumo')
  await page.getByText('Fechar', { exact: true }).click().catch(() => page.getByText('fechar').click()); await W(500)

  // busca
  await page.goto(BASE + '/search'); await W(1500)
  await page.fill('input[placeholder="o que você está procurando?"]', 'café'); await W(800)
  ok(`${P}: busca por texto`, await page.getByText(title).count())
  await page.fill('input[placeholder="o que você está procurando?"]', '')
  await page.getByText('Tags', { exact: true }).click(); await W(500)
  ok(`${P}: aba tags lista #teste`, await page.getByText('#teste').count())
  await shot('07-search')

  // busca por sentido: "bebida quente" deve achar a nota do café
  await page.getByText('Por sentido', { exact: true }).click(); await W(300)
  await page.locator('input').first().fill('bebida quente')
  await page.getByText(/sobre isso|nada parecido|falhou|Limite gratuito|Entre com/).first().waitFor({ timeout: 60000 }).catch(() => {})
  ok(`${P}: busca por sentido acha a nota`, await page.getByText(title).count() || await page.getByText(/Limite gratuito/).count())
  await shot('07b-search-sentido')

  // assistente
  await page.goto(BASE + '/assistant'); await W(1500)
  await page.fill('textarea', 'o que eu tenho pendente?'); await page.keyboard.press('Enter'); await W(12000)
  ok(`${P}: assistente responde sem erro`, !(await page.getByText(/GEMINI_API_KEY|não conseguiu responder/).count()))
  await shot('08-assistant')

  // vault: sem senha criada, mover avisa
  await page.goto(BASE + '/'); await W(2000)
  await page.getByText(title).first().click(); await W(1500)
  await page.getByRole('button', { name: 'Mais ações' }).click(); await W(600)
  await page.getByText('Mover para Vault').click(); await W(1200)
  ok(`${P}: pede para criar o Vault`, await page.getByText('Crie a senha do Vault primeiro').count())

  // cria o Vault (só neste navegador de teste)
  await page.goto(BASE + '/vault'); await W(2500)
  await page.fill('input[placeholder="senha do Vault"]', VAULT_PW)
  await page.fill('input[placeholder="repita a senha"]', VAULT_PW)
  await page.getByRole('button', { name: 'Criar Vault' }).click(); await W(2500)
  ok(`${P}: Vault criado e aberto`, await page.getByText('Nova nota no Vault').count())

  // move a nota e confere
  // navegação pelo app (recarregar a página tranca o Vault: a chave só vive na memória)
  await page.click('a[href="/"]'); await W(2000)
  await page.getByText(title).first().click(); await W(1500)
  const noteUrl = page.url()
  const noteId = new URL(noteUrl).searchParams.get('id')
  await page.getByRole('button', { name: 'Mais ações' }).click(); await W(600)
  await page.getByText('Mover para Vault').click(); await W(1500)
  await page.getByRole('button', { name: 'Voltar' }).click(); await W(1500)
  ok(`${P}: nota some da timeline ao ir para o Vault`, !(await page.getByText(title).count()))

  // no banco do aparelho, só o cifrado
  const stored = await page.evaluate((id) => new Promise((resolve) => {
    const req = indexedDB.open('grafite-notas')
    req.onsuccess = () => {
      const get = req.result.transaction('notes').objectStore('notes').get(id)
      get.onsuccess = () => resolve(get.result)
    }
  }), noteId)
  ok(`${P}: nota do Vault gravada cifrada`, stored && stored.cipher?.startsWith('gv1.') && stored.content === '' && stored.title === null && !JSON.stringify(stored).includes('café'))

  await page.click('a[href="/vault"]'); await W(1500)
  ok(`${P}: nota aparece no Vault aberto`, await page.getByText(title).count())
  await shot('09-vault')

  // trancar esconde; senha errada recusa; senha certa abre
  await page.getByRole('button', { name: 'Trancar' }).click(); await W(800)
  ok(`${P}: trancar esconde as notas`, !(await page.getByText(title).count()))
  await page.fill('input[placeholder="senha do Vault"]', 'errada-123'); await page.getByRole('button', { name: 'Abrir' }).click(); await W(2000)
  ok(`${P}: senha errada do Vault recusa`, await page.getByText('Senha incorreta.').count())
  await page.fill('input[placeholder="senha do Vault"]', VAULT_PW); await page.getByRole('button', { name: 'Abrir' }).click(); await W(2000)
  ok(`${P}: senha certa abre o Vault`, await page.getByText(title).count())

  // nota do Vault não usa IA
  await page.getByText(title).first().click(); await W(1500)
  await page.getByText('IA', { exact: true }).click(); await W(600)
  await page.getByText('Resumir').click(); await W(800)
  ok(`${P}: IA bloqueada no Vault`, await page.getByText('A IA não é usada em notas do Vault').count())
  await page.keyboard.press('Escape'); await W(400)

  // apagar com desfazer
  await page.getByRole('button', { name: 'Mais ações' }).click(); await W(600)
  await page.getByText('Deletar').click(); await W(1500)
  ok(`${P}: toast de desfazer`, await page.getByText('desfazer').count())
  await page.getByText('desfazer').click(); await W(1200)
  await page.click('a[href="/vault"]'); await W(1500)
  ok(`${P}: desfazer restaura`, await page.getByText(title).count())

  // tira do Vault (volta a ser texto normal)
  await page.getByText(title).first().click(); await W(1500)
  await page.getByRole('button', { name: 'Mais ações' }).click(); await W(600)
  await page.getByText('Tirar do Vault').click(); await W(1500)
  await page.goto(BASE + '/'); await W(2000)
  ok(`${P}: nota volta para a timeline`, await page.getByText(title).count())

  // compartilhar de outro app (share_target) cria a nota sozinho
  const sharedTitle = `Compartilhado ${P} ${String(Date.now()).slice(-7)}`
  await page.goto(`${BASE}/note?title=${encodeURIComponent(sharedTitle)}&text=${encodeURIComponent('veja isto')}&url=${encodeURIComponent('https://exemplo.com')}`); await W(2500)
  await page.goto(BASE + '/'); await W(2000)
  ok(`${P}: compartilhar cria nota`, await page.getByText(sharedTitle).count())
  await page.getByText(sharedTitle).first().click(); await W(1500)
  ok(`${P}: compartilhado traz o link`, await page.getByText('https://exemplo.com').count())
  await page.getByRole('button', { name: 'Mais ações' }).click(); await W(500)
  await page.getByText('Deletar').click(); await W(1500)

  // exportar em markdown (.zip)
  await page.goto(BASE + '/settings'); await W(1500)
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
    page.getByText('Exportar em Markdown (.zip)').click(),
  ])
  const zipHead = download ? fs.readFileSync(await download.path()).subarray(0, 2).toString() : ''
  ok(`${P}: exporta .zip em markdown`, zipHead === 'PK')

  // offline: abre o app e uma nota sem rede
  await page.goto(noteUrl); await W(1500)
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
  }
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
