import { useGameStore } from '../game/store'
import { formatBits, calcGhostCreditsFromBits } from '../game/utils'
import { PRESTIGE_UPGRADES } from '../game/constants'

interface Props {
  onClose: () => void
}

export function PrestigeModal({ onClose }: Props) {
  const totalBitsEarned = useGameStore(s => s.totalBitsEarned)
  const ghostCredits = useGameStore(s => s.ghostCredits)
  const purchasedPrestigeUpgrades = useGameStore(s => s.purchasedPrestigeUpgrades)
  const prestige = useGameStore(s => s.prestige)
  const buyPrestigeUpgrade = useGameStore(s => s.buyPrestigeUpgrade)
  const state = useGameStore(s => s)

  const willEarn = calcGhostCreditsFromBits(totalBitsEarned, state)
  const totalAfter = ghostCredits + willEarn

  const handlePrestige = () => {
    prestige()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md card border-purple-800/40 p-5 space-y-5">
        {/* Header */}
        <div>
          <div className="font-mono text-lg font-semibold neon-purple">
            &gt; go_dark.sh
          </div>
          <div className="font-mono text-xs text-slate-500 mt-1">
            Alles zurücksetzen. Spuren verwischen. Stärker zurückkommen.
          </div>
        </div>

        {/* Stats */}
        <div className="card bg-[#0a0a10] border-purple-900/30 p-3 space-y-2">
          <div className="flex justify-between font-mono text-sm">
            <span className="text-slate-500">Total verdient</span>
            <span className="text-slate-300">{formatBits(totalBitsEarned)}</span>
          </div>
          <div className="flex justify-between font-mono text-sm">
            <span className="text-slate-500">Ghost Credits erhalten</span>
            <span className="neon-purple font-semibold">+{willEarn}</span>
          </div>
          <div className="border-t border-slate-800 pt-2 flex justify-between font-mono text-sm">
            <span className="text-slate-500">Ghost Credits total</span>
            <span className="neon-purple font-semibold">{Math.floor(totalAfter)}</span>
          </div>
        </div>

        {/* Prestige upgrades shop */}
        {PRESTIGE_UPGRADES.length > 0 && (
          <div>
            <div className="font-mono text-xs text-slate-600 uppercase tracking-widest mb-2">
              Ghost Shop
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {PRESTIGE_UPGRADES.map(u => {
                const bought = purchasedPrestigeUpgrades[u.id] ?? 0
                const maxed = bought >= u.maxPurchases
                const canAfford = ghostCredits >= u.cost && !maxed
                return (
                  <button
                    key={u.id}
                    onClick={() => buyPrestigeUpgrade(u.id)}
                    disabled={!canAfford}
                    className={`
                      w-full text-left rounded p-2.5 border transition-all duration-150
                      ${maxed
                        ? 'border-purple-900/20 bg-purple-950/10 opacity-40 cursor-default'
                        : canAfford
                          ? 'border-purple-700/40 bg-purple-950/10 hover:border-purple-500/50 hover:bg-purple-950/20 cursor-pointer'
                          : 'border-slate-800/40 bg-[#080810] opacity-40 cursor-not-allowed'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-slate-200">{u.name}</span>
                          {u.maxPurchases > 1 && (
                            <span className="font-mono text-xs text-slate-600">
                              {bought}/{u.maxPurchases}
                            </span>
                          )}
                          {maxed && (
                            <span className="font-mono text-[10px] text-green-500">MAXED</span>
                          )}
                        </div>
                        <div className="font-mono text-xs text-purple-400/70">{u.description}</div>
                        <div className="font-mono text-[10px] text-slate-600 italic">"{u.flavor}"</div>
                      </div>
                      <div className="font-mono text-sm neon-purple shrink-0">{u.cost} gc</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
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
            &gt; go dark ({willEarn} gc)
          </button>
        </div>
      </div>
    </div>
  )
}
