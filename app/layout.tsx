import { THEME_BOOT_SCRIPT } from '@/lib/theme'
import type { Metadata, Viewport } from 'next'
import { Inter, Newsreader, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import Splash from '@/components/Splash'
import AppBoot from '@/components/AppBoot'
import Toast from '@/components/Toast'
import ListenBar from '@/components/ListenBar'
import GalaxyBackdrop from '@/components/GalaxyBackdrop'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
  style: ['normal', 'italic'],
  weight: ['400', '500', '600'],
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  weight: ['400'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Grafite Notas',
  applicationName: 'Grafite Notas',
  description: 'Suas notas pessoais, com IA, voz e conexões',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Grafite Notas',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Android: a página encolhe com o teclado, e as barras fixas do editor ficam acima dele
  interactiveWidget: 'resizes-content',
  themeColor: '#111210',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${newsreader.variable} ${jetbrainsMono.variable}`}
      style={{ background: 'var(--bg-base)' }}
      // O tema salvo é aplicado no <html> antes da hidratação (data-theme)
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                ${process.env.NODE_ENV === 'production'
                  ? `window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js?v=${process.env.APP_VERSION}').catch(() => {}) })`
                  // No dev o cache atrapalharia o hot reload
                  : "navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()))"}
              }
            `,
          }}
        />
      </head>
      {/* O fundo do body vem do globals.css (com a galáxia no PC ele fica transparente) */}
      <body style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
        <GalaxyBackdrop />
        <Splash />
        <AppBoot />
        {children}
        <ListenBar />
        <Toast />
      </body>
    </html>
  )
}
