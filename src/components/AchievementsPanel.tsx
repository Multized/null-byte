import { useGameStore } from '../game/store'
import { ACHIEVEMENTS } from '../game/achievements'

export function AchievementsPanel() {
  const unlockedAchievements = useGameStore(s => s.unlockedAchievements)
  const unlockedSet = new Set(unlockedAchievements)
  const unlockedCount = unlockedAchievements.length
  const total = ACHIEVEMENTS.length

  return (
    <div className="flex flex-col gap-1.5 p-2">
      <div className="flex items-center justify-between px-1 mb-1">
        <div className="font-mono text-xs text-slate-600 uppercase tracking-widest">
          &gt; achievements
        </div>
        <div className="font-mono text-[10px] text-amber-500/80">
          {unlockedCount}/{total}
        </div>
      </div>

      {ACHIEVEMENTS.map(a => {
        const unlocked = unlockedSet.has(a.id)
        return (
          <div
            key={a.id}
            className={`
              w-full rounded p-2.5 border transition-all duration-150
              ${unlocked
                ? 'border-amber-700/40 bg-amber-950/10'
                : 'border-slate-800/40 bg-[#080810]'
              }
            `}
          >
            <div className="flex items-start gap-2.5">
              <span className={`text-lg shrink-0 ${unlocked ? '' : 'opacity-20 grayscale'}`}>
                {unlocked ? a.icon : '🔒'}
              </span>
              <div className="min-w-0">
                <div className={`font-mono text-sm font-medium ${unlocked ? 'text-amber-300' : 'text-slate-600'}`}>
                  {unlocked ? a.name : '???'}
                </div>
                <div className={`font-mono text-xs mt-0.5 ${unlocked ? 'text-amber-500/70' : 'text-slate-700'}`}>
                  {unlocked ? a.description : 'noch nicht freigeschaltet'}
                </div>
                {unlocked && (
                  <div className="font-mono text-[10px] text-slate-600 mt-0.5 italic">
                    "{a.flavor}"
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
