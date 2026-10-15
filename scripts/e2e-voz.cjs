/**
 * Teste do ditado no assistente com um reconhecimento de voz simulado que se comporta como o
 * Chrome do Android: repete a frase inteira a cada resultado e reinicia entre frases.
 * Confere que o texto chega sem repetição e é enviado sozinho quando a fala termina.
 * A IA é simulada (nada vai para o Gemini nem para o Atlas).
 *
 *   npm run build && npx next start -p 3123          (num terminal)
 *   npm run e2e:voz
 */
const { chromium } = require('playwright-core')
const BASE = process.env.E2E_BASE ?? 'http://localhost:3123'
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
let failures = 0
const ok = (n, c, extra = '') => { if (!c) failures++; console.log(`${c ? '✔' : '✘'} ${n} ${extra}`) }

/** Roda dentro da página: substitui o SpeechRecognition por um roteiro de eventos */
function fakeAndroidSpeech() {
  // Cada sessão = uma frase; cada passo = a lista completa de resultados naquele momento
  const sessions = [
    [[['anota', false]], [['anota', true]], [['anota', true], ['anota que amanhã', true]], [['anota', true], ['anota que amanhã preciso', true]]],
    [[['preciso ligar', false]], [['preciso ligar pro dentista', true]], [['preciso ligar pro dentista', true], ['ligar pro dentista às 9h', true]]],
  ]
  let session = 0
  class FakeRecognition {
    start() {
      const steps = sessions[session++]
      if (!steps) { setTimeout(() => this.onend?.(), 50); return }
      steps.forEach((results, i) => setTimeout(() => {
        const list = results.map(([transcript, isFinal]) => ({ isFinal, 0: { transcript } }))
        this.onresult?.({ resultIndex: 0, results: Object.assign(list, { length: list.length }) })
      }, 120 * (i + 1)))
      // O Android encerra a sessão logo depois da frase
      setTimeout(() => this.onend?.(), 120 * (steps.length + 1))
    }
    stop() { setTimeout(() => this.onend?.(), 10) }
    abort() {}
  }
  window.SpeechRecognition = FakeRecognition
  window.webkitSpeechRecognition = FakeRecognition
  // Este teste é do motor do navegador (o padrão agora é o ditado pela IA)
  try { localStorage.setItem('grafite-dictation-engine', 'browser') } catch { /* sem storage */ }
  // O envio automático virou opcional (Ajustes → IA) em 13/10; o teste é dele
  try { localStorage.setItem('grafite-voice-autosend', '1') } catch { /* sem storage */ }
}

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const ctx = await b.newContext({ viewport: { width: 400, height: 820 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36' })
  await ctx.addInitScript(fakeAndroidSpeech)
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/api/sync', (r) => r.fulfill({ status: 401, body: '{}' }))
  let sent = null
  await page.route('**/api/ai', async (r) => {
    sent = JSON.parse(r.request().postData() ?? '{}').message
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply: 'Anotado!', noteIds: [], actions: [] }) })
  })

  await page.goto(BASE + '/assistant'); await page.waitForTimeout(2500)
  await page.locator('button:has(svg.lucide-mic)').last().click()
  // Duas frases de ~0,6s + reinício + 1,2s de silêncio: deve enviar sozinho em poucos segundos
  for (let i = 0; i < 40 && !sent; i++) await page.waitForTimeout(250)

  ok('envia sozinho quando a fala termina', !!sent)
  ok('texto sem repetições', sent === 'anota que amanhã preciso ligar pro dentista às 9h', JSON.stringify(sent))
  await page.waitForTimeout(800)
  ok('resposta aparece', await page.getByText('Anotado!').count())
  ok('sem erros de JS', !errors.length, errors.join(' | '))
  await b.close()
  if (failures) process.exitCode = 1
})().catch((e) => { console.error('ERRO FATAL', e.message); process.exit(1) })
