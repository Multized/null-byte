import { useState } from 'react'
import { useGameStore } from '../game/store'
import { formatBits, formatRate, dailyStreakInfo } from '../game/utils'
import { isSfxMuted, toggleSfx, isMusicOn, toggleMusic } from '../game/sound'
import { useTweenedNumber } from '../hooks/useTweenedNumber'

export function ResourceDisplay() {
  const bits = useGameStore(s => s.bits)
  const totalBitsEarned = useGameStore(s => s.totalBitsEarned)
  const bitsPerSecond = useGameStore(s => s.bitsPerSecond)
  const ghostCredits = useGameStore(s => s.ghostCredits)
  const prestigeCount = useGameStore(s => s.prestigeCount)
  const state = useGameStore(s => s)
  const [sfxMuted, setSfxMutedState] = useState(isSfxMuted())
  const [musicOn, setMusicOnState] = useState(isMusicOn())
  const displayBits = useTweenedNumber(bits)
  const streak = dailyStreakInfo(state).effective

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
          {streak > 0 && (
            <span
              className="font-mono text-xs text-amber-300 flex items-center gap-0.5"
              title={`Daily Streak: ${streak} Tage in Folge`}
            >
              <span style={{ filter: 'drop-shadow(0 0 4px rgba(251,146,60,0.6))' }}>🔥</span>{streak}
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

        {/* Audio toggles: effects + music */}
        <div className="shrink-0 flex items-center gap-1">
          <button
            onClick={() => setSfxMutedState(toggleSfx())}
            title={sfxMuted ? 'Effektsounds an' : 'Effektsounds aus'}
            className={`font-mono text-sm transition-colors px-1 ${sfxMuted ? 'text-slate-700 hover:text-slate-500' : 'text-cyan-400/80 hover:text-cyan-400'}`}
          >
            {sfxMuted ? '🔇' : '🔊'}
          </button>
          <button
            onClick={() => setMusicOnState(toggleMusic())}
            title={musicOn ? 'Musik aus' : 'Musik an'}
            className={`text-sm transition-opacity px-1 ${musicOn ? 'opacity-100' : 'opacity-30 grayscale hover:opacity-50'}`}
          >
            🎵
          </button>
        </div>
      </div>
    </header>
  )
}
