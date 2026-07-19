import { useState } from 'react'
import { useGameStore } from '../game/store'
import { formatBits, isUpgradeUnlocked } from '../game/utils'
import { UPGRADES } from '../game/constants'
import { playSound } from '../game/sound'

export function UpgradePanel() {
  const bits = useGameStore(s => s.bits)
  const purchasedUpgrades = useGameStore(s => s.purchasedUpgrades)
  const buyUpgrade = useGameStore(s => s.buyUpgrade)
  const state = useGameStore(s => s)
  const [poppingId, setPoppingId] = useState<string | null>(null)

  const available = UPGRADES.filter(u =>
    !purchasedUpgrades.includes(u.id) && isUpgradeUnlocked(u.id, state)
  )

  const handleBuy = (id: string) => {
    if (!buyUpgrade(id)) return
    playSound('upgrade')
    setPoppingId(id)
    setTimeout(() => setPoppingId(cur => (cur === id ? null : cur)), 250)
  }

  const handleBuyAll = () => {
    let bought = false
    for (const u of [...available].sort((a, b) => a.cost - b.cost)) {
      if (buyUpgrade(u.id)) bought = true
    }
    if (bought) playSound('upgrade')
  }

  const affordableCount = available.filter(u => bits >= u.cost).length

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
      <div className="flex items-center justify-between px-1 mb-1">
        <div className="font-mono text-xs text-slate-600 uppercase tracking-widest">
          &gt; upgrades
        </div>
        {affordableCount > 1 && (
          <button
            onClick={handleBuyAll}
            className="font-mono text-[10px] px-2 py-1 rounded border border-cyan-700/40 text-cyan-400 hover:bg-cyan-900/20 transition-all"
          >
            alle kaufen ({affordableCount})
          </button>
        )}
      </div>
      {available.map(u => {
        const canAfford = bits >= u.cost
        return (
          <button
            key={u.id}
            onClick={() => handleBuy(u.id)}
            disabled={!canAfford}
            className={`
              w-full text-left rounded p-2.5 border transition-all duration-150 slide-in
              ${canAfford
                ? 'border-cyan-800/40 bg-cyan-950/10 hover:border-cyan-500/50 hover:bg-cyan-950/20 cursor-pointer'
                : 'border-slate-800/40 bg-[#080810] opacity-40 cursor-not-allowed'
              }
              ${poppingId === u.id ? 'buy-pop' : ''}
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
