'use client'
import { ReactNode } from 'react'
import { ThemeProvider } from '@/lib/context/ThemeContext'
import { ModeProvider } from '@/lib/context/ModeContext'
import { SessionProviderWrapper } from './SessionProviderWrapper'
import { LinkedPanelProvider } from '@/lib/context/LinkedPanelContext'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProviderWrapper>
      <ThemeProvider>
        <ModeProvider>
          <LinkedPanelProvider>
            {children}
          </LinkedPanelProvider>
        </ModeProvider>
      </ThemeProvider>
    </SessionProviderWrapper>
  )
}
