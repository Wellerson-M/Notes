'use client'
import { useEffect, useRef, useState } from 'react'
import { useUIStore } from '@/store/ui'

/**
 * Fundo de galáxia nas laterais do PC (a coluna central do app fica por cima, opaca).
 * Duas camadas para não pesar:
 *  - estática: desenhada uma vez por tamanho/tema — céu, nebulosas nas cores do tema, faixa de
 *    estrelas e uma galáxia espiral. Um leve deslocamento com o mouse (parallax) é só CSS;
 *  - viva: poucas estrelas cintilando e, de vez em quando, uma estrela cadente (30 qps, para
 *    quando a aba some; desligada com "Reduzir movimento").
 * Só existe a partir de 760px de largura (no celular não há laterais).
 */

const MIN_WIDTH = 760
const COLUMN = 680
const KEY = 'grafite-galaxy'

export const getGalaxyOn = () => { try { return localStorage.getItem(KEY) !== '0' } catch { return true } }
export function setGalaxyOn(on: boolean) {
  try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* modo privado */ }
  window.dispatchEvent(new Event('grafite:galaxy'))
}

/** Aleatório com semente: o céu é o mesmo a cada abertura e redimensionamento */
function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Palette = { accent: string; gold: string; bg: string; light: boolean }

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return {
    accent: v('--accent-rgb', '232, 165, 71'),
    gold: v('--gold-rgb', '212, 175, 55'),
    bg: v('--bg-rgb', '17, 18, 16'),
    light: css.getPropertyValue('color-scheme').trim() === 'light',
  }
}

/** Laterais livres (fora da coluna central): [x0, x1] de cada uma */
function sides(W: number) {
  const side = Math.max(0, (W - COLUMN) / 2)
  return { side, left: [0, side] as const, right: [W - side, W] as const }
}

function drawStatic(ctx: CanvasRenderingContext2D, W: number, H: number, p: Palette) {
  const rnd = seeded(20261014)
  const { side, right } = sides(W)
  const star = '255, 255, 255'
  ctx.clearRect(0, 0, W, H)

  // Céu: um fundo levemente mais profundo nas bordas
  const sky = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.75)
  sky.addColorStop(0, `rgba(${p.bg}, 0)`)
  sky.addColorStop(1, p.light ? `rgba(${p.accent}, 0.06)` : 'rgba(0, 0, 0, 0.45)')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H)

  ctx.globalCompositeOperation = p.light ? 'multiply' : 'lighter'

  // Nebulosas: nuvens grandes e suaves nas cores do tema, mais densas nas laterais
  const clouds = [
    { x: side * 0.45, y: H * 0.28, r: side * 1.1, c: p.accent, a: 0.16 },
    { x: side * 0.2, y: H * 0.72, r: side * 0.95, c: p.gold, a: 0.11 },
    { x: side * 0.75, y: H * 0.55, r: side * 0.6, c: p.accent, a: 0.08 },
    { x: right[0] + side * 0.6, y: H * 0.82, r: side * 0.9, c: p.accent, a: 0.1 },
    { x: right[0] + side * 0.3, y: H * 0.12, r: side * 0.7, c: p.gold, a: 0.08 },
  ]
  for (const c of clouds) {
    for (let k = 0; k < 7; k++) {
      const x = c.x + (rnd() - 0.5) * c.r * 0.9
      const y = c.y + (rnd() - 0.5) * c.r * 0.9
      const r = c.r * (0.35 + rnd() * 0.5)
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, `rgba(${c.c}, ${c.a * (p.light ? 0.9 : 1)})`)
      g.addColorStop(0.5, `rgba(${c.c}, ${c.a * 0.35})`)
      g.addColorStop(1, `rgba(${c.c}, 0)`)
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
  }

  if (!p.light) {
    // Faixa da Via Láctea: diagonal, estrelas bem miúdas e densas
    const band = (t: number) => ({ x: t * W, y: H * 0.85 - t * H * 0.7 })
    for (let i = 0; i < 1400; i++) {
      const t = rnd()
      const b = band(t)
      const spread = (rnd() + rnd() + rnd() - 1.5) * H * 0.12
      const x = b.x + spread * 0.6
      const y = b.y + spread
      ctx.fillStyle = `rgba(${star}, ${0.08 + rnd() * 0.25})`
      ctx.fillRect(x, y, rnd() < 0.9 ? 1 : 1.6, rnd() < 0.9 ? 1 : 1.6)
    }

    // Galáxia espiral na lateral direita
    const gx = right[0] + side * 0.5
    const gy = H * 0.4
    const gr = Math.min(side * 0.42, 240)
    if (gr > 40) {
      const core = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr * 0.5)
      core.addColorStop(0, 'rgba(255, 250, 235, 0.55)')
      core.addColorStop(0.15, `rgba(${p.gold}, 0.35)`)
      core.addColorStop(1, `rgba(${p.accent}, 0)`)
      ctx.fillStyle = core
      ctx.beginPath()
      ctx.ellipse(gx, gy, gr * 0.5, gr * 0.32, -0.5, 0, Math.PI * 2)
      ctx.fill()
      for (let arm = 0; arm < 2; arm++) {
        for (let i = 0; i < 900; i++) {
          const t = rnd() ** 0.7
          const ang = arm * Math.PI + t * Math.PI * 2.6
          const rad = t * gr
          const jitter = (rnd() - 0.5) * gr * 0.16 * (0.4 + t)
          // Espiral achatada e inclinada (vista em perspectiva)
          const ex = Math.cos(ang) * rad + jitter
          const ey = (Math.sin(ang) * rad + jitter) * 0.55
          const x = gx + ex * Math.cos(-0.5) - ey * Math.sin(-0.5)
          const y = gy + ex * Math.sin(-0.5) + ey * Math.cos(-0.5)
          const warm = rnd() < 0.35
          ctx.fillStyle = warm ? `rgba(${p.accent}, ${0.15 + rnd() * 0.4})` : `rgba(${star}, ${0.1 + rnd() * 0.35 * (1 - t * 0.5)})`
          const s = rnd() < 0.93 ? 1 : 1.8
          ctx.fillRect(x, y, s, s)
        }
      }
    }
  }

  ctx.globalCompositeOperation = 'source-over'

  // Estrelas paradas, espalhadas (algumas com brilho em cruz)
  const count = Math.round((W * H) / (p.light ? 9000 : 2600))
  for (let i = 0; i < count; i++) {
    const x = rnd() * W
    const y = rnd() * H
    const big = rnd()
    const a = p.light ? 0.08 + rnd() * 0.12 : 0.15 + rnd() * 0.6
    const tint = rnd()
    const color = p.light ? p.bg : tint < 0.15 ? p.accent : tint < 0.25 ? '200, 215, 255' : star
    ctx.fillStyle = `rgba(${p.light ? '0, 0, 0' : color}, ${a})`
    const s = big > 0.985 ? 2.2 : big > 0.9 ? 1.5 : 1
    ctx.fillRect(x, y, s, s)
    if (!p.light && big > 0.996) {
      // Brilho em cruz das estrelas mais fortes
      ctx.fillStyle = `rgba(${color}, ${a * 0.35})`
      ctx.fillRect(x - 4, y + s / 2 - 0.5, 8 + s, 1)
      ctx.fillRect(x + s / 2 - 0.5, y - 4, 1, 8 + s)
    }
  }
}

type Twinkle = { x: number; y: number; r: number; phase: number; speed: number; color: string }
type Meteor = { x: number; y: number; vx: number; vy: number; life: number }

export default function GalaxyBackdrop() {
  const staticRef = useRef<HTMLCanvasElement>(null)
  const liveRef = useRef<HTMLCanvasElement>(null)
  const reducedMotion = useUIStore((s) => s.reducedMotion)
  const [on, setOn] = useState(false)
  const [wide, setWide] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${MIN_WIDTH}px)`)
    const sync = () => { setWide(mq.matches); setOn(getGalaxyOn()) }
    sync()
    mq.addEventListener('change', sync)
    window.addEventListener('grafite:galaxy', sync)
    return () => { mq.removeEventListener('change', sync); window.removeEventListener('grafite:galaxy', sync) }
  }, [])

  const active = on && wide

  // Com a galáxia, o fundo da página fica transparente e só a coluna central é opaca (globals.css)
  useEffect(() => {
    document.documentElement.classList.toggle('galaxy-on', active)
    return () => document.documentElement.classList.remove('galaxy-on')
  }, [active])

  useEffect(() => {
    if (!active) return
    const sc = staticRef.current
    const lc = liveRef.current
    const sctx = sc?.getContext('2d')
    const lctx = lc?.getContext('2d')
    if (!sc || !lc || !sctx || !lctx) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const still = reducedMotion || prefersReduced

    let W = 0
    let H = 0
    let palette = readPalette()
    let twinkles: Twinkle[] = []
    const meteors: Meteor[] = []

    const layout = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = window.innerWidth
      H = window.innerHeight
      for (const c of [sc, lc]) {
        c.width = Math.round(W * dpr)
        c.height = Math.round(H * dpr)
        c.style.width = `${W}px`
        c.style.height = `${H}px`
      }
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      palette = readPalette()
      drawStatic(sctx, W, H, palette)
      // Estrelas que cintilam: só nas laterais (atrás da coluna ninguém vê)
      const rnd = seeded(7)
      const { side } = sides(W)
      twinkles = palette.light ? [] : Array.from({ length: Math.min(140, Math.round(side * H / 9000)) }, () => {
        const left = rnd() < 0.5
        const x = left ? rnd() * side : W - rnd() * side
        const t = rnd()
        return { x, y: rnd() * H, r: 0.6 + rnd() * 1.3, phase: rnd() * Math.PI * 2, speed: 0.6 + rnd() * 1.8, color: t < 0.2 ? palette.accent : t < 0.3 ? '200, 215, 255' : '255, 255, 255' }
      })
    }
    layout()

    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(layout, 150)
    }
    window.addEventListener('resize', onResize)
    // Troca de tema: o <html> ganha outro data-theme
    const themeObs = new MutationObserver(() => layout())
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    // Parallax: a camada parada desliza poucos pixels com o mouse (só transform, na GPU)
    const onMove = (e: PointerEvent) => {
      if (still) return
      const dx = (e.clientX / W - 0.5) * -10
      const dy = (e.clientY / H - 0.5) * -8
      sc.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.02)`
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    let raf = 0
    let last = 0
    let nextMeteor = performance.now() + 6000
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (now - last < 33) return // ~30 qps bastam para cintilar
      last = now
      lctx.clearRect(0, 0, W, H)
      const time = now / 1000
      for (const s of twinkles) {
        const a = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(time * s.speed + s.phase)) ** 3
        lctx.fillStyle = `rgba(${s.color}, ${a})`
        lctx.beginPath()
        lctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        lctx.fill()
      }
      if (!palette.light && now > nextMeteor) {
        const { side } = sides(W)
        const left = Math.random() < 0.5
        meteors.push({ x: left ? Math.random() * side * 0.6 : W - side + Math.random() * side * 0.4, y: Math.random() * H * 0.4, vx: left ? 9 : -9, vy: 4.5, life: 1 })
        nextMeteor = now + 9000 + Math.random() * 14000
      }
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i]
        m.x += m.vx
        m.y += m.vy
        m.life -= 0.025
        if (m.life <= 0) { meteors.splice(i, 1); continue }
        const g = lctx.createLinearGradient(m.x, m.y, m.x - m.vx * 9, m.y - m.vy * 9)
        g.addColorStop(0, `rgba(255, 255, 255, ${0.8 * m.life})`)
        g.addColorStop(1, `rgba(${palette.accent}, 0)`)
        lctx.strokeStyle = g
        lctx.lineWidth = 1.4
        lctx.beginPath()
        lctx.moveTo(m.x, m.y)
        lctx.lineTo(m.x - m.vx * 9, m.y - m.vy * 9)
        lctx.stroke()
      }
    }

    const start = () => { if (!raf && !still && !document.hidden) raf = requestAnimationFrame(frame) }
    const halt = () => { cancelAnimationFrame(raf); raf = 0 }
    const onVisibility = () => (document.hidden ? halt() : start())
    document.addEventListener('visibilitychange', onVisibility)
    if (still) {
      // Parado: as estrelas que cintilariam ficam desenhadas uma vez
      lctx.clearRect(0, 0, W, H)
      for (const s of twinkles) {
        lctx.fillStyle = `rgba(${s.color}, 0.6)`
        lctx.fillRect(s.x, s.y, s.r, s.r)
      }
    } else start()

    return () => {
      halt()
      if (resizeTimer) clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('visibilitychange', onVisibility)
      themeObs.disconnect()
    }
  }, [active, reducedMotion])

  if (!active) return null
  return (
    <div aria-hidden className="galaxy-backdrop">
      <canvas ref={staticRef} style={{ position: 'absolute', inset: 0, transition: 'transform 400ms ease-out' }} />
      <canvas ref={liveRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  )
}
