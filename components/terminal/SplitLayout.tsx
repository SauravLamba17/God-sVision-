'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { MODULE_MAP, MODULE_NAMES } from '@/components/modules';
import { useLinkedPanel } from '@/lib/context/LinkedPanelContext';

interface PanelConfig {
  id: string;
  moduleId: string;
}

const DEFAULT_PANELS: PanelConfig[] = [
  { id: 'p1', moduleId: 'MARKETS' },
  { id: 'p2', moduleId: 'CRYPTO' },
  { id: 'p3', moduleId: 'NEWS' },
  { id: 'p4', moduleId: 'FOREX' },
];

const STORAGE_KEY = 'gv_split_panels';

function PanelSlot({ config, index, onModuleChange }: {
  config: PanelConfig;
  index: number;
  onModuleChange: (id: string, moduleId: string) => void;
}) {
  const { activeTicker, isPanelLinked, togglePanelLink } = useLinkedPanel();
  const linked = isPanelLinked(config.id);
  const effectiveTicker = linked ? activeTicker : undefined;
  const ModuleComponent = MODULE_MAP[config.moduleId];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-terminal)', border: '1px solid var(--border-dim)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '2px 6px', background: 'var(--bg-header)',
        borderBottom: `1px solid ${linked ? 'var(--text-accent)' : 'var(--border-accent)'}`,
        flexShrink: 0, height: 24,
      }}>
        <span style={{ fontSize: 8, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '1px', fontFamily: 'IBM Plex Mono, monospace' }}>
          P{index + 1}
        </span>
        <select
          value={config.moduleId}
          onChange={e => onModuleChange(config.id, e.target.value)}
          style={{
            background: 'var(--bg-input)', color: 'var(--text-accent)',
            border: '1px solid var(--border-dim)', borderRadius: 2,
            fontSize: 9, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace',
            padding: '1px 4px', cursor: 'pointer', outline: 'none',
            letterSpacing: '0.5px',
          }}
        >
          {MODULE_NAMES.map(name => (
            <option key={name} value={name} style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>
              {name}
            </option>
          ))}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <button
            onClick={() => togglePanelLink(config.id)}
            title={linked ? 'Unlink panel from active ticker' : 'Link panel to active ticker'}
            style={{
              background: linked ? 'rgba(255,109,0,0.15)' : 'transparent',
              border: `1px solid ${linked ? 'var(--text-accent)' : 'var(--border-dim)'}`,
              borderRadius: 2, padding: '0 4px', height: 16,
              fontFamily: 'IBM Plex Mono, monospace', fontSize: 8,
              color: linked ? 'var(--text-accent)' : 'var(--text-muted)',
              cursor: 'pointer', lineHeight: 1,
            }}
          >
            ⧉
          </button>
          <button
            onClick={() => onModuleChange(config.id, DEFAULT_PANELS[index]?.moduleId ?? 'MARKETS')}
            title="Reset panel"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10, padding: '0 2px', lineHeight: 1 }}
          >
            ↺
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {ModuleComponent
          ? <ModuleComponent compact={true} ticker={effectiveTicker} />
          : <div style={{ padding: 8, color: 'var(--text-muted)', fontSize: 10, fontFamily: 'IBM Plex Mono, monospace' }}>Unknown module: {config.moduleId}</div>
        }
      </div>
    </div>
  );
}

export default function SplitLayout({ onExit }: { onExit: () => void }) {
  const [panels, setPanels] = useState<PanelConfig[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_PANELS;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length === 4 && parsed.every(p => p.id && p.moduleId)) return parsed;
    } catch { /* ignore */ }
    return DEFAULT_PANELS;
  });

  const [colSplit, setColSplit] = useState(50);
  const [rowSplit, setRowSplit] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'col' | 'row' | null>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(panels)); } catch { /* ignore */ }
  }, [panels]);

  const setModule = useCallback((id: string, moduleId: string) => {
    setPanels(prev => prev.map(p => p.id === id ? { ...p, moduleId } : p));
  }, []);

  const startColDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = 'col';
    const startX = e.clientX;
    const startCol = colSplit;
    const containerW = containerRef.current?.offsetWidth ?? 800;
    const onMove = (ev: MouseEvent) => setColSplit(Math.max(20, Math.min(80, startCol + ((ev.clientX - startX) / containerW) * 100)));
    const onUp = () => { dragging.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startRowDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = 'row';
    const startY = e.clientY;
    const startRow = rowSplit;
    const containerH = containerRef.current?.offsetHeight ?? 600;
    const onMove = (ev: MouseEvent) => setRowSplit(Math.max(20, Math.min(80, startRow + ((ev.clientY - startY) / containerH) * 100)));
    const onUp = () => { dragging.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      top: 100,
      bottom: 26,
      zIndex: 500,
      background: 'var(--bg-terminal)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Exit bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px', background: 'var(--bg-header)',
        borderBottom: '1px solid var(--border-accent)',
        flexShrink: 0, height: 26,
      }}>
        <span style={{ fontSize: 9, color: 'var(--text-accent)', fontWeight: 700, letterSpacing: '2px', fontFamily: 'IBM Plex Mono, monospace' }}>
          ⊞ SPLIT VIEW — ⧉ link panels to active ticker · Drag dividers to resize
        </span>
        <button
          onClick={onExit}
          style={{
            background: 'var(--bg-hover)', border: '1px solid var(--border-accent)',
            color: 'var(--text-accent)', padding: '2px 10px', borderRadius: 2,
            cursor: 'pointer', fontSize: 9, fontWeight: 700,
            fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.05em',
          }}
        >
          ✕ EXIT SPLIT
        </button>
      </div>

      {/* 2×2 grid */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: `${colSplit}% 4px 1fr`,
          gridTemplateRows: `${rowSplit}% 4px 1fr`,
          overflow: 'hidden',
          userSelect: dragging.current ? 'none' : 'auto',
        }}
      >
        <div style={{ overflow: 'hidden', gridRow: 1, gridColumn: 1 }}>
          <PanelSlot config={panels[0]} index={0} onModuleChange={setModule} />
        </div>
        <div
          onMouseDown={startColDrag}
          style={{ gridRow: '1 / 4', gridColumn: 2, background: 'var(--border-dim)', cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--text-accent)'}
          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--border-dim)'}
        >
          <div style={{ width: 2, height: 40, background: 'var(--border-medium)', borderRadius: 1 }} />
        </div>
        <div style={{ overflow: 'hidden', gridRow: 1, gridColumn: 3 }}>
          <PanelSlot config={panels[1]} index={1} onModuleChange={setModule} />
        </div>
        <div
          onMouseDown={startRowDrag}
          style={{ gridRow: 2, gridColumn: '1 / 4', background: 'var(--border-dim)', cursor: 'row-resize', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--text-accent)'}
          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--border-dim)'}
        >
          <div style={{ height: 2, width: 40, background: 'var(--border-medium)', borderRadius: 1 }} />
        </div>
        <div style={{ overflow: 'hidden', gridRow: 3, gridColumn: 1 }}>
          <PanelSlot config={panels[2]} index={2} onModuleChange={setModule} />
        </div>
        <div style={{ overflow: 'hidden', gridRow: 3, gridColumn: 3 }}>
          <PanelSlot config={panels[3]} index={3} onModuleChange={setModule} />
        </div>
      </div>
    </div>
  );
}
