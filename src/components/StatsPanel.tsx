import { useGameStore } from '../game/store'
import { formatBits, formatNumber, calcGlobalMultiplier } from '../game/utils'
import { ACHIEVEMENTS } from '../game/achievements'

function formatPlaytime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

export function StatsPanel() {
  const state = useGameStore(s => s)

  const rows: { label: string; value: string; accent?: boolean }[] = [
    { label: 'Spielzeit', value: formatPlaytime(state.totalPlaytimeSeconds) },
    { label: 'Bits gesamt', value: formatBits(state.totalBitsEarned) },
    { label: 'Klicks', value: formatNumber(state.totalClicks) },
    { label: 'Beste Combo', value: state.maxCombo > 0 ? `×${state.maxCombo}` : '—' },
    { label: 'Events geclaimt', value: formatNumber(state.totalEventsClaimed) },
    { label: 'Packets gefangen', value: formatNumber(state.packetsCaught) },
    { label: 'Aufträge erledigt', value: formatNumber(state.contractsCompleted) },
    { label: 'Entscheidungen getroffen', value: formatNumber(state.decisionsMade) },
    { label: 'Wetten gewonnen', value: formatNumber(state.gamblesWon) },
    { label: 'Producer gekauft', value: formatNumber(state.totalProducersBought) },
    { label: 'Daily Streak', value: state.dailyStreak > 0 ? `${state.dailyStreak} Tage` : '—' },
    { label: 'Prestiges', value: formatNumber(state.prestigeCount), accent: true },
    { label: 'Ghost Credits gesamt', value: formatNumber(Math.floor(state.totalGhostCreditsEarned)), accent: true },
    { label: 'Globaler Multiplikator', value: `×${calcGlobalMultiplier(state).toFixed(2)}`, accent: true },
    { label: 'Achievements', value: `${state.unlockedAchievements.length}/${ACHIEVEMENTS.length}` },
  ]

  return (
    <div className="p-2">
      <div className="font-mono text-xs text-slate-600 uppercase tracking-widest px-1 mb-2">
        &gt; dossier
      </div>
      <div className="card border-slate-800/40 divide-y divide-slate-800/40">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between px-3 py-1.5">
            <span className="font-mono text-[11px] text-slate-500">{r.label}</span>
            <span className={`font-mono text-[11px] font-semibold ${r.accent ? 'neon-purple' : 'text-slate-300'}`}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
