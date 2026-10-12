/**
 * Teste dos lembretes: liga as notificações num Chrome de verdade (inscrição real no push do
 * Google), agenda notas pelo sync, chama o relógio e confere quais avisos o servidor mandou e
 * se o Google aceitou. O Chrome automatizado não recebe push pela rede, então a exibição é
 * testada entregando a mensagem direto ao service worker (DevTools). Grava notas: SÓ com o
 * servidor no banco de testes.
 *
 *   npm run e2e:db
 *   MONGODB_DB=grafite-notas-e2e npx next start -p 3123      (num terminal)
 *   E2E_PASSWORD=<sua APP_PASSWORD> npm run e2e:lembretes
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { chromium } = require('playwright-core')
const PW = process.env.E2E_PASSWORD
if (!PW) { console.error('Defina E2E_PASSWORD com a senha do app (APP_PASSWORD).'); process.exit(1) }
const BASE = process.env.E2E_BASE ?? 'http://localhost:3123'
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
let failures = 0
const ok = (n, c, extra = '') => { if (!c) failures++; console.log(`${c ? '✔' : '✘'} ${n} ${extra}`) }
const pad = (n) => String(n).padStart(2, '0')
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

;(async () => {
  // Perfil temporário de verdade: no modo anônimo o Chrome recusa o push
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'grafite-push-'))
  const ctx = await chromium.launchPersistentContext(profile, {
    executablePath: CHROME, viewport: { width: 400, height: 820 },
    ignoreDefaultArgs: ['--disable-background-networking'], // sem isso o Chrome não fala com o push do Google
  })
  await ctx.grantPermissions(['notifications'], { origin: BASE })
  const page = ctx.pages()[0] ?? await ctx.newPage()
  const W = (ms) => page.waitForTimeout(ms)
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const api = (p, init = {}) => page.evaluate(async ([u, i]) => {
    const r = await fetch(u, { ...i, headers: { 'Content-Type': 'application/json' } })
    return { status: r.status, body: await r.json().catch(() => null) }
  }, [p, init])
  const notifications = () => page.evaluate(async () =>
    (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({ title: n.title, body: n.body, tag: n.tag, actions: n.actions?.length ?? 0 })))

  // Entrega de push simulada (DevTools), para testar o que o service worker mostra
  const cdp = await ctx.newCDPSession(page)
  let registrationId = null
  cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => {
    const r = registrations.find((x) => x.scopeURL.startsWith(BASE) && !x.isDeleted)
    if (r) registrationId = r.registrationId
  })
  await cdp.send('ServiceWorker.enable')
  const deliver = (data) => cdp.send('ServiceWorker.deliverPushMessage', { origin: BASE, registrationId, data: JSON.stringify(data) })

  await page.goto(BASE + '/'); await W(1500)
  ok('login', (await api('/api/auth', { method: 'POST', body: JSON.stringify({ password: PW }) })).status === 200)
  await page.evaluate(() => navigator.serviceWorker.ready)
  ok('padrões de fábrica', (await api('/api/push', { method: 'PUT', body: JSON.stringify({ timed: [15], allDay: [0], allDayTime: '09:00' }) })).status === 200)
  ok('recusa aviso fora da lista', (await api('/api/push', { method: 'PUT', body: JSON.stringify({ timed: [7] }) })).status === 400)

  // 1. Agenda pelo sync (antes de ligar: sem aparelho, nada sai). Daqui a ~10 min com o aviso
  //    padrão de 15 min já está na hora; uma "sem aviso"; uma do Vault; uma para mais tarde.
  const soon = new Date(Date.now() + 10 * 60000)
  const later = new Date(Date.now() + 2 * 3600000)
  const sched = { date: dateKey(soon), time: hhmm(soon) }
  const now = new Date().toISOString()
  const base = { createdAt: now, updatedAt: now, tags: [], pinned: false, inVault: false, attachments: {} }
  await api('/api/sync', { method: 'POST', body: JSON.stringify({ since: Date.now(), notes: [
    { ...base, id: 'lembrete-padrao', title: 'Dentista', content: 'Levar o cartão do convênio', schedule: sched },
    { ...base, id: 'lembrete-mudo', title: 'Sem aviso', content: 'x', schedule: { ...sched, remind: [] } },
    { ...base, id: 'lembrete-vault', title: null, content: '', inVault: true, cipher: 'gv1.xxx', schedule: sched },
    { ...base, id: 'lembrete-escolhido', title: 'Remédio', content: 'x', schedule: { date: dateKey(later), time: hhmm(later), remind: [60, 120] } },
    { ...base, id: 'lembrete-depois', title: 'Mais tarde', content: 'x', schedule: { date: dateKey(later), time: hhmm(later) } },
  ] }) })
  await W(1500)

  // 2. Ajustes → ligar neste aparelho
  await page.goto(BASE + '/settings'); await W(2500)
  ok('mostra o relógio ainda não ligado', await page.getByText('Falta ligar o relógio dos lembretes').count() > 0)
  // O push do Google às vezes recusa (410) a inscrição de um Chrome automatizado: o servidor a
  // esquece e o teste liga de novo, como a pessoa faria (até 3 vezes)
  let status = null
  let test = null
  let attempt = 0
  while (attempt++ < 3) {
    await page.getByText('Ligar notificações neste aparelho').click()
    await page.getByText('Desligar neste aparelho').waitFor({ timeout: 20000 }).catch(() => {})
    status = (await api('/api/push')).body
    test = await api('/api/push/test', { method: 'POST', body: JSON.stringify({}) })
    if (test.body?.delivered === 1) break
    await page.reload(); await W(2500)
  }
  ok('liga as notificações (inscrição no push)', status.devices === 1 && /^[A-Za-z0-9_-]{87}$/.test(status.publicKey), `tentativa ${Math.min(attempt, 3)}`)
  ok('o Google aceita a notificação de teste', test.body?.delivered === 1, JSON.stringify(test.body))

  // 4. relógio
  const cronPath = status.cronUrl.replace(/^https?:\/\/[^/]+/, '')
  ok('o relógio recusa chave errada', (await api(cronPath.replace(/k=.*/, 'k=errada'))).status === 401)
  const tick1 = await api(cronPath)
  const sentIds = tick1.body?.notes ?? []
  ok('o relógio responde', tick1.status === 200, JSON.stringify(tick1.body))
  ok('aviso padrão (15 min antes) sai', sentIds.includes('lembrete-padrao'))
  ok('nota do Vault também avisa', sentIds.includes('lembrete-vault'))
  ok('nota "sem aviso" não avisa', !sentIds.includes('lembrete-mudo'))
  ok('aviso escolhido de 2 h antes sai; o de 1 h ainda não', sentIds.filter((x) => x === 'lembrete-escolhido').length === 1)
  ok('nota de mais tarde ainda não avisa', !sentIds.includes('lembrete-depois'))
  const tick2 = await api(cronPath)
  ok('chamar o relógio de novo não repete', tick2.body?.sent === 0, JSON.stringify(tick2.body))

  // 5. o service worker mostra a notificação com "Adiar" (o Chrome sem janela não guarda
  //    notificações, então o teste anota o que o service worker pediu para mostrar)
  for (let i = 0; i < 20 && !registrationId; i++) await W(250)
  const sw = ctx.serviceWorkers().find((w) => w.url().startsWith(BASE)) ?? await ctx.waitForEvent('serviceworker')
  await sw.evaluate(() => {
    self.__shown = []
    const show = self.registration.showNotification.bind(self.registration)
    self.registration.showNotification = (title, opts) => { self.__shown.push({ title, ...opts }); return show(title, opts).catch(() => {}) }
  })
  await deliver({ title: 'Dentista', body: 'daqui a 15 min · 14:30\nLevar o cartão', url: '/note?id=lembrete-padrao', tag: 'lembrete-padrao' })
  await W(1500)
  const shown = (await sw.evaluate(() => self.__shown)).find((n) => n.tag === 'lembrete-padrao')
  ok('o aparelho mostra o aviso', shown?.title === 'Dentista' && /15 min/.test(shown.body) && shown.data?.url === '/note?id=lembrete-padrao', shown ? `${shown.title} — ${shown.body.replace(/\n/g, ' / ')}` : '')
  ok('aviso tem os botões "Adiar" e "Abrir"', shown?.actions?.map((a) => a.action).join() === 'snooze,open')
  ok('adiar é aceito', (await api('/api/push/snooze', { method: 'POST', body: JSON.stringify({ title: 'Dentista', body: 'x', url: '/note?id=lembrete-padrao', tag: 'lembrete-padrao', minutes: 10 }) })).status === 200)

  // 6. Ajustes mostram o relógio funcionando
  await page.goto(BASE + '/settings'); await W(2500)
  ok('Ajustes mostram o relógio funcionando', await page.getByText('Relógio dos lembretes funcionando').count() > 0)

  // 7. folha de agendar: mostra o padrão e permite tirar o aviso
  await page.goto(BASE + '/note?id=lembrete-padrao'); await W(2500)
  await page.locator('button', { hasText: /hoje às|amanhã às/ }).first().click(); await W(600)
  ok('folha mostra o aviso padrão', await page.getByText(/Avisar · 15 min antes \(padrão\)/).count() > 0)
  await page.getByText('sem aviso', { exact: true }).click(); await W(200)
  ok('“sem aviso” desliga', await page.getByText('Avisar · sem aviso').count() > 0)
  await page.getByText('Salvar data').click(); await W(800)
  const remind = await page.evaluate(() => new Promise((res) => {
    const r = indexedDB.open('grafite-notas')
    r.onsuccess = () => { const g = r.result.transaction('notes').objectStore('notes').get('lembrete-padrao'); g.onsuccess = () => res(g.result?.schedule?.remind) }
  }))
  ok('a nota guarda "sem aviso"', Array.isArray(remind) && remind.length === 0, JSON.stringify(remind))

  // 8. desligar
  await page.goto(BASE + '/settings'); await W(2500)
  await page.getByText('Desligar neste aparelho').click()
  await page.getByText('Ligar notificações neste aparelho').waitFor({ timeout: 10000 }).catch(() => {})
  ok('desliga neste aparelho', (await api('/api/push')).body.devices === 0)

  ok('nenhum erro de JavaScript', errors.length === 0, errors.join(' | '))
  await ctx.close()
  fs.rmSync(profile, { recursive: true, force: true })
  console.log(failures ? `\n${failures} falha(s)` : '\ntudo certo')
  process.exit(failures ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
