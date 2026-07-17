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

        return (
          <button
            key={def.id}
            onClick={() => buyProducer(def.id)}
            disabled={!canAfford}
            className={`
              w-full text-left rounded p-2.5 border transition-all duration-150 group
              ${canAfford
                ? 'border-slate-700/60 bg-[#0a0a12] hover:border-cyan-500/40 hover:bg-[#0d0d18] cursor-pointer'
                : 'border-slate-800/40 bg-[#080810] opacity-50 cursor-not-allowed'
              }
            `}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg shrink-0">{def.icon}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-sm font-medium truncate ${canAfford ? 'text-slate-200' : 'text-slate-500'}`}>
                      {def.name}
                    </span>
                    {owned > 0 && (
                      <span className="font-mono text-xs text-cyan-500 shrink-0">
                        ×{owned}
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[10px] text-slate-600 truncate">
                    {def.flavor}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={`font-mono text-sm font-medium ${canAfford ? 'neon-cyan' : 'text-slate-600'}`}>
                  {formatBits(cost)}
                </div>
                {owned > 0 && (
                  <div className="font-mono text-[10px] text-slate-500">
                    {formatBits(def.baseBps * mult)}/s each
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
