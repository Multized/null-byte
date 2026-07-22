import { useGameStore } from '../game/store'
import { dailyStreakInfo, formatBits } from '../game/utils'
import { saveGame } from '../game/save'
import { playSound } from '../game/sound'

interface Props {
  onClose: () => void
}

/**
 * Active daily check-in. Replaces the old silent auto-claim: the player confirms the
 * login, sees their flame and the reward, and — importantly — claiming saves immediately
 * so the streak can't be lost on an early close or double-counted on a reload.
 */
export function DailyModal({ onClose }: Props) {
  const state = useGameStore(s => s)
  const claimDaily = useGameStore(s => s.claimDaily)
  const info = dailyStreakInfo(state)

  const handleClaim = () => {
    claimDaily()
    saveGame() // persist immediately so the streak can't be lost on an early close
    playSound('event')
    onClose()
  }

  const days = info.willBe
  const capped = Math.min(days, 7)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm card border-amber-800/40 p-5 space-y-4 slide-in text-center">
        <div className="font-mono text-[10px] text-amber-500/80 uppercase tracking-widest">
          &gt; daily_login.sh
        </div>

        {/* Flame + streak */}
        <div className="flex flex-col items-center gap-1">
          <div className="text-5xl leading-none" style={{ filter: 'drop-shadow(0 0 12px rgba(251,146,60,0.5))' }}>🔥</div>
          <div className="font-mono text-3xl font-bold text-amber-300">Tag {days}</div>
          {info.wasBroken ? (
            <div className="font-mono text-[11px] text-red-400/80">
              Streak unterbrochen — du fängst neu an. Bleib dran!
            </div>
          ) : days > 1 ? (
            <div className="font-mono text-[11px] text-slate-500">
              {days - 1} → {days} Tage in Folge. Weiter so.
            </div>
          ) : (
            <div className="font-mono text-[11px] text-slate-500">Willkommen. Deine Streak beginnt.</div>
          )}
        </div>

        {/* Streak pips (first 7 days, where the reward scales) */}
        <div className="flex items-center justify-center gap-1.5">
          {Array.from({ length: 7 }, (_, i) => (
            <span
              key={i}
              className="text-sm transition-all"
              style={{
                opacity: i < capped ? 1 : 0.25,
                filter: i < capped ? 'none' : 'grayscale(1)',
              }}
            >
              🔥
            </span>
          ))}
        </div>

        {/* Reward */}
        <div className="card bg-[#0a0a10] border-amber-900/30 p-3">
          <div className="font-mono text-[10px] text-slate-600 uppercase tracking-widest mb-1">Login-Bonus</div>
          <div className="font-mono text-xl font-semibold text-amber-300">+{formatBits(info.reward)}</div>
          <div className="font-mono text-[10px] text-slate-600 mt-1">
            {days < 7 ? `Wächst bis Tag 7 (×${capped} von 7)` : 'Maximaler Streak-Bonus (×7)'}
          </div>
        </div>

        <button
          onClick={handleClaim}
          className="w-full font-mono text-sm py-2.5 rounded border border-amber-600 text-amber-200 bg-amber-900/20 hover:bg-amber-900/40 hover:border-amber-400 transition-all font-semibold"
        >
          Einloggen · Bonus abholen
        </button>
        <div className="font-mono text-[9px] text-slate-700">
          Ein Tag verpasst und die Flamme erlischt — dann geht es wieder bei Tag 1 los.
        </div>
      </div>
    </div>
  )
}
