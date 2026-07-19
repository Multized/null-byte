import { useState } from 'react'
import { useGameStore } from '../game/store'
import {
  questById,
  stepProgress,
  isStepComplete,
  titleById,
  artifactById,
  QUESTS,
} from '../game/quests'
import { formatBits } from '../game/utils'
import { playSound } from '../game/sound'
import { emitToast } from '../game/toastBus'

export function QuestPanel() {
  const activeQuestId = useGameStore(s => s.activeQuestId)
  const questStepIndex = useGameStore(s => s.questStepIndex)
  const questStepBaseline = useGameStore(s => s.questStepBaseline)
  const completedQuests = useGameStore(s => s.completedQuests)
  const claimQuest = useGameStore(s => s.claimQuest)
  const state = useGameStore(s => s)
  const [open, setOpen] = useState(false)

  const quest = activeQuestId ? questById(activeQuestId) : undefined

  // All quests done — show a quiet completion badge instead of a banner
  if (!quest) {
    if (completedQuests.length >= QUESTS.length && QUESTS.length > 0) {
      return (
        <div className="relative w-full">
          <div className="border border-amber-800/30 rounded-md bg-amber-950/10 px-3 py-2 font-mono text-[10px] text-amber-500/80 text-center tracking-widest uppercase">
            ✦ Alle Operationen abgeschlossen
          </div>
        </div>
      )
    }
    return null
  }

  const step = quest.steps[questStepIndex]
  const progress = stepProgress(step, questStepBaseline, state)
  const stepDone = isStepComplete(step, questStepBaseline, state)
  const onFinalStep = questStepIndex === quest.steps.length - 1
  const claimable = onFinalStep && stepDone
  const pct = Math.min(1, progress / step.target)

  const handleClaim = () => {
    const result = claimQuest()
    if (!result) return
    playSound('achievement')
    const q = questById(result.questId)
    const parts: string[] = []
    if (result.title) parts.push(`Titel: ${titleById(result.title)?.label ?? result.title}`)
    if (result.artifact) parts.push(`Artefakt: ${artifactById(result.artifact)?.name ?? result.artifact}`)
    emitToast({
      kind: 'info',
      icon: '✦',
      title: `Operation ${q?.codename ?? ''} abgeschlossen`,
      text: parts.join(' · ') || 'Belohnung erhalten',
    })
    setOpen(false)
  }

  return (
    <>
      <div className="relative w-full">
        <span className="corner-bracket tl" /><span className="corner-bracket tr" />
        <span className="corner-bracket bl" /><span className="corner-bracket br" />
        <button
          onClick={() => setOpen(true)}
          className="w-full text-left border border-purple-800/40 rounded-md bg-purple-950/10 hover:bg-purple-950/20 hover:border-purple-600/50 transition-all p-3"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="font-mono text-[9px] text-purple-400/70 uppercase tracking-widest">
              ▸ Operation {quest.codename}
            </div>
            <div className="font-mono text-[9px] text-slate-600">
              Schritt {questStepIndex + 1}/{quest.steps.length}
            </div>
          </div>
          <div className="font-mono text-[11px] text-slate-300 mb-1.5">{quest.name}</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[10px] text-slate-500 truncate mb-1">{step.objective}</div>
              <div className="h-[3px] bg-slate-800/60 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${stepDone ? 'bg-green-500/70' : 'bg-purple-500/60'}`}
                  style={{ width: `${pct * 100}%` }}
                />
              </div>
            </div>
            {claimable ? (
              <span className="shrink-0 font-mono text-[10px] px-2 py-1 rounded border border-green-600/60 text-green-400 bg-green-900/15 animate-pulse">
                ABSCHLIESSEN
              </span>
            ) : (
              <span className="shrink-0 font-mono text-[10px] text-slate-600">{Math.floor(pct * 100)}%</span>
            )}
          </div>
        </button>
      </div>

      {open && (
        <QuestModal
          questId={quest.id}
          stepIndex={questStepIndex}
          baseline={questStepBaseline}
          claimable={claimable}
          onClaim={handleClaim}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

interface ModalProps {
  questId: string
  stepIndex: number
  baseline: number
  claimable: boolean
  onClaim: () => void
  onClose: () => void
}

function QuestModal({ questId, stepIndex, baseline, claimable, onClaim, onClose }: ModalProps) {
  const state = useGameStore(s => s)
  const quest = questById(questId)
  if (!quest) return null

  const title = quest.rewardTitle ? titleById(quest.rewardTitle) : undefined
  const artifact = quest.rewardArtifact ? artifactById(quest.rewardArtifact) : undefined
  const reward = Math.max(100, Math.ceil(state.bitsPerSecond * quest.rewardBitsSeconds))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md card border-purple-800/40 p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        <div>
          <div className="font-mono text-[10px] text-purple-400/70 uppercase tracking-widest">
            &gt; operation_{quest.codename.toLowerCase()}.log
          </div>
          <div className="font-mono text-lg font-semibold neon-purple mt-1">{quest.name}</div>
        </div>

        {/* Intro narrative */}
        <div className="card bg-[#0a0a10] border-purple-900/30 p-3">
          <p className="font-mono text-xs text-slate-400 leading-relaxed italic">{quest.intro}</p>
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {quest.steps.map((s, i) => {
            const done = i < stepIndex || (i === stepIndex && isStepComplete(s, baseline, state))
            const current = i === stepIndex
            const prog = current ? stepProgress(s, baseline, state) : done ? s.target : 0
            const pct = Math.min(1, prog / s.target)
            return (
              <div
                key={i}
                className={`rounded p-2.5 border ${
                  done ? 'border-green-800/40 bg-green-950/10'
                  : current ? 'border-purple-700/40 bg-purple-950/10'
                  : 'border-slate-800/40 bg-[#080810] opacity-60'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`font-mono text-xs shrink-0 mt-0.5 ${done ? 'text-green-500' : current ? 'text-purple-400' : 'text-slate-600'}`}>
                    {done ? '✓' : current ? '▸' : '○'}
                  </span>
                  <div className="min-w-0 flex-1">
                    {(current || done) && (
                      <p className="font-mono text-[11px] text-slate-500 italic mb-1 leading-snug">{s.narrative}</p>
                    )}
                    <div className="font-mono text-xs text-slate-300">{s.objective}</div>
                    {current && !done && (
                      <div className="mt-1.5 h-[3px] bg-slate-800/60 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500/60 transition-all duration-500" style={{ width: `${pct * 100}%` }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Reward preview */}
        <div className="card bg-cyan-950/10 border-cyan-900/30 p-3">
          <div className="font-mono text-[10px] text-cyan-500 uppercase tracking-widest mb-1.5">Belohnung</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-slate-300">
            <span className="text-cyan-400">{formatBits(reward)}</span>
            {quest.rewardGc > 0 && <span className="neon-purple">+{quest.rewardGc} gc</span>}
            {title && <span className="text-amber-300">{title.icon} Titel „{title.label}"</span>}
            {artifact && <span className="text-purple-300">{artifact.icon} {artifact.name}</span>}
          </div>
          {artifact && (
            <div className="font-mono text-[10px] text-slate-500 mt-1.5">{artifact.description}</div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 font-mono text-sm py-2 rounded border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-all"
          >
            Schließen
          </button>
          {claimable && (
            <button
              onClick={onClaim}
              className="flex-1 font-mono text-sm py-2 rounded border border-green-600 text-green-300 bg-green-900/20 hover:bg-green-900/40 hover:border-green-400 transition-all font-semibold"
            >
              Operation abschließen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
