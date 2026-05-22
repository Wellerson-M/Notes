'use client'
import { useRef, useEffect } from 'react'
import { useUIStore } from '@/store/ui'

export type ParticleMode = 'splash' | 'audio' | 'touch'

interface Props {
  mode: ParticleMode
  className?: string
  style?: React.CSSProperties
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  alpha: number
  amber: boolean
  tx: number // target x (for touch mode)
  ty: number
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export default function ParticleField({ mode, className = '', style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number>(0)
  const touchRef = useRef({ x: 0, y: 0, active: false })
  const gyroRef = useRef({ gamma: 0, beta: 0 })
  const particleEffects = useUIStore(s => s.particleEffects)
  const reducedMotion = useUIStore(s => s.reducedMotion)
  const shouldRun = particleEffects && !reducedMotion

  useEffect(() => {
    if (!shouldRun) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Init particles
    const COUNT = mode === 'touch' ? 40 : 50
    const W = canvas.width
    const H = canvas.height

    particlesRef.current = Array.from({ length: COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.5 + 0.1,
      amber: Math.random() < 0.15,
      tx: W / 2,
      ty: H / 2,
    }))

    // Gyroscope
    let gyroHandler: ((e: DeviceOrientationEvent) => void) | null = null
    if (mode === 'splash' && 'DeviceOrientationEvent' in window) {
      gyroHandler = (e) => {
        gyroRef.current.gamma = e.gamma ?? 0
        gyroRef.current.beta = e.beta ?? 0
      }
      window.addEventListener('deviceorientation', gyroHandler)
    }

    // Touch tracking
    const handleTouch = (e: TouchEvent) => {
      const rect = canvas.getBoundingClientRect()
      touchRef.current = {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
        active: true,
      }
    }
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      touchRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      }
    }
    if (mode === 'touch') {
      canvas.addEventListener('touchmove', handleTouch, { passive: true })
      canvas.addEventListener('mousemove', handleMouseMove)
    }

    // Mock audio amplitude (oscillates 0..1)
    let t = 0

    const draw = () => {
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)

      t += 0.02
      const amp = mode === 'audio' ? 0.5 + 0.5 * Math.sin(t * 2.3) : 0

      particlesRef.current.forEach(p => {
        // Update position
        if (mode === 'splash') {
          const gx = gyroRef.current.gamma / 90 // -1..1
          const gy = gyroRef.current.beta / 90
          p.vx += gx * 0.03
          p.vy += gy * 0.03
          p.vx = lerp(p.vx, 0, 0.02)
          p.vy = lerp(p.vy, 0, 0.02)
          p.vx = Math.max(-1.5, Math.min(1.5, p.vx))
          p.vy = Math.max(-1.5, Math.min(1.5, p.vy))
        } else if (mode === 'audio') {
          const cx = W / 2, cy = H / 2
          const dx = p.x - cx, dy = p.y - cy
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = amp * 0.8
          p.vx += (dx / dist) * force * 0.08
          p.vy += (dy / dist) * force * 0.08
          p.vx = lerp(p.vx, (Math.random() - 0.5) * 0.5, 0.04)
          p.vy = lerp(p.vy, (Math.random() - 0.5) * 0.5, 0.04)
        } else if (mode === 'touch') {
          if (touchRef.current.active) {
            const dx = touchRef.current.x - p.x
            const dy = touchRef.current.y - p.y
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const pull = Math.min(60 / dist, 1.2)
            p.vx = lerp(p.vx, dx / dist * pull, 0.06)
            p.vy = lerp(p.vy, dy / dist * pull, 0.06)
          } else {
            p.vx = lerp(p.vx, 0, 0.04)
            p.vy = lerp(p.vy, 0, 0.04)
          }
        }

        p.x += p.vx
        p.y += p.vy

        // Wrap around
        if (p.x < -4) p.x = W + 4
        if (p.x > W + 4) p.x = -4
        if (p.y < -4) p.y = H + 4
        if (p.y > H + 4) p.y = -4

        // Draw
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        if (p.amber) {
          ctx.fillStyle = `rgba(232,165,71,${p.alpha})`
        } else {
          ctx.fillStyle = `rgba(74,75,67,${p.alpha})`
        }
        ctx.fill()
      })

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      if (gyroHandler) window.removeEventListener('deviceorientation', gyroHandler)
      if (mode === 'touch') {
        canvas.removeEventListener('touchmove', handleTouch)
        canvas.removeEventListener('mousemove', handleMouseMove)
      }
    }
  }, [mode, shouldRun])

  if (!shouldRun) return null

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        ...style,
      }}
    />
  )
}
