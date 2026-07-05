import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

export const MODULE_MAP: Record<string, ComponentType<{ compact?: boolean; ticker?: string }>> = {
  'DASHBOARD': dynamic(() => import('./DashboardModule'), { ssr: false }),
  'MARKETS':   dynamic(() => import('./MarketsModule'),   { ssr: false }),
  'CRYPTO':    dynamic(() => import('./CryptoModule'),    { ssr: false }),
  'FOREX':     dynamic(() => import('./ForexModule'),     { ssr: false }),
  'MACRO':     dynamic(() => import('./MacroModule'),     { ssr: false }),
  'NEWS':      dynamic(() => import('./NewsModule'),      { ssr: false }),
  'WEATHER':   dynamic(() => import('./WeatherModule'),   { ssr: false }),
  'FLIGHTS':   dynamic(() => import('./FlightsModule'),   { ssr: false }),
  'SPORTS':    dynamic(() => import('./SportsModule'),    { ssr: false }),
};

export const MODULE_NAMES = Object.keys(MODULE_MAP);
