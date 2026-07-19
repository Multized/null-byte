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

// ---- Catchy synthwave track (sequenced) -----------------------------------

const BPM = 112
const SIXTEENTH = 60 / BPM / 4          // seconds per 16th note
const STEPS_PER_BAR = 16
const TOTAL_STEPS = STEPS_PER_BAR * 4   // 4-bar loop
const MUSIC_LEVEL = 0.32                // overall music volume (quieter than the old pads)

function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12)
}

// [pad triad (MIDI), bass root (MIDI)] per bar — Am · F · C · G
const BARS: { pad: number[]; bass: number }[] = [
  { pad: [57, 60, 64], bass: 45 }, // Am
  { pad: [53, 57, 60], bass: 41 }, // F
  { pad: [60, 64, 67], bass: 48 }, // C
  { pad: [55, 59, 62], bass: 43 }, // G
]

// Lead hook (MIDI per step, null = rest) — a memorable line over the progression
const LEAD: (number | null)[] = new Array(TOTAL_STEPS).fill(null)
;([
  [0, 76], [2, 81], [4, 79], [7, 76],       // Am: E5 A5 G5 E5
  [16, 77], [18, 81], [20, 84], [23, 81],   // F:  F5 A5 C6 A5
  [32, 79], [34, 83], [36, 79], [39, 76],   // C:  G5 B5 G5 E5
  [48, 74], [50, 79], [52, 83], [55, 81],   // G:  D5 G5 B5 A5
] as [number, number][]).forEach(([s, n]) => { LEAD[s] = n })

function arpNote(bar: number, step: number): number {
  const tones = BARS[bar].pad
  const pattern = [0, 1, 2, 1]
  return tones[pattern[step % pattern.length]] + 12 // up an octave
}

let musicPlaying = false
let schedTimer: ReturnType<typeof setInterval> | null = null
let currentStep = 0
let nextNoteTime = 0
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

let noiseBuf: AudioBuffer | null = null
function getNoise(c: AudioContext): AudioBuffer {
  if (!noiseBuf || noiseBuf.sampleRate !== c.sampleRate) {
    const len = Math.floor(c.sampleRate * 0.4)
    noiseBuf = c.createBuffer(1, len, c.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  }
  return noiseBuf
}

// ---- instrument voices ----

function kick(c: AudioContext, t: number) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(140, t)
  o.frequency.exponentialRampToValueAtTime(45, t + 0.11)
  g.gain.setValueAtTime(0.5, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16)
  o.connect(g); g.connect(getMusicBus(c))
  o.start(t); o.stop(t + 0.2); track(o)
}

function snare(c: AudioContext, t: number) {
  const dur = 0.16
  const src = c.createBufferSource(); src.buffer = getNoise(c)
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.7
  const g = c.createGain()
  g.gain.setValueAtTime(0.28, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  src.connect(bp); bp.connect(g); g.connect(getMusicBus(c))
  src.start(t); src.stop(t + dur + 0.02); track(src)
}

function hat(c: AudioContext, t: number, gain: number) {
  const dur = 0.035
  const src = c.createBufferSource(); src.buffer = getNoise(c)
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 8500
  const g = c.createGain()
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  src.connect(hp); hp.connect(g); g.connect(getMusicBus(c))
  src.start(t); src.stop(t + dur + 0.02); track(src)
}

interface VoiceOpts {
  type?: OscillatorType
  gain?: number
  cutoff?: number
  detune?: number
  useDelay?: boolean
}

function synthNote(c: AudioContext, midi: number, t: number, dur: number, opts: VoiceOpts = {}) {
  const { type = 'sawtooth', gain = 0.14, cutoff = 2200, detune = 0, useDelay = false } = opts
  const o = c.createOscillator()
  o.type = type
  o.frequency.value = midiToFreq(midi)
  o.detune.value = detune
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.Q.value = 1
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(lp); lp.connect(g); g.connect(getMusicBus(c))
  if (useDelay) {
    const d = c.createDelay(); d.delayTime.value = SIXTEENTH * 3
    const fb = c.createGain(); fb.gain.value = 0.28
    g.connect(d); d.connect(fb); fb.connect(d); fb.connect(getMusicBus(c))
  }
  o.start(t); o.stop(t + dur + 0.05); track(o)
}

function padChord(c: AudioContext, tones: number[], t: number, dur: number) {
  for (const midi of tones) {
    for (const dt of [-6, 6]) {
      synthNote(c, midi, t, dur, { type: 'triangle', gain: 0.045, cutoff: 1300, detune: dt })
    }
  }
}

// ---- sequencer ----

function scheduleStep(c: AudioContext, step: number, t: number) {
  const bar = Math.floor(step / STEPS_PER_BAR)
  const inBar = step % STEPS_PER_BAR
  const data = BARS[bar]

  // Drums: 4-on-the-floor kick, snare on 2 & 4, offbeat hats (+ soft 16th ghosts)
  if (inBar % 4 === 0) kick(c, t)
  if (inBar === 4 || inBar === 12) snare(c, t)
  if (inBar % 4 === 2) hat(c, t, 0.11)
  else if (inBar % 2 === 1) hat(c, t, 0.05)

  // Driving bass on the eighths, octave lift on the last eighth of each beat-pair
  if (inBar % 2 === 0) {
    const oct = (inBar === 6 || inBar === 14) ? 12 : 0
    synthNote(c, data.bass + oct, t, SIXTEENTH * 1.7, { type: 'sawtooth', gain: 0.16, cutoff: 900 })
  }

  // Bright 16th arpeggio — the synthwave shimmer
  synthNote(c, arpNote(bar, step), t, SIXTEENTH * 1.3, { type: 'square', gain: 0.09, cutoff: 2800, useDelay: true })

  // Sustained pad at the start of each bar
  if (inBar === 0) padChord(c, data.pad, t, STEPS_PER_BAR * SIXTEENTH * 0.97)

  // Lead hook
  const ld = LEAD[step]
  if (ld != null) synthNote(c, ld, t, SIXTEENTH * 3.5, { type: 'sawtooth', gain: 0.1, cutoff: 3400, useDelay: true })
}

function scheduler() {
  const c = getCtx()
  if (!c || !musicPlaying) return
  while (nextNoteTime < c.currentTime + 0.12) {
    scheduleStep(c, currentStep, nextNoteTime)
    nextNoteTime += SIXTEENTH
    currentStep = (currentStep + 1) % TOTAL_STEPS
  }
}

export function startMusic(): void {
  if (musicPlaying) return
  const c = getCtx()
  if (!c) return
  musicPlaying = true
  currentStep = 0
  nextNoteTime = c.currentTime + 0.1
  const bus = getMusicBus(c)
  bus.gain.cancelScheduledValues(c.currentTime)
  bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), c.currentTime)
  bus.gain.linearRampToValueAtTime(MUSIC_LEVEL, c.currentTime + 1.2) // fade in
  schedTimer = setInterval(scheduler, 25)
  scheduler()
}

export function stopMusic(): void {
  if (!musicPlaying) return
  musicPlaying = false
  if (schedTimer) { clearInterval(schedTimer); schedTimer = null }
  const c = ctx
  if (c && musicBus) {
    musicBus.gain.cancelScheduledValues(c.currentTime)
    musicBus.gain.setValueAtTime(musicBus.gain.value, c.currentTime)
    musicBus.gain.linearRampToValueAtTime(0.0001, c.currentTime + 0.5) // fade out
  }
  setTimeout(() => {
    for (const node of activeNodes) {
      try { node.stop() } catch { /* already stopped */ }
    }
    activeNodes.clear()
  }, 600)
}
