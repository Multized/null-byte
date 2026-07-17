import { useGameStore } from '../game/store'
import { formatBits, isUpgradeUnlocked } from '../game/utils'
import { UPGRADES } from '../game/constants'

export function UpgradePanel() {
  const bits = useGameStore(s => s.bits)
  const purchasedUpgrades = useGameStore(s => s.purchasedUpgrades)
  const buyUpgrade = useGameStore(s => s.buyUpgrade)
  const state = useGameStore(s => s)

  const available = UPGRADES.filter(u =>
    !purchasedUpgrades.includes(u.id) && isUpgradeUnlocked(u.id, state)
  )

  if (available.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="font-mono text-xs text-slate-600">
          &gt; no_upgrades_available.sh
        </div>
        <div className="font-mono text-xs text-slate-700 mt-1">
          keep hacking...
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 p-2">
      <div className="font-mono text-xs text-slate-600 uppercase tracking-widest px-1 mb-1">
        &gt; upgrades
      </div>
      {available.map(u => {
        const canAfford = bits >= u.cost
        return (
          <button
            key={u.id}
            onClick={() => buyUpgrade(u.id)}
            disabled={!canAfford}
            className={`
              w-full text-left rounded p-2.5 border transition-all duration-150 slide-in
              ${canAfford
                ? 'border-cyan-800/40 bg-cyan-950/10 hover:border-cyan-500/50 hover:bg-cyan-950/20 cursor-pointer'
                : 'border-slate-800/40 bg-[#080810] opacity-40 cursor-not-allowed'
              }
            `}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className={`font-mono text-sm font-medium ${canAfford ? 'text-slate-200' : 'text-slate-500'}`}>
                  {u.name}
                </div>
                <div className={`font-mono text-xs mt-0.5 ${canAfford ? 'text-cyan-400/70' : 'text-slate-600'}`}>
                  {u.description}
                </div>
                <div className="font-mono text-[10px] text-slate-600 mt-0.5 italic">
                  "{u.flavor}"
                </div>
              </div>
              <div className={`font-mono text-sm shrink-0 font-medium ${canAfford ? 'neon-cyan' : 'text-slate-600'}`}>
                {formatBits(u.cost)}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
