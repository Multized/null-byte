const MUTE_KEY = 'nullbyte_muted'

type SoundName = 'click' | 'buy' | 'upgrade' | 'milestone' | 'achievement' | 'prestige' | 'event' | 'combo'

let ctx: AudioContext | null = null
let muted = localStorage.getItem(MUTE_KEY) === '1'

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

export function isMuted(): boolean {
  return muted
}

export function setMuted(next: boolean): void {
  muted = next
  localStorage.setItem(MUTE_KEY, next ? '1' : '0')
}

export function toggleMuted(): boolean {
  setMuted(!muted)
  return muted
}

function tone(
  c: AudioContext,
  freq: number,
  startAt: number,
  duration: number,
  type: OscillatorType = 'square',
  gainPeak = 0.06,
) {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, startAt)
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(gainPeak, startAt + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.02)
}

function sweep(
  c: AudioContext,
  fromFreq: number,
  toFreq: number,
  startAt: number,
  duration: number,
  type: OscillatorType = 'sawtooth',
  gainPeak = 0.05,
) {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(fromFreq, startAt)
  osc.frequency.exponentialRampToValueAtTime(toFreq, startAt + duration)
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(gainPeak, startAt + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.02)
}

function noiseBurst(c: AudioContext, startAt: number, duration: number, gainPeak = 0.03) {
  const bufferSize = Math.max(1, Math.floor(c.sampleRate * duration))
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buffer
  const filter = c.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = 4000
  const gain = c.createGain()
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(gainPeak, startAt + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(c.destination)
  src.start(startAt)
  src.stop(startAt + duration + 0.02)
}

const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5] // C5 major-ish pentatonic

function playClick() {
  const c = getCtx()
  if (!c) return
  const t = c.currentTime
  tone(c, 1400 + Math.random() * 200, t, 0.045, 'square', 0.035)
}

function playBuy() {
  const c = getCtx()
  if (!c) return
  const t = c.currentTime
  tone(c, 660, t, 0.07, 'square', 0.05)
  tone(c, 990, t + 0.045, 0.09, 'square', 0.045)
}

function playUpgrade() {
  const c = getCtx()
  if (!c) return
  const t = c.currentTime
  const notes = [523.25, 659.25, 783.99, 1046.5]
  notes.forEach((f, i) => tone(c, f, t + i * 0.055, 0.12, 'triangle', 0.05))
}

function playMilestone() {
  const c = getCtx()
  if (!c) return
  const t = c.currentTime
  sweep(c, 220, 880, t, 0.25, 'sawtooth', 0.045)
  tone(c, 1318.5, t + 0.22, 0.18, 'triangle', 0.05)
}

function playAchievement() {
  const c = getCtx()
  if (!c) return
  const t = c.currentTime
  PENTATONIC.forEach((f, i) => tone(c, f, t + i * 0.07, 0.22, 'triangle', 0.045))
}

function playPrestige() {
  const c = getCtx()
  if (!c) return
  const t = c.currentTime
  sweep(c, 1200, 80, t, 0.5, 'sawtooth', 0.04)
  noiseBurst(c, t + 0.05, 0.4, 0.02)
  sweep(c, 80, 1600, t + 0.5, 0.6, 'sine', 0.05)
}

function playEvent() {
  const c = getCtx()
  if (!c) return
  const t = c.currentTime
  tone(c, 1046.5, t, 0.08, 'square', 0.05)
  tone(c, 1046.5, t + 0.12, 0.08, 'square', 0.05)
  tone(c, 1318.5, t + 0.24, 0.14, 'square', 0.055)
}

function playCombo(comboLevel: number) {
  const c = getCtx()
  if (!c) return
  const t = c.currentTime
  const idx = Math.min(PENTATONIC.length - 1, Math.floor(comboLevel / 4))
  tone(c, PENTATONIC[idx], t, 0.05, 'square', 0.03)
}

const PLAYERS: Record<SoundName, (comboLevel?: number) => void> = {
  click: playClick,
  buy: playBuy,
  upgrade: playUpgrade,
  milestone: playMilestone,
  achievement: playAchievement,
  prestige: playPrestige,
  event: playEvent,
  combo: (level?: number) => playCombo(level ?? 0),
}

export function playSound(name: SoundName, comboLevel?: number): void {
  if (muted) return
  try {
    PLAYERS[name](comboLevel)
  } catch {
    // audio context may be blocked before first user gesture — ignore
  }
}
