'use client'
import { ReactNode, useState } from 'react'
import { motion } from 'framer-motion'

interface Props {
  children: ReactNode
  className?: string
}

export default function AmberCaret({ children, className = '' }: Props) {
  const [isActive, setIsActive] = useState(false)

  return (
    <motion.div
      className={`amber-caret ${className}`}
      onFocus={() => setIsActive(true)}
      onBlur={() => setIsActive(false)}
      animate={
        isActive
          ? { boxShadow: '0 0 8px 2px rgba(232, 165, 71, 0.12)' }
          : { boxShadow: '0 0 0px 0px rgba(232, 165, 71, 0)' }
      }
      transition={{ duration: 0.8, repeat: isActive ? Infinity : 0, repeatType: 'reverse' }}
      style={{ borderRadius: 8 }}
    >
      {children}
    </motion.div>
  )
}
