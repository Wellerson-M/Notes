/**
 * Teste das novidades de 14/10: nota nova que reabre a mesma, cursor visível em nota longa,
 * ligações fora do texto, copiar sem links, apagar só o conteúdo, ditado pela IA (com uma fala
 * pt-BR de verdade no microfone simulado do Chrome), ouvir a nota, grafo e galáxia no PC.
 * Usa a IA de verdade. SÓ com o servidor no banco de testes (ver docs/TESTES.md):
 *
 *   MONGODB_DB=grafite-notas-e2e npx next start -p 3123
 *   E2E_PASSWORD=<sua APP_PASSWORD> npm run e2e:novidades
 *
 * A fala é gerada pela voz "Maria" do Windows (System.Speech) em .e2e/fala.wav.
 */
const path = require('path')
const fs = require('fs')
const { execFileSync } = require('child_process')
const { chromium } = require('playwright-core')
const BASE = process.env.E2E_BASE ?? 'http://localhost:3123'
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PASSWORD = process.env.E2E_PASSWORD ?? PASSWORD
const OUT = path.resolve(__dirname, '..', '.e2e')
const WAV = path.join(OUT, 'fala.wav')

function makeSpeech() {
  if (fs.existsSync(WAV)) return
  fs.mkdirSync(OUT, { recursive: true })
  const ps = [
    'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    "$v = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -eq 'pt-BR' } | Select-Object -First 1",
    'if ($v) { $s.SelectVoice($v.VoiceInfo.Name) }',
    '$f = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(48000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)',
    `$s.SetOutputToWaveFile('${WAV.replace(/'/g, "''")}', $f)`,
    "$s.Speak('Preciso comprar pão, leite e café amanhã cedo.')",
    "$s.Speak('Depois, ligar para o Wellerson sobre o projeto Grafite Notas.')",
    '$s.Dispose()',
  ].join('; ')
  execFileSync('powershell', ['-NoProfile', '-Command', ps])
}
let failures = 0
const ok = (n, c, extra = '') => { if (!c) failures++; console.log(`${c ? '✔' : '✘'} ${n} ${extra}`) }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  if (!PASSWORD) throw new Error('Defina E2E_PASSWORD')
  makeSpeech()
  const b = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${WAV}%noloop`, '--autoplay-policy=no-user-gesture-required'],
  })
  const ctx = await b.newContext({
    viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2,
    permissions: ['clipboard-read', 'clipboard-write', 'microphone'],
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36',
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|404/.test(m.text())) errors.push('console: ' + m.text()) })

  // Login no banco de testes
  await page.goto(BASE + '/settings')
  const login = await page.request.post(BASE + '/api/auth', { data: { password: PASSWORD } })
  ok('login', login.ok())

  // ── Nome ──
  await page.goto(BASE + '/'); await wait(2500)
  ok('título da aba = Grafite Notas', (await page.title()) === 'Grafite Notas', await page.title())
  const manifest = await (await page.request.get(BASE + '/manifest.json')).json()
  ok('manifest com o nome novo', manifest.name === 'Grafite Notas' && manifest.short_name === 'Grafite Notas')
  ok('cabeçalho "grafite notas"', await page.getByText('grafite', { exact: false }).first().isVisible())

  // ── 1. Nota nova vira ?id= e reabre a mesma depois de recarregar ──
  await page.goto(BASE + '/note?mode=text'); await wait(1500)
  await page.locator('input[placeholder="sem título"]').fill('Ideias de melhorias')
  await wait(1800)
  const url1 = page.url()
  ok('URL trocou para ?id= depois de gravar', /\/note\?id=/.test(url1), url1)
  ok('editor não remontou (título continua focado)', await page.evaluate(() => document.activeElement?.getAttribute('placeholder') === 'sem título'))
  await page.reload(); await wait(2500)
  ok('recarregar abre a MESMA nota (não uma em branco)', (await page.locator('input[placeholder="sem título"]').inputValue()) === 'Ideias de melhorias')

  // ── 4. Nota longa: o ponto onde se digita não some da tela ──
  await page.getByText('Escreva aqui...').click(); await wait(400)
  const lines = []
  for (let i = 1; i <= 45; i++) lines.push(`Linha ${i} com um texto comprido o bastante para quebrar em duas linhas no celular, orçamento da viagem para a praia`)
  let worst = 0
  for (let i = 0; i < lines.length; i++) {
    await page.keyboard.type(lines[i].slice(0, 20))
    await page.keyboard.insertText(lines[i].slice(20))
    if (i < lines.length - 1) await page.keyboard.press('Enter')
    if (i % 5 === 4) {
      await wait(120)
      // Fim do textarea (onde está o cursor) precisa estar visível
      const off = await page.evaluate(() => {
        const ta = document.querySelector('textarea')
        const r = ta.getBoundingClientRect()
        const vh = window.visualViewport?.height ?? innerHeight
        return r.bottom > vh - 40 ? r.bottom - (vh - 40) : r.bottom < 60 ? 60 - r.bottom : 0
      })
      worst = Math.max(worst, off)
    }
  }
  ok('cursor sempre visível ao escrever nota longa', worst < 40, `pior desvio: ${Math.round(worst)}px`)
  await page.screenshot({ path: path.join(OUT, 'nota-longa.png') })
  await page.getByRole('button', { name: 'Concluir edição' }).click(); await wait(1200)

  // ── 7. Ligações fora do texto + copiar sem links ──
  await page.goto(BASE + '/note?mode=text'); await wait(1200)
  await page.locator('input[placeholder="sem título"]').fill('Orçamento da viagem')
  await page.getByText('Escreva aqui...').click()
  await page.keyboard.insertText('Orçamento da viagem para a praia: hotel, passagem e comida na praia.')
  await page.getByRole('button', { name: 'Concluir edição' }).click(); await wait(1500)
  const otherUrl = page.url()
  await page.goto(url1); await wait(2500)
  const ligar = page.getByRole('button', { name: /Ligar a Orçamento da viagem/ })
  ok('conexão sugerida aparece', await ligar.count() > 0)
  if (await ligar.count()) { await ligar.first().click(); await wait(1500) }
  ok('"Ligada a" mostra a nota', await page.getByText('Ligada a').count() > 0)
  const content1 = await page.evaluate(async () => {
    const db = await new Promise((res) => { const r = indexedDB.open('grafite-notas'); r.onsuccess = () => res(r.result) })
    const tx = db.transaction('notes').objectStore('notes').getAll()
    return new Promise((res) => { tx.onsuccess = () => res(tx.result.find((n) => n.title === 'Ideias de melhorias')) })
  })
  ok('ligação gravada fora do texto (links), sem [[ ]] no conteúdo', content1?.links?.length === 1 && !content1.content.includes('[['), JSON.stringify(content1?.links))

  // Também uma linha "Relacionadas:" escrita à mão (o jeito antigo)
  await page.locator('[data-line]').last().click(); await wait(400)
  await page.keyboard.press('Control+End')
  await page.keyboard.insertText('\n\nRelacionadas: [[Orçamento da viagem]]')
  await page.getByRole('button', { name: 'Concluir edição' }).click(); await wait(900)
  await page.getByRole('button', { name: 'Copiar tudo' }).click(); await wait(500)
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  ok('copiar tudo: título + texto', clip.startsWith('# Ideias de melhorias') && clip.includes('Linha 45'))
  ok('copiar tudo: sem "Relacionadas:" e sem [[ ]]', !/Relacionadas/i.test(clip) && !clip.includes('[['), clip.slice(-80).replace(/\n/g, '⏎'))
  const tirar = page.getByRole('button', { name: /tirar .* do texto/ })
  ok('oferece tirar a linha "Relacionadas:" do texto', await tirar.count() > 0)
  if (await tirar.count()) { await tirar.click(); await wait(900) }
  ok('linha "Relacionadas:" saiu do texto', !(await page.locator('[data-line]').allInnerTexts()).some((t) => /Relacionadas/.test(t)))

  // ── 8. Apagar só o conteúdo ──
  await page.getByRole('button', { name: 'Mais ações' }).click(); await wait(500)
  await page.getByText('Apagar só o conteúdo').click(); await wait(1200)
  ok('conteúdo apagado', await page.locator('[data-line]').count() === 0)
  ok('título continua', (await page.locator('input[placeholder="sem título"]').inputValue()) === 'Ideias de melhorias')
  ok('ligações continuam', await page.getByText('Ligada a').count() > 0)
  await page.getByText('desfazer').click(); await wait(900)
  ok('desfazer devolve o texto', await page.locator('[data-line]').count() > 40)

  // ── 2/5. Ditado pela IA, com o áudio pt-BR no "microfone" ──
  await page.getByRole('button', { name: 'Mais ações' }).click(); await wait(400)
  await page.getByText('Apagar só o conteúdo').click(); await wait(900)
  await page.getByText('ditar').click()
  await wait(500)
  ok('barra do ditado em modo IA', await page.getByText('· IA').count() > 0)
  await wait(14000) // a fala tem ~11s
  const live = await page.locator('.app-bar .font-serif').first().innerText()
  console.log('   ditado (antes de inserir):', live.replace(/\n/g, ' '))
  await page.getByText('Inserir na nota').click()
  for (let i = 0; i < 40 && await page.getByText('Inserir na nota').count(); i++) await wait(500)
  await wait(1200)
  const dictated = (await page.locator('[data-line]').allInnerTexts()).join(' ')
  console.log('   ditado na nota:', dictated)
  ok('ditado entrou na nota', /p[ãa]o/i.test(dictated) && /caf[ée]/i.test(dictated))
  ok('as duas frases (a pausa entre elas não cortou)', /ligar/i.test(dictated) && /Wellerson|projeto/i.test(dictated))

  // ── 6. Ouvir a nota ──
  await page.getByRole('button', { name: 'Mais ações' }).click(); await wait(400)
  await page.getByText('Ouvir nota').click()
  await wait(500)
  ok('barra do "Ouvir" aparece', await page.getByRole('region', { name: 'Leitura em voz alta' }).count() > 0)
  let listenState = ''
  for (let i = 0; i < 30; i++) {
    listenState = await page.getByRole('region', { name: 'Leitura em voz alta' }).innerText().catch(() => '')
    if (/de \d|aparelho/.test(listenState)) break
    await wait(500)
  }
  console.log('   ouvir:', listenState.replace(/\n/g, ' · '))
  ok('voz começou a tocar', /voz natural · \d de \d|voz do aparelho/.test(listenState))
  await page.screenshot({ path: path.join(OUT, 'ouvir.png') })
  await page.getByRole('button', { name: 'Parar leitura' }).first().click()

  // ── 9. Grafo ──
  await page.goto(BASE + '/'); await wait(2000)
  await page.getByRole('button', { name: 'Grafo de conexões' }).click(); await wait(2500)
  ok('grafo abre', await page.getByRole('dialog', { name: 'Grafo de conexões' }).count() > 0)
  await page.screenshot({ path: path.join(OUT, 'grafo-celular.png') })
  // Parado = sem quadros: conta requestAnimationFrame por 1,5s depois de assentar
  await wait(4000)
  const frames = await page.evaluate(() => new Promise((res) => {
    let n = 0
    const orig = window.requestAnimationFrame
    window.requestAnimationFrame = (cb) => { n++; return orig(cb) }
    setTimeout(() => { window.requestAnimationFrame = orig; res(n) }, 1500)
  }))
  ok('grafo parado não gasta CPU (sem quadros)', frames <= 2, `${frames} quadros em 1,5s`)
  await page.getByRole('button', { name: 'Fechar' }).click()

  // ── 10. Galáxia no PC ──
  const pc = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const p2 = await pc.newPage()
  p2.on('pageerror', (e) => errors.push('pc: ' + e.message))
  await p2.request.post(BASE + '/api/auth', { data: { password: PASSWORD } })
  await p2.goto(BASE + '/'); await wait(3500)
  ok('fundo de galáxia no PC', await p2.locator('.galaxy-backdrop canvas').count() === 2 && await p2.evaluate(() => document.documentElement.classList.contains('galaxy-on')))
  await p2.screenshot({ path: path.join(OUT, 'galaxia-pc.png') })
  await p2.goto(BASE + otherUrl.replace(BASE, '')); await wait(2500)
  await p2.getByRole('button', { name: 'Ver conexões' }).click(); await wait(3000)
  await p2.screenshot({ path: path.join(OUT, 'grafo-pc.png') })
  await p2.evaluate(() => { document.documentElement.dataset.theme = 'meia-noite' })
  await p2.keyboard.press('Escape'); await wait(1200)
  await p2.screenshot({ path: path.join(OUT, 'galaxia-meia-noite.png') })

  ok('sem erros de JS', !errors.length, errors.join(' | '))
  await b.close()
  console.log(failures ? `\n${failures} falha(s)` : '\ntudo certo')
  if (failures) process.exitCode = 1
})().catch((e) => { console.error('ERRO FATAL', e); process.exit(1) })
