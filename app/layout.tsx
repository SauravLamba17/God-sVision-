import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import ClientLayout from '@/components/terminal/ClientLayout'
import { Providers } from '@/components/providers/Providers'
import dynamic from 'next/dynamic'
const TickerBroadcast = dynamic(() => import('@/components/terminal/TickerBroadcast'), { ssr: false })

export const metadata: Metadata = {
  title: "GOD's Vision | Financial Intelligence Terminal",
  description: "Free Bloomberg Terminal alternative. Real-time stocks, crypto, forex, AI analysis, India mode.",
  icons: {
    icon: '/favicon.svg',
  },
}

// Self-hosted at build time by next/font: no font requests leave the site at runtime.
const sans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })

// Runs before first paint, so the page never flashes the wrong look. A saved
// choice wins; otherwise the OS (prefers-color-scheme / prefers-contrast: more).
// Mirrors readSaved() in lib/context/ThemeContext.tsx ('dark-contrast' and
// 'system' are values the old theme menu saved).
const themeInitScript = `(function(){var d=document.documentElement,t,c,m=function(q){return window.matchMedia(q).matches};try{t=localStorage.getItem('gv_theme');c=localStorage.getItem('gv_contrast')}catch(e){}if(t==='dark-contrast'){t='dark';if(!c)c='high'}if(t!=='dark'&&t!=='light')t=m('(prefers-color-scheme: light)')?'light':'dark';if(c!=='high'&&c!=='normal')c=m('(prefers-contrast: more)')?'high':'normal';d.setAttribute('data-theme',t);d.setAttribute('data-contrast',c)})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body style={{ background: 'var(--bg)', color: 'var(--text)', margin: 0, padding: 0, overflow: 'hidden', height: '100vh' }}>
        <Providers>
          <TickerBroadcast />
          <ClientLayout>
            {children}
          </ClientLayout>
        </Providers>
      </body>
    </html>
  )
}
