function isMuted(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem('gv_sound_muted') === 'true'
}

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    return new (window.AudioContext || (window as any).webkitAudioContext)()
  } catch { return null }
}

function tone(freq: number, duration: number, volume: number, startTime: number, ac: AudioContext) {
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.frequency.value = freq
  osc.type = 'sine'
  gain.gain.setValueAtTime(volume, startTime)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
  osc.start(startTime)
  osc.stop(startTime + duration)
}

export function playAlertBeep() {
  if (isMuted()) return
  const ac = ctx()
  if (!ac) return
  const t = ac.currentTime
  tone(440, 0.2, 0.3, t, ac)
  setTimeout(() => ac.close(), 500)
}

export function playWarningTone() {
  if (isMuted()) return
  const ac = ctx()
  if (!ac) return
  const t = ac.currentTime
  tone(220, 0.4, 0.4, t, ac)
  tone(220, 0.4, 0.4, t + 0.55, ac)
  setTimeout(() => ac.close(), 1500)
}

export function playNewsChime() {
  if (isMuted()) return
  const ac = ctx()
  if (!ac) return
  const t = ac.currentTime
  tone(330, 0.12, 0.25, t, ac)
  tone(440, 0.12, 0.25, t + 0.13, ac)
  tone(550, 0.18, 0.25, t + 0.26, ac)
  setTimeout(() => ac.close(), 800)
}

export function playMarketOpen() {
  if (isMuted()) return
  const ac = ctx()
  if (!ac) return
  const t = ac.currentTime
  const freqs = [523, 659, 784, 1047, 784]
  freqs.forEach((f, i) => tone(f, 0.18, 0.3, t + i * 0.16, ac))
  setTimeout(() => ac.close(), 2000)
}

export function playMarketClose() {
  if (isMuted()) return
  const ac = ctx()
  if (!ac) return
  const t = ac.currentTime
  const freqs = [784, 659, 523, 440, 330]
  freqs.forEach((f, i) => tone(f, 0.18, 0.3, t + i * 0.16, ac))
  setTimeout(() => ac.close(), 2000)
}
