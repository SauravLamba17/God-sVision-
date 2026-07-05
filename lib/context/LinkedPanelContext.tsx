'use client';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface LinkedPanelContextType {
  activeTicker: string;
  setActiveTicker: (ticker: string) => void;
  linkedPanels: Set<string>;
  togglePanelLink: (panelId: string) => void;
  isPanelLinked: (panelId: string) => boolean;
}

const LinkedPanelContext = createContext<LinkedPanelContextType>({
  activeTicker: 'AAPL',
  setActiveTicker: () => {},
  linkedPanels: new Set(),
  togglePanelLink: () => {},
  isPanelLinked: () => false,
});

export function LinkedPanelProvider({ children }: { children: ReactNode }) {
  const [activeTicker, setActiveTicker] = useState('AAPL');
  const [linkedPanels, setLinkedPanels] = useState<Set<string>>(new Set(['p1', 'p2', 'p3', 'p4']));

  const togglePanelLink = useCallback((panelId: string) => {
    setLinkedPanels(prev => {
      const next = new Set(prev);
      if (next.has(panelId)) next.delete(panelId);
      else next.add(panelId);
      return next;
    });
  }, []);

  const isPanelLinked = useCallback((panelId: string) => linkedPanels.has(panelId), [linkedPanels]);

  return (
    <LinkedPanelContext.Provider value={{ activeTicker, setActiveTicker, linkedPanels, togglePanelLink, isPanelLinked }}>
      {children}
    </LinkedPanelContext.Provider>
  );
}

export function useLinkedPanel() {
  return useContext(LinkedPanelContext);
}
