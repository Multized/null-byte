// ---------------------------------------------------------------------------
// Audio engine: gentle procedural SFX + generative ambient background music.
// Two independent toggles (SFX / music), persisted in localStorage.
// ---------------------------------------------------------------------------

const LEGACY_MUTE_KEY = 'nullbyte_muted'
const SFX_KEY = 'nullbyte_sfx_muted'
const MUSIC_KEY = 'nullbyte_music_on'

type SoundName = 'click' | 'buy' | 'upgrade' | 'milestone' | 'achievement' | 'prestige' | 'event' | 'combo'

let ctx: AudioContext | null = null
let sfxBus: GainNode | null = null // soft lowpass bus for all SFX
let musicBus: GainNode | null = null

// Migrate the old single mute flag → SFX mute
let sfxMuted = (() => {
  const v = localStorage.getItem(SFX_KEY)
  if (v !== null) return v === '1'
  return localStorage.getItem(LEGACY_MUTE_KEY) === '1'
})()
let musicOn = localStorage.getItem(MUSIC_KEY) === '1'

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

function getSfxBus(c: AudioContext): GainNode {
  if (!sfxBus) {
    const gain = c.createGain()
    gain.gain.value = 0.9
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 3200 // shave the harsh top end
    lp.Q.value = 0.4
    gain.connect(lp)
    lp.connect(c.destination)
    sfxBus = gain
  }
  return sfxBus
}

// ---- toggles ---------------------------------------------------------------

export function isSfxMuted(): boolean { return sfxMuted }
export function setSfxMuted(next: boolean): void {
  sfxMuted = next
  localStorage.setItem(SFX_KEY, next ? '1' : '0')
}
export function toggleSfx(): boolean { setSfxMuted(!sfxMuted); return sfxMuted }

export function isMusicOn(): boolean { return musicOn }
export function setMusicOn(next: boolean): void {
  musicOn = next
  localStorage.setItem(MUSIC_KEY, next ? '1' : '0')
  if (next) startMusic()
  else stopMusic()
}
export function toggleMusic(): boolean { setMusicOn(!musicOn); return musicOn }

/** Arm music to start on the first user gesture (needed when it was left on from a prior session). */
let gestureArmed = false
export function initAudio(): void {
  if (gestureArmed) return
  gestureArmed = true
  const handler = () => {
    if (musicOn) startMusic()
    window.removeEventListener('pointerdown', handler)
    window.removeEventListener('keydown', handler)
  }
  window.addEventListener('pointerdown', handler)
  window.addEventListener('keydown', handler)
}

// ---- SFX primitives --------------------------------------------------------

function tone(
  c: AudioContext,
  freq: number,
  startAt: number,
  duration: number,
  type: OscillatorType = 'triangle',
  gainPeak = 0.04,
) {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, startAt)
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.linearRampToValueAtTime(gainPeak, startAt + 0.012) // soft attack — no click
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  osc.connect(gain)
  gain.connect(getSfxBus(c))
  osc.start(startAt)
  osc.stop(startAt + duration + 0.03)
}

function sweep(
  c: AudioContext,
  fromFreq: number,
  toFreq: number,
  startAt: number,
  duration: number,
  type: OscillatorType = 'sine',
  gainPeak = 0.04,
) {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(fromFreq, startAt)
  osc.frequency.exponentialRampToValueAtTime(toFreq, startAt + duration)
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.linearRampToValueAtTime(gainPeak, startAt + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  osc.connect(gain)
  gain.connect(getSfxBus(c))
  osc.start(startAt)
  osc.stop(startAt + duration + 0.03)
}

// A minor pentatonic, one octave up — pleasant for arpeggios/chimes
const PENTATONIC = [440.0, 523.25, 587.33, 659.25, 783.99, 880.0]

function playClick() {
  const c = getCtx()
  if (!c) return
  const t = c.currentTime
  // Soft warm "tock" with a tiny pitch wobble so rapid clicks don't feel mechanical
  const f = 300 + Math.random() * 40
  tone(c, f, t, 0.05, 'sine', 0.03)
  tone(c, f * 2, t, 0.03, 'triangle', 0.012) // subtle harmonic sparkle
}

function playBuy() {
  const c = getCtx()
  if (!c) return
  const t = c.currentTime
  tone(c, 523.25, t, 0.1, 'triangle', 0.035)       // C5
  tone(c, 783.99, t + 0.06, 0.12, 'triangle', 0.03) // G5
}

function playUpgrade() {
  const c = getCtx()
  if (!c) return
  const t = c.currentTime
  const notes = [523.25, 659.25, 783.99] // C E G — bright major triad
  notes.forEach((f, i) => tone(c, f, t + i * 0.06, 0.16, 'triangle', 0.035))
}

function playMilestone() {
  const c = getCtx()
  if (!c) return
  const t = c.currentTime
  sweep(c, 330, 660, t, 0.3, 'sine', 0.035)
  tone(c, 987.77, t + 0.25, 0.35, 'triangle', 0.03) // soft bell (B5)
}

function playAchievement() {
  const c = getCtx()
  if (!c) return
  const t = c.currentTime
  PENTATONIC.forEach((f, i) => tone(c, f, t + i * 0.075, 0.28, 'triangle', 0.032))
}

function playPrestige() {
  const c = getCtx()
  if (!c) return
  const t = c.currentTime
  sweep(c, 660, 165, t, 0.55, 'sine', 0.035)        // dissolve down
  sweep(c, 165, 880, t + 0.5, 0.7, 'triangle', 0.035) // rebuild up
  tone(c, 1046.5, t + 1.1, 0.4, 'triangle', 0.03)
}

function playEvent() {
  const c = getCtx()
  if (!c) return
  const t = c.currentTime
  tone(c, 880, t, 0.12, 'sine', 0.035)
  tone(c, 1174.66, t + 0.14, 0.18, 'sine', 0.035) // gentle two-note ping (A5 → D6)
}

function playCombo(comboLevel: number) {
  const c = getCtx()
  if (!c) return
  const t = c.currentTime
  const idx = Math.min(PENTATONIC.length - 1, Math.floor(comboLevel / 4))
  tone(c, PENTATONIC[idx], t, 0.08, 'sine', 0.028)
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
  if (sfxMuted) return
  try {
    PLAYERS[name](comboLevel)
  } catch {
    // audio context may be blocked before first user gesture — ignore
  }
}

// ---- Generative ambient music ---------------------------------------------

// Dark, slow chord progression (A minor feel): Am – F – Cmaj – G, triads mid-octave.
const PROGRESSION: number[][] = [
  [220.0, 261.63, 329.63], // Am  (A3 C4 E4)
  [174.61, 220.0, 261.63], // F   (F3 A3 C4)
  [261.63, 329.63, 392.0],  // C   (C4 E4 G4)
  [196.0, 246.94, 293.66],  // G   (G3 B3 D4)
]
const CHORD_DUR = 7.5 // seconds per chord

let musicPlaying = false
let chordTimer: ReturnType<typeof setTimeout> | null = null
let arpTimer: ReturnType<typeof setInterval> | null = null
let chordIndex = 0
let currentChord: number[] = PROGRESSION[0]
const activeNodes = new Set<AudioScheduledSourceNode>()

function getMusicBus(c: AudioContext): GainNode {
  if (!musicBus) {
    const gain = c.createGain()
    gain.gain.value = 0.0001
    gain.connect(c.destination)
    musicBus = gain
  }
  return musicBus
}

function track(node: AudioScheduledSourceNode) {
  activeNodes.add(node)
  node.addEventListener('ended', () => activeNodes.delete(node))
}

function playPadChord(c: AudioContext, freqs: number[], startAt: number, dur: number) {
  const bus = getMusicBus(c)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(700, startAt)
  lp.frequency.linearRampToValueAtTime(1100, startAt + dur * 0.5) // gentle opening
  lp.frequency.linearRampToValueAtTime(700, startAt + dur)
  lp.Q.value = 0.6
  lp.connect(bus)

  const chordGain = c.createGain()
  chordGain.gain.setValueAtTime(0.0001, startAt)
  chordGain.gain.linearRampToValueAtTime(0.12, startAt + 2.0)          // slow swell in
  chordGain.gain.setValueAtTime(0.12, startAt + dur - 2.0)
  chordGain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur)   // slow fade out
  chordGain.connect(lp)

  // Each chord tone = two slightly detuned triangles for a warm, wide pad
  for (const f of freqs) {
    for (const detune of [-4, 4]) {
      const osc = c.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = f
      osc.detune.value = detune
      osc.connect(chordGain)
      osc.start(startAt)
      osc.stop(startAt + dur + 0.1)
      track(osc)
    }
  }

  // Sub bass one octave below the root
  const bass = c.createOscillator()
  const bassGain = c.createGain()
  bass.type = 'sine'
  bass.frequency.value = freqs[0] / 2
  bassGain.gain.setValueAtTime(0.0001, startAt)
  bassGain.gain.linearRampToValueAtTime(0.06, startAt + 1.5)
  bassGain.gain.setValueAtTime(0.06, startAt + dur - 1.5)
  bassGain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur)
  bass.connect(bassGain)
  bassGain.connect(bus)
  bass.start(startAt)
  bass.stop(startAt + dur + 0.1)
  track(bass)
}

function playArpBlip(c: AudioContext) {
  if (!musicPlaying) return
  if (Math.random() < 0.35) return // leave space — sparse, not busy
  const bus = getMusicBus(c)
  const t = c.currentTime
  const note = currentChord[Math.floor(Math.random() * currentChord.length)] * 2 // up an octave
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = note
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.linearRampToValueAtTime(0.03, t + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)

  // A touch of echo for space
  const delay = c.createDelay()
  delay.delayTime.value = 0.32
  const fb = c.createGain()
  fb.gain.value = 0.28
  gain.connect(bus)
  gain.connect(delay)
  delay.connect(fb)
  fb.connect(delay)
  fb.connect(bus)

  osc.connect(gain)
  osc.start(t)
  osc.stop(t + 1.0)
  track(osc)
}

function scheduleChord() {
  const c = getCtx()
  if (!c || !musicPlaying) return
  currentChord = PROGRESSION[chordIndex]
  playPadChord(c, currentChord, c.currentTime, CHORD_DUR)
  chordIndex = (chordIndex + 1) % PROGRESSION.length
  // start the next chord slightly before this one fully releases → smooth crossfade
  chordTimer = setTimeout(scheduleChord, (CHORD_DUR - 1.5) * 1000)
}

export function startMusic(): void {
  if (musicPlaying) return
  const c = getCtx()
  if (!c) return
  musicPlaying = true
  const bus = getMusicBus(c)
  bus.gain.cancelScheduledValues(c.currentTime)
  bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), c.currentTime)
  bus.gain.linearRampToValueAtTime(0.5, c.currentTime + 2.0) // fade in
  scheduleChord()
  arpTimer = setInterval(() => {
    try { playArpBlip(c) } catch { /* ignore */ }
  }, 1900)
}

export function stopMusic(): void {
  if (!musicPlaying) return
  musicPlaying = false
  if (chordTimer) { clearTimeout(chordTimer); chordTimer = null }
  if (arpTimer) { clearInterval(arpTimer); arpTimer = null }
  const c = ctx
  if (c && musicBus) {
    musicBus.gain.cancelScheduledValues(c.currentTime)
    musicBus.gain.setValueAtTime(musicBus.gain.value, c.currentTime)
    musicBus.gain.linearRampToValueAtTime(0.0001, c.currentTime + 0.6) // fade out
  }
  // hard-stop lingering oscillators shortly after the fade
  setTimeout(() => {
    for (const node of activeNodes) {
      try { node.stop() } catch { /* already stopped */ }
    }
    activeNodes.clear()
  }, 700)
}
