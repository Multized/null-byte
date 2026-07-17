import { useState, useEffect } from 'react'
import { useGameStore } from '../game/store'

const STORAGE_KEY = 'null_byte_onboarding_step'
const TOTAL_STEPS = 4

interface Hint {
  step: number
  title: string
  body: string
  trigger: (s: ReturnType<typeof useGameStore.getState>) => boolean
}

const HINTS: Hint[] = [
  {
    step: 0,
    title: '> init_tutorial.sh',
    body: 'Klick den Button in der Mitte um Scripts auszuführen und Bits zu verdienen.',
    trigger: () => true,
  },
  {
    step: 1,
    title: '> passive_income.sh',
    body: 'Im SHOP-Tab kannst du Producers kaufen — die schürfen Bits automatisch, auch wenn du nicht klickst.',
    trigger: s => s.totalBitsEarned >= 5,
  },
  {
    step: 2,
    title: '> upgrades_available.sh',
    body: 'Der MODS-Tab zeigt ein Badge sobald Upgrades freigeschaltet sind. Die multiplizieren deinen Output.',
    trigger: s => Object.values(s.producers).some(v => v > 0),
  },
  {
    step: 3,
    title: '> sync_code.sh',
    body: 'Im AGENT-Tab findest du deinen Sync-Code — damit lädst du deinen Save auf jedem Gerät.',
    trigger: s => s.totalBitsEarned >= 50,
  },
]

export function OnboardingHint() {
  const state = useGameStore(s => s)
  const [currentStep, setCurrentStep] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved !== null ? parseInt(saved) : 0
  })
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Done if all steps completed
  const done = currentStep >= TOTAL_STEPS

  useEffect(() => {
    if (done || dismissed) return
    const hint = HINTS[currentStep]
    if (hint && hint.trigger(state)) {
      setVisible(true)
    }
  }, [state.totalBitsEarned, state.producers, currentStep, done, dismissed])

  const advance = () => {
    const next = currentStep + 1
    setCurrentStep(next)
    localStorage.setItem(STORAGE_KEY, String(next))
    setVisible(false)
    setDismissed(false)
    // Show next hint immediately if already triggered
    setTimeout(() => {
      const nextHint = HINTS[next]
      if (nextHint && nextHint.trigger(useGameStore.getState())) {
        setVisible(true)
      }
    }, 600)
  }

  const skip = () => {
    setCurrentStep(TOTAL_STEPS)
    localStorage.setItem(STORAGE_KEY, String(TOTAL_STEPS))
    setVisible(false)
  }

  if (done || !visible) return null

  const hint = HINTS[currentStep]
  if (!hint) return null

  return (
    <div
      className={`
        fixed bottom-20 left-4 md:bottom-6 md:left-6 z-50
        w-72 card border-cyan-800/40 bg-[#06060c]/95 backdrop-blur-sm p-3.5
        shadow-[0_0_24px_rgba(0,245,255,0.06)]
        slide-in
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="font-mono text-xs font-semibold neon-cyan">{hint.title}</div>
        <button
          onClick={skip}
          className="font-mono text-[10px] text-slate-700 hover:text-slate-500 transition-colors"
        >
          skip all
        </button>
      </div>

      {/* Body */}
      <p className="font-mono text-xs text-slate-400 leading-relaxed mb-3">
        {hint.body}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {HINTS.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i < currentStep ? 'bg-cyan-600' : i === currentStep ? 'bg-cyan-400' : 'bg-slate-700'
              }`}
            />
          ))}
        </div>
        <button
          onClick={advance}
          className="font-mono text-xs px-3 py-1 rounded border border-cyan-700/40 text-cyan-400 hover:bg-cyan-900/20 transition-all"
        >
          {currentStep === TOTAL_STEPS - 1 ? 'fertig ✓' : 'got it →'}
        </button>
      </div>
    </div>
  )
}
