import { useEffect } from 'react'
import { useGameStore } from '../game/store'
import { contractProgress, isContractComplete, templateFor } from '../game/contracts'
import { formatBits } from '../game/utils'
import { playSound } from '../game/sound'
import { emitToast } from '../game/toastBus'

export function ContractsPanel() {
  const activeContracts = useGameStore(s => s.activeContracts)
  const ensureContracts = useGameStore(s => s.ensureContracts)
  const claimContract = useGameStore(s => s.claimContract)
  const state = useGameStore(s => s)

  // Keep the slots filled — re-runs whenever the list empties (reset, sync-import, etc.),
  // not just on mount, so the player can never end up stuck with no contracts.
  useEffect(() => {
    ensureContracts()
  }, [ensureContracts, activeContracts.length])

  const handleClaim = (id: string) => {
    const claimed = claimContract(id)
    if (!claimed) return
    playSound('upgrade')
    emitToast({
      kind: 'info',
      icon: '📋',
      title: 'Auftrag abgeschlossen',
      text: `+${formatBits(claimed.reward)}${claimed.rewardGc > 0 ? ` · +${claimed.rewardGc} gc` : ''}`,
    })
  }

  if (activeContracts.length === 0) return null

  return (
    <div className="relative w-full">
      <span className="corner-bracket tl" /><span className="corner-bracket tr" />
      <span className="corner-bracket bl" /><span className="corner-bracket br" />
      <div className="border border-slate-800/40 rounded-md bg-[#08080f]/60 p-3">
        <div className="font-mono text-[9px] text-slate-600 uppercase tracking-widest mb-2">
          ▤ Aufträge
        </div>
        <div className="space-y-2">
          {activeContracts.map(c => {
            const tpl = templateFor(c.type)
            const progress = contractProgress(c, state)
            const complete = isContractComplete(c, state)
            const pct = Math.min(1, progress / c.target)
            return (
              <div key={c.id} className="flex items-center gap-2.5">
                <span className={`text-base shrink-0 ${complete ? '' : 'opacity-60'}`}>{tpl.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`font-mono text-[11px] truncate ${complete ? 'text-green-300' : 'text-slate-400'}`}>
                      {tpl.label(c.target)}
                    </span>
                    <span className="font-mono text-[10px] text-slate-600 shrink-0">
                      {complete ? '✓' : `${Math.floor(pct * 100)}%`}
                    </span>
                  </div>
                  <div className="mt-1 h-[3px] bg-slate-800/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${complete ? 'bg-green-500/70' : 'bg-cyan-600/50'}`}
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                </div>
                {complete ? (
                  <button
                    onClick={() => handleClaim(c.id)}
                    className="shrink-0 font-mono text-[10px] px-2.5 py-1.5 rounded border border-green-600/60 text-green-400 bg-green-900/15 hover:bg-green-900/30 transition-all animate-pulse"
                  >
                    CLAIM
                  </button>
                ) : (
                  <span className="shrink-0 font-mono text-[10px] text-cyan-600/80 text-right leading-tight">
                    {formatBits(c.reward)}
                    {c.rewardGc > 0 && <><br /><span className="text-purple-500">+{c.rewardGc} gc</span></>}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
