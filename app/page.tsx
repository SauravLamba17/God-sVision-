import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import './landing.css'

import LandingHeader from '@/components/landing/LandingHeader'
import LandingHero from '@/components/landing/LandingHero'
import LandingMarkets from '@/components/landing/LandingMarkets'
import LandingAI from '@/components/landing/LandingAI'
import LandingBacktest from '@/components/landing/LandingBacktest'
import LandingWorld from '@/components/landing/LandingWorld'
import LandingDualMode from '@/components/landing/LandingDualMode'
import LandingLedger from '@/components/landing/LandingLedger'
import LandingCTA from '@/components/landing/LandingCTA'
import LandingFooter from '@/components/landing/LandingFooter'

const TITLE = "GOD's Vision — Market terminal, world intelligence, $0 a seat"
const DESCRIPTION =
  'Equities, crypto and FX on one tick engine, an AI analysis desk that writes your ' +
  'morning brief, strategy backtesting, and live flight, seismic and orbital feeds — ' +
  'free, with no seat licence.'

// This page is the public root now, so it carries its own metadata rather than
// inheriting the terminal's from the root layout.
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  themeColor: '#0a0b0d',
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "GOD's Vision",
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
}

export default async function LandingPage() {
  // An already-signed-in visitor gets the terminal, not the marketing page.
  const session = await getServerSession(authOptions)
  if (session) redirect('/dashboard')

  return (
    <div className="gv-landing" style={{
      position: 'relative', width: '100%', background: '#0a0b0d', minHeight: '100dvh',
    }}>
      <a href="#markets" className="gv-skip">Skip to content</a>

      {/* Scanline overlay */}
      <div aria-hidden="true" style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 3,
        background: 'repeating-linear-gradient(0deg, rgba(255,255,255,.013) 0px, rgba(255,255,255,.013) 1px, transparent 1px, transparent 3px)',
        mixBlendMode: 'overlay',
      }} />

      <LandingHeader />

      <main>
        <LandingHero />
        <LandingMarkets />
        <LandingAI />
        <LandingBacktest />
        <LandingWorld />
        <LandingDualMode />
        <LandingLedger />
        <LandingCTA />
      </main>

      <LandingFooter />
    </div>
  )
}
