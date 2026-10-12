'use client'
import ParticleField from './ParticleField'

interface Props {
  /** Ícone ou emoji grande e dessaturado acima do texto. */
  icon?: React.ReactNode
  /** Texto serif itálico — sempre em minúsculas, tom de voz do app. */
  message: string
  /** Distância do topo, varia por tela. */
  paddingTop?: number
  /** Altura do campo de partículas que segue o dedo. */
  fieldHeight?: number
}

export default function EmptyState({ icon, message, paddingTop = 80, fieldHeight = 240 }: Props) {
  return (
    <div style={{ position: 'relative', paddingTop }}>
      {/* Campo magnético: persegue o toque com lag elástico.
          Retorna null sozinho se "Efeitos de partícula" ou "Reduzir movimento" estiverem ativos. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: paddingTop - 40,
          height: fieldHeight,
          pointerEvents: 'auto',
        }}
      >
        <ParticleField mode="touch" />
      </div>

      <div
        className="flex flex-col items-center justify-center"
        style={{ position: 'relative', pointerEvents: 'none' }}
      >
        {icon}
        <p
          className="font-serif italic"
          style={{ color: 'var(--text-muted)', fontSize: 16, marginTop: icon ? 12 : 0, textAlign: 'center' }}
        >
          {message}
        </p>
      </div>
    </div>
  )
}
