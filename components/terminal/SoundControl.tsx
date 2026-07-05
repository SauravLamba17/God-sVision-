'use client'
import { useEffect, useState } from 'react'
import { playAlertBeep, playNewsChime, playWarningTone } from '@/lib/sounds'

export default function SoundControl({ showTestButtons = false }: { showTestButtons?: boolean }) {
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    try {
      setMuted(localStorage.getItem('gv_sound_muted') === 'true')
    } catch { /* ignore */ }
  }, [])

  const toggle = () => {
    const next = !muted
    setMuted(next)
    try { localStorage.setItem('gv_sound_muted', String(next)) } catch { /* ignore */ }
    if (!next) playAlertBeep()
  }

  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      {showTestButtons && (
        <>
          <button onClick={playAlertBeep}  style={testBtn}>TEST BEEP</button>
          <button onClick={playNewsChime}  style={testBtn}>TEST CHIME</button>
          <button onClick={playWarningTone} style={testBtn}>TEST WARN</button>
        </>
      )}
      <button
        onClick={toggle}
        title={muted ? 'Sound muted â€” click to enable' : 'Sound on â€” click to mute'}
        style={{
          background:'none', border:'none', cursor:'pointer',
          fontFamily:'IBM Plex Mono', fontSize:14,
          color: muted ? 'var(--text-muted)' : 'var(--text-accent)',
          transition:'color 0.15s', padding:'0 2px',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = muted ? 'var(--text-muted)' : 'var(--text-warning)')}
        onMouseLeave={e => (e.currentTarget.style.color = muted ? 'var(--text-muted)' : 'var(--text-accent)')}
      >
        {muted ? 'ðŸ”‡' : 'ðŸ”Š'}
      </button>
    </div>
  )
}

const testBtn: React.CSSProperties = {
  fontFamily:'IBM Plex Mono', fontSize:9, cursor:'pointer',
  background:'rgba(255,109,0,0.1)', border:'1px solid #ff6d0040',
  color:'var(--text-accent)', padding:'2px 8px', borderRadius:2,
}
