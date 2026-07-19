import { formatBits, getOfflineCapHours, calcOfflineEfficiency } from '../game/utils'
import type { OfflineResult } from '../game/save'
import type { GameState } from '../game/types'

interface Props {
  result: OfflineResult
  state: GameState
  onClose: () => void
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

export function OfflineModal({ result, state, onClose }: Props) {
  const capHours = getOfflineCapHours(state)
  const wasCapped = result.seconds >= result.cappedAt - 1
  const efficiencyPct = Math.round(calcOfflineEfficiency(state) * 100)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm card border-cyan-800/30 p-5 space-y-4 slide-in">
        <div>
          <div className="font-mono text-base font-semibold neon-cyan">
            &gt; welcome_back.sh
          </div>
          <div className="font-mono text-xs text-slate-500 mt-1">
            Deine Scripts haben fleißig gearbeitet.
          </div>
        </div>

        <div className="card bg-[#0a0a10] border-cyan-900/20 p-3 space-y-2">
          <div className="flex justify-between font-mono text-sm">
            <span className="text-slate-500">Offline für</span>
            <span className="text-slate-300">{formatDuration(result.seconds)}</span>
          </div>
          {wasCapped && (
            <div className="font-mono text-[10px] text-yellow-600/70">
              ⚠ Cap bei {capHours}h erreicht — upgrade für mehr
            </div>
          )}
          <div className="border-t border-slate-800 pt-2 flex justify-between font-mono text-sm">
            <span className="text-slate-500">Verdient ({efficiencyPct}% eff.)</span>
            <span className="neon-cyan font-semibold">+{formatBits(result.earnings)}</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full font-mono text-sm py-2 rounded border border-cyan-700/50 text-cyan-400 bg-cyan-900/10 hover:bg-cyan-900/20 hover:border-cyan-500 transition-all"
        >
          &gt; continue
        </button>
      </div>
    </div>
  )
}
