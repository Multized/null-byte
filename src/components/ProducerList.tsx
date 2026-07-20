import { useState } from 'react'
import { useGameStore } from '../game/store'
import {
  formatBits,
  formatDuration,
  calcProducerMultiplier,
  calcBulkProducerCost,
  calcMaxAffordable,
  calcMilestoneMultiplier,
  nextMilestone,
} from '../game/utils'
import { PRODUCERS, MILESTONE_THRESHOLDS } from '../game/constants'
import { playSound } from '../game/sound'
import { emitToast } from '../game/toastBus'

type BuyQty = 1 | 10 | 'max'

export function ProducerList() {
  const bits = useGameStore(s => s.bits)
  const producers = useGameStore(s => s.producers)
  const buyProducer = useGameStore(s => s.buyProducer)
  const state = useGameStore(s => s)
  const [poppingId, setPoppingId] = useState<string | null>(null)
  const [buyQty, setBuyQty] = useState<BuyQty>(1)

  const handleBuy = (id: string) => {
    const qty = buyQty === 'max' ? Infinity : buyQty
    const result = buyProducer(id, qty)
    if (result.bought <= 0) return
    playSound('buy')
    setPoppingId(id)
    setTimeout(() => setPoppingId(cur => (cur === id ? null : cur)), 250)
    if (result.milestoneReached !== null) {
      const def = PRODUCERS.find(p => p.id === id)
      if (def) {
        emitToast({
          kind: 'milestone',
          producerName: def.name,
          producerIcon: def.icon,
          threshold: result.milestoneReached,
        })
      }
    }
  }

  return (
    <div className="flex flex-col gap-1.5 p-2">
      <div className="flex items-center justify-between px-1 mb-1">
        <div className="font-mono text-xs text-slate-600 uppercase tracking-widest">
          &gt; producers
        </div>
        <div className="flex rounded border border-slate-700/60 overflow-hidden">
          {(['1', '10', 'max'] as const).map(opt => {
            const val: BuyQty = opt === 'max' ? 'max' : (opt === '1' ? 1 : 10)
            const active = buyQty === val
            return (
              <button
                key={opt}
                onClick={() => setBuyQty(val)}
                className={`
                  font-mono text-[10px] px-2 py-1 tracking-wider transition-colors
                  ${active ? 'bg-cyan-900/40 text-cyan-300' : 'text-slate-600 hover:text-slate-400'}
                `}
              >
                {opt === 'max' ? 'MAX' : `×${opt}`}
              </button>
            )
          })}
        </div>
      </div>
      {PRODUCERS.map(def => {
        const owned = producers[def.id] ?? 0
        const qty = buyQty === 'max' ? calcMaxAffordable(def.id, owned, bits, state) : buyQty
        const effectiveQty = Math.max(1, qty)
        const cost = calcBulkProducerCost(def.id, owned, effectiveQty, state)
        const canAfford = buyQty === 'max' ? qty > 0 : bits >= cost
        const mult = calcProducerMultiplier(def.id, state)
        const bpsEach = def.baseBps * mult
        const bpsTotal = bpsEach * owned
        // affordability progress 0..1 (only show when somewhat close)
        const affordPct = Math.min(bits / cost, 1)
        const showProgress = !canAfford && affordPct > 0.1
        const bps = state.bitsPerSecond
        const etaSeconds = !canAfford && bps > 0 ? (cost - bits) / bps : null

        // Milestone progress
        const next = nextMilestone(def.id, state)
        const prevThreshold = [...MILESTONE_THRESHOLDS].reverse().find(t => owned >= t) ?? 0
        const milestonePct = next
          ? Math.min(1, (owned - prevThreshold) / (next - prevThreshold))
          : 1
        const milestoneTier = MILESTONE_THRESHOLDS.filter(t => owned >= t).length

        return (
          <button
            key={def.id}
            onClick={() => handleBuy(def.id)}
            disabled={!canAfford}
            className={`
              w-full text-left rounded border transition-all duration-150 overflow-hidden
              ${canAfford
                ? 'border-slate-700/60 bg-[#0a0a12] hover:border-cyan-500/40 hover:bg-[#0d0d18] cursor-pointer'
                : 'border-slate-800/40 bg-[#080810] cursor-not-allowed'
              }
              ${milestoneTier > 0 ? 'shadow-[0_0_12px_rgba(0,245,255,0.08)]' : ''}
              ${poppingId === def.id ? 'buy-pop' : ''}
            `}
          >
            {/* Affordability progress bar */}
            {showProgress && (
              <div
                className="h-0.5 bg-cyan-500/30 transition-all duration-500"
                style={{ width: `${affordPct * 100}%` }}
              />
            )}
            {canAfford && (
              <div className="h-0.5 bg-cyan-500/20" />
            )}

            <div className="flex items-center justify-between gap-2 p-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-lg shrink-0 ${!canAfford && owned === 0 ? 'opacity-40' : ''}`}>
                  {def.icon}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-sm font-medium truncate ${canAfford ? 'text-slate-200' : owned > 0 ? 'text-slate-300' : 'text-slate-500'}`}>
                      {def.name}
                    </span>
                    {owned > 0 && (
                      <span className="font-mono text-xs text-cyan-500 shrink-0 bg-cyan-950/40 px-1 rounded">
                        {owned}
                      </span>
                    )}
                    {milestoneTier > 0 && (
                      <span className="font-mono text-[9px] text-purple-400 shrink-0" title={`Meilenstein-Bonus ×${calcMilestoneMultiplier(def.id, state).toFixed(1)}`}>
                        ✦{milestoneTier}
                      </span>
                    )}
                  </div>
                  {/* Rate info — always visible */}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`font-mono text-[10px] ${owned > 0 ? 'text-slate-400' : 'text-slate-600'}`}>
                      {formatBits(bpsEach)}/s each
                    </span>
                    {owned > 0 && (
                      <span className="font-mono text-[10px] text-cyan-500/70">
                        = {formatBits(bpsTotal)}/s
                      </span>
                    )}
                  </div>
                  {/* Milestone progress bar */}
                  {next && owned > 0 && (
                    <div className="mt-1 h-[3px] w-24 bg-slate-800/60 rounded-full overflow-hidden" title={`noch ${next - owned} bis ${next}`}>
                      <div
                        className="h-full bg-purple-500/50 transition-all duration-500"
                        style={{ width: `${milestonePct * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={`font-mono text-sm font-medium ${canAfford ? 'neon-cyan' : 'text-slate-600'}`}>
                  {formatBits(cost)}
                  {buyQty !== 1 && (
                    <span className="text-[10px] text-slate-600 ml-1">
                      ({buyQty === 'max' ? `×${qty}` : `×${buyQty}`})
                    </span>
                  )}
                </div>
                {showProgress && (
                  <div className="font-mono text-[10px] text-slate-600">
                    {Math.floor(affordPct * 100)}%
                    {etaSeconds !== null && etaSeconds < 86_400 && (
                      <span className="text-slate-700"> · ~{formatDuration(etaSeconds)}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
