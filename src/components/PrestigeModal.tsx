import { useGameStore } from '../game/store'
import {
  formatBits,
  calcGhostCreditsFromBits,
  calcGlobalMultiplier,
  calcClickMultiplier,
  getStartBits,
  getStartProducers,
  keptUpgradeCount,
  ghostCreditCap,
  prestigeRequirement,
} from '../game/utils'
import { PRESTIGE_UPGRADES } from '../game/constants'
import { playSound } from '../game/sound'
import type { GameState } from '../game/types'

interface Props {
  onClose: () => void
  onOpenGhostShop: () => void
}

export function PrestigeModal({ onClose, onOpenGhostShop }: Props) {
  const state = useGameStore(s => s)
  const prestige = useGameStore(s => s.prestige)

  const willEarn = calcGhostCreditsFromBits(state.totalBitsEarned, state)
  const ghostCreditsAfter = state.ghostCredits + willEarn

  // Ghost Credits are capped per prestige — surface it, otherwise "more bits gave me
  // nothing extra" looks like a bug rather than the intended ceiling.
  const bonusDef = PRESTIGE_UPGRADES.find(u => u.effect === 'ghost_bonus')
  const bonusMult = 1 + (bonusDef?.value ?? 0) * (state.purchasedPrestigeUpgrades[bonusDef?.id ?? ''] ?? 0)
  const cap = Math.floor(ghostCreditCap(state) * bonusMult)
  const atCap = willEarn >= cap

  // Project the state right after prestige to preview what the next run starts with —
  // Ghost Shop upgrades persist, and some of them carry producers/upgrades over too.
  const keptCount = keptUpgradeCount(state)
  const startProducers = getStartProducers(state)
  const projected: GameState = {
    ...state,
    prestigeCount: state.prestigeCount + 1,
    producers: startProducers,
    purchasedUpgrades: [],
  }
  const nextGlobalMult = calcGlobalMultiplier(projected)
  const nextClickMult = calcClickMultiplier(projected)
  const nextStartBits = getStartBits(projected)
  const nextReq = prestigeRequirement(projected)
  const startProducerCount = Object.values(startProducers).reduce((a, b) => a + b, 0)

  const hasCarryOverBonus =
    nextGlobalMult > 1.01 || nextClickMult > 1.01 || nextStartBits > 0 ||
    startProducerCount > 0 || keptCount > 0

  const handlePrestige = () => {
    prestige()
    playSound('prestige')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md card border-purple-800/40 p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div>
          <div className="font-mono text-lg font-semibold neon-purple">
            ⬆ Neustart mit Bonus
          </div>
          <div className="font-mono text-xs text-slate-500 mt-1">
            Dein Fortschritt wird in permanente Währung getauscht — dein nächster Run startet stärker.
          </div>
        </div>

        {/* Hero: Ghost Credits gained */}
        <div className="card bg-[#0a0a10] border-purple-900/30 p-4 text-center">
          <div className="font-mono text-[10px] text-slate-600 uppercase tracking-widest mb-1">
            Du erhältst
          </div>
          <div className="font-mono text-3xl font-bold neon-purple">
            +{willEarn} <span className="text-lg">Ghost Credits</span>
          </div>
          <div className="font-mono text-[10px] text-slate-600 mt-1">
            {Math.floor(state.ghostCredits)} → {Math.floor(ghostCreditsAfter)} gc gesamt
          </div>
          <div className={`font-mono text-[10px] mt-1.5 ${atCap ? 'text-amber-500/80' : 'text-slate-600'}`}>
            {atCap
              ? `Maximum für dieses Prestige erreicht (${cap} gc)`
              : `Maximum für dieses Prestige: ${cap} gc`}
          </div>
        </div>

        {/* Bleibt / Resettet */}
        <div className="grid grid-cols-2 gap-2">
          <div className="card bg-green-950/10 border-green-900/30 p-3">
            <div className="font-mono text-[10px] text-green-500 uppercase tracking-widest mb-1.5">
              ✓ Bleibt erhalten
            </div>
            <ul className="font-mono text-[11px] text-slate-400 space-y-1">
              <li>Ghost Credits</li>
              <li>Ghost-Shop-Boni</li>
              <li>Achievements</li>
              <li>Klicks &amp; Combo-Rekord</li>
            </ul>
          </div>
          <div className="card bg-red-950/10 border-red-900/30 p-3">
            <div className="font-mono text-[10px] text-red-500/80 uppercase tracking-widest mb-1.5">
              ↺ Wird zurückgesetzt
            </div>
            <ul className="font-mono text-[11px] text-slate-400 space-y-1">
              <li>Bits-Stand</li>
              <li>Producer</li>
              <li>Normale Upgrades</li>
            </ul>
          </div>
        </div>

        {/* Next run preview */}
        {hasCarryOverBonus && (
          <div className="card bg-cyan-950/10 border-cyan-900/30 p-3">
            <div className="font-mono text-[10px] text-cyan-500 uppercase tracking-widest mb-1.5">
              Dein nächster Run startet mit
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-slate-300">
              {nextGlobalMult > 1.01 && <span>Globaler Bonus <span className="text-cyan-400">×{nextGlobalMult.toFixed(2)}</span></span>}
              {nextClickMult > 1.01 && <span>Klick-Bonus <span className="text-cyan-400">×{nextClickMult.toFixed(2)}</span></span>}
              {nextStartBits > 0 && <span>Start-Bits <span className="text-cyan-400">{formatBits(nextStartBits)}</span></span>}
              {startProducerCount > 0 && <span>Start-Producer <span className="text-cyan-400">{startProducerCount}</span></span>}
              {keptCount > 0 && <span>Behaltene Upgrades <span className="text-cyan-400">{keptCount}</span></span>}
            </div>
            <div className="font-mono text-[10px] text-slate-600 mt-2">
              Nächstes Prestige ab {formatBits(nextReq)} verdienten Bits
            </div>
          </div>
        )}

        {/* Nudge to spend GC */}
        {Math.floor(ghostCreditsAfter) > 0 && (
          <button
            onClick={onOpenGhostShop}
            className="w-full font-mono text-xs px-3 py-2 rounded border border-purple-800/40 text-purple-300/80 bg-purple-950/10 hover:bg-purple-950/20 hover:border-purple-600/50 transition-all text-left"
          >
            👻 {Math.floor(ghostCreditsAfter)} gc im Ghost Shop ausgeben →
          </button>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 font-mono text-sm py-2 rounded border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-all"
          >
            Abbrechen
          </button>
          <button
            onClick={handlePrestige}
            className="flex-1 font-mono text-sm py-2 rounded border border-purple-600 text-purple-300 bg-purple-900/20 hover:bg-purple-900/40 hover:border-purple-400 transition-all font-semibold"
          >
            Neu starten
          </button>
        </div>
      </div>
    </div>
  )
}
