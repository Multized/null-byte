import { useGameStore } from '../game/store'
import { formatBits, calcProducerCost, calcProducerMultiplier } from '../game/utils'
import { PRODUCERS } from '../game/constants'

export function ProducerList() {
  const bits = useGameStore(s => s.bits)
  const producers = useGameStore(s => s.producers)
  const buyProducer = useGameStore(s => s.buyProducer)
  const state = useGameStore(s => s)

  return (
    <div className="flex flex-col gap-1.5 p-2">
      <div className="font-mono text-xs text-slate-600 uppercase tracking-widest px-1 mb-1">
        &gt; producers
      </div>
      {PRODUCERS.map(def => {
        const owned = producers[def.id] ?? 0
        const cost = calcProducerCost(def.id, owned)
        const canAfford = bits >= cost
        const mult = calcProducerMultiplier(def.id, state)
        const bpsEach = def.baseBps * mult
        const bpsTotal = bpsEach * owned
        // affordability progress 0..1 (only show when somewhat close)
        const affordPct = Math.min(bits / cost, 1)
        const showProgress = !canAfford && affordPct > 0.1

        return (
          <button
            key={def.id}
            onClick={() => buyProducer(def.id)}
            disabled={!canAfford}
            className={`
              w-full text-left rounded border transition-all duration-150 overflow-hidden
              ${canAfford
                ? 'border-slate-700/60 bg-[#0a0a12] hover:border-cyan-500/40 hover:bg-[#0d0d18] cursor-pointer'
                : 'border-slate-800/40 bg-[#080810] cursor-not-allowed'
              }
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
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={`font-mono text-sm font-medium ${canAfford ? 'neon-cyan' : 'text-slate-600'}`}>
                  {formatBits(cost)}
                </div>
                {showProgress && (
                  <div className="font-mono text-[10px] text-slate-600">
                    {Math.floor(affordPct * 100)}%
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
