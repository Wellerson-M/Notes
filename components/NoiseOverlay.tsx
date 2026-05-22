import { ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}

export default function NoiseOverlay({ children, className = '', style }: Props) {
  return (
    <div className={`noise-card ${className}`} style={style}>
      {children}
    </div>
  )
}
