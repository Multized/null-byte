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

  const [floats, setFloats] = useState<FloatText[]>([])
  const [isFlashing, setIsFlashing] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  const handleClick = useCallback((e: React.MouseEvent) => {
    const earned = click()
    setIsFlashing(true)
    setTimeout(() => setIsFlashing(false), 100)

    const rect = btnRef.current?.getBoundingClientRect()
    const x = rect ? rect.left + Math.random() * rect.width * 0.6 + rect.width * 0.2 : e.clientX
    const y = rect ? rect.top + Math.random() * rect.height * 0.4 + rect.height * 0.2 : e.clientY

    const id = floatIdCounter++
    setFloats(prev => [...prev, { id, x, y, text: `+${formatBits(earned)}` }])
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 1000)
  }, [click])

  const canPrestige = totalBitsEarned >= PRESTIGE_UNLOCK_BITS

  return (
    <div className="flex flex-col items-center gap-6 py-6">
      {/* Terminal stats */}
      <div className="w-full max-w-xs font-mono text-xs text-slate-500 space-y-1 px-4">
        <div className="flex justify-between">
          <span>bits/click</span>
          <span className="text-cyan-400">{formatBits(bitsPerClick)}</span>
        </div>
        <div className="flex justify-between">
          <span>bits/sec</span>
          <span className="text-cyan-400">{formatRate(bitsPerSecond)}</span>
        </div>
        {ghostCredits > 0 && (
          <div className="flex justify-between">
            <span>ghost credits</span>
            <span className="neon-purple">{Math.floor(ghostCredits)}</span>
          </div>
        )}
      </div>

      {/* Main click button */}
      <div className="relative">
        <button
          ref={btnRef}
          onClick={handleClick}
          className={`
            click-btn relative w-44 h-44 md:w-52 md:h-52 rounded-full
            border-2 border-cyan-500/60
            bg-[#050a14]
            flex flex-col items-center justify-center gap-2
            cursor-pointer select-none
            transition-transform active:scale-95
            ${isFlashing ? 'bg-cyan-900/20' : ''}
          `}
          style={{
            boxShadow: isFlashing
              ? '0 0 50px rgba(0, 245, 255, 0.5), inset 0 0 30px rgba(0, 245, 255, 0.15)'
              : undefined,
          }}
        >
          {/* Outer ring decoration */}
          <div className="absolute inset-2 rounded-full border border-cyan-900/40" />
          <div className="absolute inset-4 rounded-full border border-cyan-900/20" />

          {/* Icon */}
          <div className="text-4xl md:text-5xl select-none">⌨</div>

          {/* Text */}
          <div className="font-mono text-xs text-cyan-400/80 tracking-widest">
            EXECUTE
          </div>
          <div className="font-mono text-[10px] text-slate-600 tracking-widest">
            run_script.sh
          </div>

          {/* Cursor blink */}
          <div className="font-mono text-xs text-cyan-400 absolute bottom-8">
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

      {/* Prestige button */}
      {canPrestige && (
        <button
          onClick={onPrestigeClick}
          className="
            font-mono text-xs px-4 py-2 rounded
            border border-purple-600/50 text-purple-400
            bg-purple-900/10
            hover:bg-purple-900/30 hover:border-purple-500
            transition-all duration-150
            animate-pulse
          "
        >
          &gt; go_dark.sh —— prestige verfügbar
        </button>
      )}
    </div>
  )
}
