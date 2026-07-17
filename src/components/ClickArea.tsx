import { useState, useCallback, useRef } from 'react'
import { useGameStore } from '../game/store'
import { formatBits, formatRate } from '../game/utils'
import { PRESTIGE_UNLOCK_BITS } from '../game/constants'

interface FloatText {
  id: number
  x: number
  y: number
  text: string
}

let floatIdCounter = 0

interface Props {
  onPrestigeClick: () => void
}

export function ClickArea({ onPrestigeClick }: Props) {
  const click = useGameStore(s => s.click)
  const bitsPerClick = useGameStore(s => s.bitsPerClick)
  const bitsPerSecond = useGameStore(s => s.bitsPerSecond)
  const totalBitsEarned = useGameStore(s => s.totalBitsEarned)
  const ghostCredits = useGameStore(s => s.ghostCredits)
  const prestigeCount = useGameStore(s => s.prestigeCount)
  const eventBpsMultiplier = useGameStore(s => s.eventBpsMultiplier)
  const eventClickMultiplier = useGameStore(s => s.eventClickMultiplier)
  const eventExpiresAt = useGameStore(s => s.eventExpiresAt)
  const now = Date.now()
  const eventActive = eventExpiresAt > now
  const eventSecondsLeft = eventActive ? Math.ceil((eventExpiresAt - now) / 1000) : 0

  const [floats, setFloats] = useState<FloatText[]>([])
  const [isFlashing, setIsFlashing] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  const handleClick = useCallback((e: React.MouseEvent) => {
    const earned = click()
    setIsFlashing(true)
    setTimeout(() => setIsFlashing(false), 80)

    const rect = btnRef.current?.getBoundingClientRect()
    const x = rect ? rect.left + Math.random() * rect.width * 0.6 + rect.width * 0.2 : e.clientX
    const y = rect ? rect.top + Math.random() * rect.height * 0.4 + rect.height * 0.2 : e.clientY

    const id = floatIdCounter++
    setFloats(prev => [...prev, { id, x, y, text: `+${formatBits(earned)}` }])
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 1000)
  }, [click])

  const canPrestige = totalBitsEarned >= PRESTIGE_UNLOCK_BITS

  return (
    <div className="flex flex-col items-center gap-8 py-8 w-full max-w-md px-6">

      {/* Stats row */}
      <div className="w-full grid grid-cols-2 gap-2">
        <div className="card border-slate-800/40 px-4 py-2.5 text-center">
          <div className="font-mono text-[10px] text-slate-600 uppercase tracking-widest mb-0.5">per click</div>
          <div className="font-mono text-sm font-semibold text-cyan-400">{formatBits(bitsPerClick)}</div>
        </div>
        <div className="card border-slate-800/40 px-4 py-2.5 text-center">
          <div className="font-mono text-[10px] text-slate-600 uppercase tracking-widest mb-0.5">per second</div>
          <div className="font-mono text-sm font-semibold text-cyan-400">{formatRate(bitsPerSecond)}</div>
        </div>
        {ghostCredits > 0 && (
          <div className="card border-purple-900/30 px-4 py-2.5 text-center col-span-2">
            <div className="font-mono text-[10px] text-slate-600 uppercase tracking-widest mb-0.5">ghost credits</div>
            <div className="font-mono text-sm font-semibold neon-purple">{Math.floor(ghostCredits)}</div>
          </div>
        )}
      </div>

      {/* Main click button */}
      <div className="relative flex items-center justify-center">
        <button
          ref={btnRef}
          onClick={handleClick}
          className={`
            click-btn relative w-52 h-52 md:w-64 md:h-64 rounded-full
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

      {/* Active event indicator */}
      {eventActive && (
        <div className="w-full flex items-center justify-between px-3 py-2 rounded border border-green-700/40 bg-green-900/10 font-mono text-xs">
          <span className="text-green-400">
            {eventBpsMultiplier > 1 ? `⚡ ${eventBpsMultiplier}× BPS aktiv` : `⚡ ${eventClickMultiplier}× Click aktiv`}
          </span>
          <span className="text-green-600">{eventSecondsLeft}s</span>
        </div>
      )}

      {/* Prestige */}
      {canPrestige && (
        <button
          onClick={onPrestigeClick}
          className="
            w-full font-mono text-xs px-4 py-3 rounded
            border border-purple-600/50 text-purple-300
            bg-purple-900/10
            hover:bg-purple-900/25 hover:border-purple-500/70
            transition-all duration-150
            animate-pulse
          "
        >
          &gt; go_dark.sh — prestige verfügbar
        </button>
      )}
    </div>
  )
}
