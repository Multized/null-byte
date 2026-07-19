import { useState } from 'react'
import { useGameStore } from '../game/store'
import { formatBits, formatRate } from '../game/utils'
import { isMuted, toggleMuted } from '../game/sound'
import { useTweenedNumber } from '../hooks/useTweenedNumber'

export function ResourceDisplay() {
  const bits = useGameStore(s => s.bits)
  const totalBitsEarned = useGameStore(s => s.totalBitsEarned)
  const bitsPerSecond = useGameStore(s => s.bitsPerSecond)
  const ghostCredits = useGameStore(s => s.ghostCredits)
  const prestigeCount = useGameStore(s => s.prestigeCount)
  const [muted, setMutedState] = useState(isMuted())
  const displayBits = useTweenedNumber(bits)

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#050508]/90 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-3 py-2 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono font-semibold text-sm neon-cyan tracking-widest">
            NULL/BYTE
          </span>
          {prestigeCount > 0 && (
            <span className="font-mono text-xs bg-purple-900/40 border border-purple-700/50 text-purple-300 px-1.5 py-0.5 rounded">
              v{prestigeCount}
            </span>
          )}
        </div>

        {/* Main Resource */}
        <div className="flex-1 text-center">
          <div className="font-mono font-semibold text-lg md:text-2xl neon-cyan leading-none">
            {formatBits(displayBits)}
          </div>
          <div className="font-mono text-xs text-slate-500 mt-0.5">
            {formatRate(bitsPerSecond)}
          </div>
        </div>

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-4 shrink-0 text-right">
          <div>
            <div className="font-mono text-xs text-slate-500">Total</div>
            <div className="font-mono text-sm text-slate-300">{formatBits(totalBitsEarned)}</div>
          </div>
          {ghostCredits > 0 && (
            <div>
              <div className="font-mono text-xs text-slate-500">Ghost</div>
              <div className="font-mono text-sm neon-purple">{Math.floor(ghostCredits)}</div>
            </div>
          )}
        </div>

        {/* Mute toggle */}
        <button
          onClick={() => setMutedState(toggleMuted())}
          title={muted ? 'Sound an' : 'Sound aus'}
          className="shrink-0 font-mono text-sm text-slate-600 hover:text-cyan-400 transition-colors px-1"
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </header>
  )
}
