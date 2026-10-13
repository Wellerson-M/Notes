'use client'
import { useEffect, useState } from 'react'

/**
 * Altura do teclado virtual que cobre a parte de baixo da tela, em px.
 * No Android o viewport já encolhe com o teclado (`interactive-widget=resizes-content` no
 * layout) e isto dá 0; no iPhone o teclado cobre a página e a barra precisa subir junto.
 */
export function useKeyboardInset(active = true): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!active || !vv) return
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)))
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      setInset(0)
    }
  }, [active])

  return inset
}
