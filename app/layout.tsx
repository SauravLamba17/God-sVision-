import type { Metadata } from 'next'
import './globals.css'
import ClientLayout from '@/components/terminal/ClientLayout'
import { Providers } from '@/components/providers/Providers'
import dynamic from 'next/dynamic'
const TickerBroadcast = dynamic(() => import('@/components/terminal/TickerBroadcast'), { ssr: false })

export const metadata: Metadata = {
  title: "GOD's VISION | Financial Intelligence Terminal",
  description: 'Bloomberg-style financial intelligence platform with real-time markets, crypto, forex, macro, news, and world data.',
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>âš¡</text></svg>" }
}

const themeInitScript = `(function(){try{var t=localStorage.getItem('gv_theme')||'dark';if(t==='system'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);var bg=t==='light'?'#f0f4f0':t==='dark-contrast'?'var(--bg-terminal)':'var(--bg-terminal)';document.documentElement.style.background=bg;document.body&&(document.body.style.background=bg);}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body style={{ background: 'var(--bg-terminal, #000000)', color: 'var(--text-primary, #c8e6c9)', margin: 0, padding: 0, overflow: 'hidden', height: '100vh' }}>
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
