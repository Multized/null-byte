import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../game/store'
import { dilemmaById, type DilemmaChoice, type DilemmaOutcome } from '../game/dilemmas'
import { formatBits } from '../game/utils'
import { playSound } from '../game/sound'

interface Props {
  dilemmaId: string
  /** ms the player has to decide before it auto-declines. */
  decideMs: number
  onClose: () => void
}

const KIND_STYLE: Record<DilemmaChoice['kind'], string> = {
  safe: 'border-cyan-700/50 text-cyan-300 bg-cyan-950/10 hover:bg-cyan-950/25 hover:border-cyan-500/60',
  gamble: 'border-amber-700/50 text-amber-300 bg-amber-950/10 hover:bg-amber-950/25 hover:border-amber-500/60',
  sacrifice: 'border-purple-700/50 text-purple-300 bg-purple-950/10 hover:bg-purple-950/25 hover:border-purple-500/60',
  decline: 'border-slate-700/60 text-slate-400 hover:border-slate-500 hover:text-slate-200',
}

function outcomeEffectLine(o: DilemmaOutcome): string {
  const parts: string[] = []
  if (o.bits) parts.push(`${o.bits >= 0 ? '+' : '−'}${formatBits(Math.abs(o.bits))}`)
  if (o.ghostCredits) parts.push(`${o.ghostCredits >= 0 ? '+' : '−'}${Math.abs(o.ghostCredits)} gc`)
  if (o.bpsBuff) parts.push(`${o.bpsBuff.mult}× BPS · ${Math.round(o.bpsBuff.durationMs / 1000)}s`)
  if (o.clickBuff) parts.push(`${o.clickBuff.mult}× Click · ${Math.round(o.clickBuff.durationMs / 1000)}s`)
  if (o.penalty) parts.push(`−${Math.round((1 - o.penalty.mult) * 100)}% BPS · ${Math.round(o.penalty.durationMs / 1000)}s`)
  return parts.join(' · ')
}

export function DilemmaModal({ dilemmaId, decideMs, onClose }: Props) {
  const applyDilemmaOutcome = useGameStore(s => s.applyDilemmaOutcome)
  const dilemma = dilemmaById(dilemmaId)
  const state = useGameStore(s => s)

  const [progress, setProgress] = useState(1)
  const [outcome, setOutcome] = useState<DilemmaOutcome | null>(null)
  const startRef = useRef(Date.now())
  const frameRef = useRef<number>(0)
  const resolvedRef = useRef(false)

  useEffect(() => {
    playSound('event')
    const animate = () => {
      if (resolvedRef.current) return
      const p = Math.max(0, 1 - (Date.now() - startRef.current) / decideMs)
      setProgress(p)
      if (p <= 0) {
        resolvedRef.current = true
        onClose() // timeout = auto-decline, no side effects
        return
      }
      frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [decideMs, onClose])

  if (!dilemma) return null

  const handleChoice = (choice: DilemmaChoice) => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    cancelAnimationFrame(frameRef.current)
    const result = choice.resolve(state)
    if (choice.kind !== 'decline') {
      applyDilemmaOutcome(result)
      playSound(result.tone === 'bad' ? 'click' : 'buy')
    }
    setOutcome(result)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget && outcome) onClose() }}
    >
      <div className="w-full max-w-md rounded border border-purple-700/50 bg-[#0a060d]/95 backdrop-blur-sm shadow-[0_0_32px_rgba(168,85,247,0.12)] overflow-hidden">
        {/* Decision countdown */}
        {!outcome && (
          <div className="h-0.5 bg-slate-800">
            <div className="h-full bg-purple-500/60" style={{ width: `${progress * 100}%` }} />
          </div>
        )}

        <div className="p-5 space-y-4">
          <div>
            <div className="font-mono text-[10px] text-purple-400/70 uppercase tracking-widest">
              &gt; incoming_transmission // {dilemma.contact}
            </div>
            {!outcome && (
              <div className="font-mono text-[10px] text-slate-600 mt-0.5">
                {Math.ceil(progress * decideMs / 1000)}s zum Entscheiden
              </div>
            )}
          </div>

          {!outcome ? (
            <>
              {/* Scenario */}
              <p className="font-mono text-xs text-slate-300 leading-relaxed">{dilemma.scenario}</p>

              {/* Choices */}
              <div className="space-y-2">
                {dilemma.choices.map((choice, i) => {
                  const disabled = choice.disabled?.(state) ?? false
                  return (
                    <button
                      key={i}
                      onClick={() => !disabled && handleChoice(choice)}
                      disabled={disabled}
                      className={`
                        w-full text-left rounded p-2.5 border transition-all duration-150 font-mono
                        ${disabled ? 'border-slate-800/40 text-slate-600 opacity-40 cursor-not-allowed' : `${KIND_STYLE[choice.kind]} cursor-pointer`}
                      `}
                    >
                      <div className="text-sm font-medium">{choice.label}</div>
                      <div className="text-[10px] opacity-80 mt-0.5">{disabled ? 'nicht genug Ressourcen' : choice.detail}</div>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              {/* Outcome reveal */}
              <div className={`card p-3 ${
                outcome.tone === 'good' ? 'border-green-800/40 bg-green-950/10'
                : outcome.tone === 'bad' ? 'border-red-800/40 bg-red-950/10'
                : 'border-slate-800/40 bg-[#0a0a10]'
              }`}>
                <p className="font-mono text-xs text-slate-300 leading-relaxed">{outcome.message}</p>
                {outcomeEffectLine(outcome) && (
                  <div className={`font-mono text-sm font-semibold mt-2 ${
                    outcome.tone === 'good' ? 'text-green-400' : outcome.tone === 'bad' ? 'text-red-400' : 'text-slate-400'
                  }`}>
                    {outcomeEffectLine(outcome)}
                  </div>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-full font-mono text-sm py-2 rounded border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-slate-100 transition-all"
              >
                Verbindung kappen
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
