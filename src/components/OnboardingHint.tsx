import { useState, useEffect } from 'react'
import { useGameStore } from '../game/store'
import { CHIP_UNLOCK_BITS, PRESTIGE_BASE_REQ, SAVE_KEY } from '../game/constants'

// v2: the hint set was extended to cover Overdrive, contracts and the Chip. Bump the key
// so returning players who finished the old 4-step intro aren't handed the new steps.
const STORAGE_KEY = 'null_byte_onboarding_v2'
const OLD_STORAGE_KEY = 'null_byte_onboarding_step'

interface Hint {
  title: string
  body: string
  trigger: (s: ReturnType<typeof useGameStore.getState>) => boolean
}

// Ordered by when the mechanic becomes relevant — each waits for its trigger, so hints
// appear spread across the first session rather than all at once. The deep systems
// (prestige, ghost shop, ascension) explain themselves in their own modals; the tutorial
// just points the way.
const HINTS: Hint[] = [
  {
    title: '> init_tutorial.sh',
    body: 'Klick den großen Button in der Mitte, um Scripts auszuführen und Bits zu verdienen.',
    trigger: () => true,
  },
  {
    title: '> passive_income.sh',
    body: 'Im SHOP-Tab kaufst du Producer — die schürfen Bits automatisch, auch ohne Klicken.',
    trigger: s => s.totalBitsEarned >= 5,
  },
  {
    title: '> overdrive.sh',
    body: '🔋 Der Overdrive-Balken über den Buttons gibt ×5 Produktion für 15s. Er kostet 1 Energie (10 max) und lädt langsam nach — spar ihn dir für gute Momente auf.',
    trigger: s => s.totalBitsEarned >= 30,
  },
  {
    title: '> upgrades.sh',
    body: 'Der MODS-Tab bekommt ein Badge, sobald Upgrades bereit sind. Die vervielfachen deinen Output — kauf sie früh.',
    trigger: s => Object.values(s.producers).some(v => v > 0),
  },
  {
    title: '> contracts.sh',
    body: 'Unten im RUN-Tab laufen Aufträge & Operationen. Erfüll sie nebenbei für Bonus-Bits, Titel und Artefakte.',
    trigger: s => s.totalBitsEarned >= 500,
  },
  {
    title: '> sync_code.sh',
    body: 'Im AGENT-Tab findest du deinen Sync-Code — damit lädst du deinen Spielstand auf jedem Gerät.',
    trigger: s => s.totalBitsEarned >= 2_000,
  },
  {
    title: '> chip_online.sh',
    body: '🔲 Der CHIP-Tab ist frei! Bau einen Prozessor aus Modulen (Core, Cache, ALU …) für permanente Boni — er überlebt jedes Prestige.',
    trigger: s => s.totalBitsEarned >= CHIP_UNLOCK_BITS,
  },
  {
    title: '> prestige.sh',
    body: 'Bald kannst du prestigen (⬆): allen Fortschritt gegen Ghost Credits tauschen und dauerhaft stärker zurückkommen. Der erste große Meilenstein.',
    trigger: s => s.totalBitsEarned >= PRESTIGE_BASE_REQ * 0.3,
  },
]

const TOTAL_STEPS = HINTS.length

/** Decide the starting step for a player with no v2 record yet. */
function initialStep(): number {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved !== null) return parseInt(saved)
  // Finished the old 4-step tutorial → not new.
  if (localStorage.getItem(OLD_STORAGE_KEY) !== null) return TOTAL_STEPS
  // Read the save straight from localStorage — the store isn't loaded yet at this point
  // (App.loadState runs in a mount effect, after this initializer). A player with any
  // progress is not new, so mark them done; a genuinely fresh player starts at 0.
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) {
      const s = JSON.parse(raw)
      const hasProgress =
        (s.prestigeCount ?? 0) > 0 ||
        (s.totalBitsEarned ?? 0) > 100 ||
        Object.keys(s.producers ?? {}).length > 0
      if (hasProgress) return TOTAL_STEPS
    }
  } catch { /* malformed save — treat as fresh */ }
  return 0
}

export function OnboardingHint() {
  const state = useGameStore(s => s)
  const [currentStep, setCurrentStep] = useState<number>(initialStep)
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const done = currentStep >= TOTAL_STEPS

  useEffect(() => {
    if (done || dismissed) return
    const hint = HINTS[currentStep]
    if (hint && hint.trigger(state)) setVisible(true)
  }, [state.totalBitsEarned, state.producers, currentStep, done, dismissed])

  const advance = () => {
    const next = currentStep + 1
    setCurrentStep(next)
    localStorage.setItem(STORAGE_KEY, String(next))
    setVisible(false)
    setDismissed(false)
    // Show the next hint right away if its trigger is already met.
    setTimeout(() => {
      const nextHint = HINTS[next]
      if (nextHint && nextHint.trigger(useGameStore.getState())) setVisible(true)
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
      className="
        fixed bottom-20 left-4 md:bottom-6 md:left-6 z-50
        w-72 card border-cyan-800/40 bg-[#06060c]/95 backdrop-blur-sm p-3.5
        shadow-[0_0_24px_rgba(0,245,255,0.06)]
        slide-in
      "
    >
      <div className="flex items-center justify-between mb-2">
        <div className="font-mono text-xs font-semibold neon-cyan">{hint.title}</div>
        <button
          onClick={skip}
          className="font-mono text-[10px] text-slate-700 hover:text-slate-500 transition-colors"
        >
          skip all
        </button>
      </div>

      <p className="font-mono text-xs text-slate-400 leading-relaxed mb-3">{hint.body}</p>

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
