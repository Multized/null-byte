import { useState, useCallback, useRef } from 'react'
import { useGameStore } from '../game/store'
import { formatBits, formatRate, calcGlobalMultiplier, calcGhostCreditsFromBits } from '../game/utils'
import { artifactComboWindowMs } from '../game/quests'
import { PRESTIGE_UNLOCK_BITS } from '../game/constants'
import { playSound } from '../game/sound'
import { useTweenedNumber } from '../hooks/useTweenedNumber'
import { ContractsPanel } from './ContractsPanel'
import { QuestPanel } from './QuestPanel'

interface FloatText {
  id: number
  x: number
  y: number
  text: string
}

interface Particle {
  id: number
  x: number
  y: number
  px: number
  py: number
  glyph: string
  color: string
}

let floatIdCounter = 0

const COMBO_WINDOW_MS = 800
const COMBO_CAP = 20

interface Props {
  onPrestigeClick: () => void
  onGhostShopClick: () => void
}

function StatSlot({ icon, label, value, accent = 'cyan' }: { icon: string; label: string; value: string; accent?: 'cyan' | 'purple' }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-1 min-w-0">
      <div className="flex items-center gap-1 font-mono text-[9px] text-slate-600 uppercase tracking-widest whitespace-nowrap">
        <span>{icon}</span><span>{label}</span>
      </div>
      <div className={`font-mono text-sm font-semibold whitespace-nowrap ${accent === 'purple' ? 'neon-purple' : 'text-cyan-400'}`}>
        {value}
      </div>
    </div>
  )
}

export function ClickArea({ onPrestigeClick, onGhostShopClick }: Props) {
  const click = useGameStore(s => s.click)
  const recordCombo = useGameStore(s => s.recordCombo)
  const bitsPerClick = useGameStore(s => s.bitsPerClick)
  const bitsPerSecond = useGameStore(s => s.bitsPerSecond)
  const totalBitsEarned = useGameStore(s => s.totalBitsEarned)
  const ghostCredits = useGameStore(s => s.ghostCredits)
  const prestigeCount = useGameStore(s => s.prestigeCount)
  const eventBpsMultiplier = useGameStore(s => s.eventBpsMultiplier)
  const eventClickMultiplier = useGameStore(s => s.eventClickMultiplier)
  const eventExpiresAt = useGameStore(s => s.eventExpiresAt)
  const penaltyMultiplier = useGameStore(s => s.penaltyMultiplier)
  const penaltyExpiresAt = useGameStore(s => s.penaltyExpiresAt)
  const state = useGameStore(s => s)
  const now = Date.now()
  const eventActive = eventExpiresAt > now
  const eventSecondsLeft = eventActive ? Math.ceil((eventExpiresAt - now) / 1000) : 0
  const penaltyActive = penaltyExpiresAt > now
  const penaltySecondsLeft = penaltyActive ? Math.ceil((penaltyExpiresAt - now) / 1000) : 0
  const permanentMult = calcGlobalMultiplier(state)

  const [floats, setFloats] = useState<FloatText[]>([])
  const [particles, setParticles] = useState<Particle[]>([])
  const [isFlashing, setIsFlashing] = useState(false)
  const [combo, setCombo] = useState(0)
  const btnRef = useRef<HTMLButtonElement>(null)
  const lastClickRef = useRef(0)
  const comboResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const displayBps = useTweenedNumber(bitsPerSecond)

  const handleClick = useCallback((e: React.MouseEvent) => {
    const clickNow = Date.now()
    const comboWindow = COMBO_WINDOW_MS + artifactComboWindowMs(useGameStore.getState())
    const withinWindow = clickNow - lastClickRef.current < comboWindow
    const newCombo = withinWindow ? Math.min(COMBO_CAP, combo + 1) : 1
    lastClickRef.current = clickNow
    setCombo(newCombo)
    recordCombo(newCombo)
    if (comboResetRef.current) clearTimeout(comboResetRef.current)
    comboResetRef.current = setTimeout(() => setCombo(0), comboWindow)

    const comboMultiplier = 1 + Math.min(1, (newCombo - 1) / (COMBO_CAP - 1))
    const earned = click(comboMultiplier)
    playSound('click')
    if (newCombo > 0 && newCombo % 5 === 0) playSound('combo', newCombo)
    setIsFlashing(true)
    setTimeout(() => setIsFlashing(false), 80)

    const rect = btnRef.current?.getBoundingClientRect()
    const x = rect ? rect.left + Math.random() * rect.width * 0.6 + rect.width * 0.2 : e.clientX
    const y = rect ? rect.top + Math.random() * rect.height * 0.4 + rect.height * 0.2 : e.clientY

    const id = floatIdCounter++
    const comboSuffix = newCombo >= 3 ? ` ×${(comboMultiplier).toFixed(2)}` : ''
    setFloats(prev => [...prev, { id, x, y, text: `+${formatBits(earned)}${comboSuffix}` }])
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 1000)

    // Glyph burst from the click point; more + hotter colored at high combo
    const hue = 190 - Math.min(1, (newCombo - 1) / (COMBO_CAP - 1)) * 160
    const count = newCombo >= 10 ? 8 : 5
    const burst: Particle[] = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2
      const dist = 40 + Math.random() * 50
      return {
        id: floatIdCounter++,
        x: e.clientX,
        y: e.clientY,
        px: Math.cos(angle) * dist,
        py: Math.sin(angle) * dist,
        glyph: Math.random() < 0.5 ? '0' : '1',
        color: `hsl(${hue} 90% 60%)`,
      }
    })
    setParticles(prev => [...prev, ...burst])
    setTimeout(() => {
      const ids = new Set(burst.map(p => p.id))
      setParticles(prev => prev.filter(p => !ids.has(p.id)))
    }, 700)
  }, [click, combo, recordCombo])

  const comboPct = Math.min(1, (combo - 1) / (COMBO_CAP - 1))
  const comboHue = 190 - comboPct * 160 // cyan (190) → red (30)
  const comboActive = combo >= 2

  const canPrestige = totalBitsEarned >= PRESTIGE_UNLOCK_BITS
  const hasGhostCredits = ghostCredits > 0
  const showGhostShopEntry = hasGhostCredits || prestigeCount > 0
  const prestigeProgress = Math.min(1, totalBitsEarned / PRESTIGE_UNLOCK_BITS)
  const willEarnGc = canPrestige ? calcGhostCreditsFromBits(totalBitsEarned, state) : 0
  const showPrestigeTeaser = !canPrestige && prestigeCount === 0 && prestigeProgress > 0.02

  return (
    <div className="flex flex-col items-center w-full max-w-md px-6 pt-4 md:pt-5 pb-6 gap-5">

      {/* HUD stat strip */}
      <div className="relative w-full">
        <span className="corner-bracket tl" /><span className="corner-bracket tr" />
        <span className="corner-bracket bl" /><span className="corner-bracket br" />
        <div className="flex items-center justify-center divide-x divide-slate-800/60 border border-slate-800/40 rounded-md bg-[#08080f]/60 py-1">
          <StatSlot icon="⌨" label="click" value={formatBits(bitsPerClick)} />
          <StatSlot icon="⚡" label="rate" value={formatRate(displayBps)} />
          {permanentMult >= 1.01 && (
            <StatSlot icon="◆" label="bonus" value={`×${permanentMult.toFixed(2)}`} accent="purple" />
          )}
          {hasGhostCredits && (
            <StatSlot icon="👻" label="ghost" value={String(Math.floor(ghostCredits))} accent="purple" />
          )}
        </div>
      </div>

      {/* Hero click button, combo ring + badge integrated (no separate layout block) */}
      <div className="relative flex items-center justify-center shrink-0">
        {/* Combo progress ring, sits just outside the button, only visible mid-combo */}
        <div
          className="absolute -inset-2.5 rounded-full pointer-events-none transition-opacity duration-200"
          style={{
            opacity: comboActive ? 1 : 0,
            background: `conic-gradient(hsl(${comboHue} 90% 55%) ${comboPct * 360}deg, transparent ${comboPct * 360}deg)`,
            WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
          }}
        />

        <button
          ref={btnRef}
          onClick={handleClick}
          className={`
            click-btn relative w-52 h-52 md:w-60 md:h-60 rounded-full
            border-2 border-cyan-500/50
            bg-[#050a14]
            flex flex-col items-center justify-center gap-3
            cursor-pointer select-none
            transition-transform active:scale-95
            ${isFlashing ? 'bg-cyan-900/20' : ''}
          `}
          style={{
            boxShadow: isFlashing
              ? '0 0 60px rgba(0, 245, 255, 0.4), inset 0 0 40px rgba(0, 245, 255, 0.1)'
              : '0 0 20px rgba(0, 245, 255, 0.05)',
          }}
        >
          <div className="absolute inset-3 rounded-full border border-cyan-900/30" />
          <div className="absolute inset-6 rounded-full border border-cyan-900/15" />

          <div className="text-5xl md:text-6xl select-none">⌨</div>
          <div className="font-mono text-xs text-cyan-400/70 tracking-[0.3em]">EXECUTE</div>
          <div className="font-mono text-[10px] text-slate-700 tracking-widest">
            run_script.sh
            {prestigeCount > 0 && <span className="text-purple-500/60"> v{prestigeCount}</span>}
          </div>
          <div className="font-mono text-xs text-cyan-500/40 absolute bottom-10">
            <span className="cursor-blink">_</span>
          </div>
        </button>

        {/* Combo badge */}
        {comboActive && (
          <div
            key={combo}
            className="combo-pop absolute -top-1.5 -right-1.5 z-10 px-2 py-1 rounded-full font-mono text-[11px] font-bold border"
            style={{
              background: `hsl(${comboHue} 60% 14%)`,
              color: `hsl(${comboHue} 90% 68%)`,
              borderColor: `hsl(${comboHue} 90% 40%)`,
              boxShadow: `0 0 12px hsl(${comboHue} 90% 45% / 0.5)`,
            }}
          >
            ×{combo}
          </div>
        )}
      </div>

      {/* Floating texts */}
      {floats.map(f => (
        <div
          key={f.id}
          className="float-text"
          style={{ left: f.x, top: f.y }}
        >
          {f.text}
        </div>
      ))}

      {/* Click glyph particles */}
      {particles.map(p => (
        <span
          key={p.id}
          className="click-particle"
          style={{
            left: p.x,
            top: p.y,
            color: p.color,
            ['--px' as string]: `${p.px}px`,
            ['--py' as string]: `${p.py}px`,
          }}
        >
          {p.glyph}
        </span>
      ))}

      {/* Reserved single-line status zone: penalty > event > prestige teaser */}
      <div className="w-full min-h-[38px] flex items-center">
        {penaltyActive ? (
          <div key="penalty" className="status-in w-full flex items-center justify-between px-3 py-2 rounded border border-red-700/40 bg-red-900/10 font-mono text-xs">
            <span className="text-red-400">
              ⚠ −{Math.round((1 - penaltyMultiplier) * 100)}% BPS · Sabotage aktiv
            </span>
            <span className="text-red-600">{penaltySecondsLeft}s</span>
          </div>
        ) : eventActive ? (
          <div key="event" className="status-in w-full flex items-center justify-between px-3 py-2 rounded border border-green-700/40 bg-green-900/10 font-mono text-xs">
            <span className="text-green-400">
              {eventBpsMultiplier > 1 ? `⚡ ${eventBpsMultiplier}× BPS aktiv` : `⚡ ${eventClickMultiplier}× Click aktiv`}
            </span>
            <span className="text-green-600">{eventSecondsLeft}s</span>
          </div>
        ) : showPrestigeTeaser ? (
          <div key="teaser" className="status-in w-full">
            <div className="flex items-center justify-between font-mono text-[10px] text-slate-600 mb-1">
              <span>Fortschritt bis Prestige</span>
              <span>{Math.floor(prestigeProgress * 100)}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-600/50 transition-all duration-500"
                style={{ width: `${prestigeProgress * 100}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Action dock — fixed slot, never shifts the button above it */}
      <div className="w-full flex flex-col gap-2 min-h-[52px]">
        {canPrestige && (
          <button
            onClick={onPrestigeClick}
            className="
              w-full flex items-center gap-3 font-mono text-xs px-4 py-3 rounded-lg
              border border-purple-500/60 text-purple-200 bg-purple-900/20
              hover:bg-purple-900/35 hover:border-purple-400 transition-all duration-150
              animate-pulse
            "
          >
            <span className="text-lg leading-none">⬆</span>
            <span className="flex-1 text-left font-semibold tracking-wide">PRESTIGE VERFÜGBAR</span>
            <span className="neon-purple font-semibold">+{willEarnGc} gc</span>
          </button>
        )}

        {showGhostShopEntry && (
          <button
            onClick={onGhostShopClick}
            className="
              w-full flex items-center gap-3 font-mono text-xs px-4 py-2.5 rounded-lg
              border border-indigo-800/40 text-indigo-300/80 bg-indigo-950/10
              hover:bg-indigo-950/20 hover:border-indigo-600/50 transition-all duration-150
            "
          >
            <span className="text-base leading-none">👻</span>
            <span className="flex-1 text-left">Ghost Shop</span>
            {hasGhostCredits && <span className="text-indigo-300">{Math.floor(ghostCredits)} gc</span>}
          </button>
        )}
      </div>

      {/* Story operation — the long-term narrative goal */}
      <QuestPanel />

      {/* Rotating contracts — the short-term goal loop */}
      <ContractsPanel />
    </div>
  )
}
