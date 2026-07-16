import type { Metadata } from 'next'
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

const themeInitScript = `(function(){try{var t=localStorage.getItem('gv_theme')||'dark';if(t==='system'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);var bg=t==='light'?'#f0f4f0':t==='dark-contrast'?'var(--bg-terminal)':'var(--bg-terminal)';document.documentElement.style.background=bg;document.body&&(document.body.style.background=bg);}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
