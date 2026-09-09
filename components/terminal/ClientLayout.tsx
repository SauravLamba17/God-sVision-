'use client'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'

const TopBar = dynamic(() => import('@/components/terminal/TopBar'), { ssr: false })
const NavBar = dynamic(() => import('@/components/terminal/NavBar'), { ssr: false })
const StatusBar = dynamic(() => import('@/components/terminal/StatusBar'), { ssr: false })
const CommandPalette = dynamic(() => import('@/components/terminal/CommandPalette'), { ssr: false })
const WatchlistSidebar = dynamic(() => import('@/components/terminal/WatchlistSidebar'), { ssr: false })
const AlertChecker = dynamic(() => import('@/components/terminal/AlertChecker'), { ssr: false })

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isGodMode = pathname === '/godmode'
  // Auth pages render fully standalone — no TopBar/NavBar/ticker chrome — so a
  // signed-out visitor sees ONLY the sign-in/register page (hard login gate).
  const isAuthPage = pathname?.startsWith('/auth')
  // The public marketing landing page at '/' renders fully standalone too —
  // it has its own header, ticker and footer, and must not be wrapped in the
  // authenticated terminal chrome (TopBar/NavBar/StatusBar + fixed <main>).
  const isLanding = pathname === '/'

  if (isGodMode || isAuthPage || isLanding) {
    return <>{children}</>
  }

  return (
    <>
      <TopBar />
      <NavBar />
      <CommandPalette />
      <WatchlistSidebar />
      <AlertChecker />
      <main
        style={{
          position: 'fixed',
          top: 100,
          left: 0,
          right: 0,
          bottom: 26,
          overflowY: 'auto',
          background: 'var(--bg-terminal)',
        }}
      >
        {children}
      </main>
      <StatusBar />
    </>
  )
}
