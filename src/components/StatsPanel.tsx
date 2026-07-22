import { useGameStore } from '../game/store'
import {
  formatBits,
  formatNumber,
  calcGlobalMultiplier,
  calcDefenseRating,
  defenseTier,
  dailyStreakStatus,
} from '../game/utils'
import { ACHIEVEMENTS } from '../game/achievements'

function formatPlaytime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

interface Row { label: string; value: string; accent?: string }

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div>
      <div className="font-mono text-[10px] text-slate-600 uppercase tracking-widest px-1 mb-1.5">{title}</div>
      <div className="card border-slate-800/40 divide-y divide-slate-800/40">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between px-3 py-1.5">
            <span className="font-mono text-[11px] text-slate-500">{r.label}</span>
            <span
              className="font-mono text-[11px] font-semibold tabular-nums"
              style={{ color: r.accent ?? '#cbd5e1' }}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function StatsPanel() {
  const state = useGameStore(s => s)

  const globalMult = calcGlobalMultiplier(state)
  const defense = calcDefenseRating(state)
  const modulesPlaced = Object.keys(state.chipCells ?? {}).length
  const achPct = state.unlockedAchievements.length / ACHIEVEMENTS.length
  const streak = dailyStreakStatus(state).effective

  // Headline tiles — the numbers worth showing off first.
  const tiles: { label: string; value: string; sub?: string; color: string }[] = [
    { label: 'Spielzeit', value: formatPlaytime(state.totalPlaytimeSeconds), color: '#67e8f9' },
    { label: 'Prestiges', value: formatNumber(state.prestigeCount), color: '#a78bfa' },
    { label: 'Ascensions', value: formatNumber(state.ascensionCount ?? 0), color: '#34d399' },
    { label: 'Global-Mult', value: `×${globalMult >= 100 ? globalMult.toExponential(1) : globalMult.toFixed(2)}`, color: '#22d3ee' },
  ]

  const progression: Row[] = [
    { label: 'Prestiges', value: formatNumber(state.prestigeCount), accent: '#a78bfa' },
    { label: 'Ascensions', value: formatNumber(state.ascensionCount ?? 0), accent: '#34d399' },
    { label: 'Ghost Credits gesamt', value: formatNumber(Math.floor(state.totalGhostCreditsEarned)) },
    { label: 'Root Keys gesamt', value: formatNumber(state.totalRootKeysEarned ?? 0), accent: (state.totalRootKeysEarned ?? 0) > 0 ? '#34d399' : undefined },
    { label: 'Globaler Multiplikator', value: `×${globalMult >= 100 ? globalMult.toExponential(2) : globalMult.toFixed(2)}`, accent: '#22d3ee' },
  ]

  const economy: Row[] = [
    { label: 'Bits (dieser Run)', value: formatBits(state.totalBitsEarned) },
    { label: 'Producer gekauft', value: formatNumber(state.totalProducersBought) },
    { label: 'Upgrades gekauft', value: formatNumber(state.totalUpgradesBought) },
    { label: 'Aufträge erledigt', value: formatNumber(state.contractsCompleted) },
  ]

  const chip: Row[] = [
    { label: 'Defense-Rating', value: defense > 0 ? `${defense.toLocaleString('de-DE')} · ${defenseTier(defense)}` : '—', accent: defense > 0 ? '#f87171' : undefined },
    { label: 'Module platziert', value: modulesPlaced > 0 ? `${modulesPlaced}/36` : '—' },
  ]

  const action: Row[] = [
    { label: 'Klicks', value: formatNumber(state.totalClicks) },
    { label: 'Beste Combo', value: state.maxCombo > 0 ? `×${state.maxCombo}` : '—' },
    { label: 'Events geclaimt', value: formatNumber(state.totalEventsClaimed) },
    { label: 'Packets gefangen', value: formatNumber(state.packetsCaught) },
    { label: 'Entscheidungen', value: formatNumber(state.decisionsMade) },
    { label: 'Wetten gewonnen', value: formatNumber(state.gamblesWon) },
  ]

  const social: Row[] = [
    { label: 'Daily Streak', value: streak > 0 ? `🔥 ${streak} Tage` : '—', accent: streak > 0 ? '#fbbf24' : undefined },
    { label: 'Titel verdient', value: formatNumber(state.earnedTitles.length) },
    { label: 'Artefakte', value: formatNumber(state.earnedArtifacts.length) },
  ]

  return (
    <div className="p-2 space-y-3">
      <div className="font-mono text-xs text-slate-600 uppercase tracking-widest px-1">
        &gt; dossier
      </div>

      {/* Headline tiles */}
      <div className="grid grid-cols-2 gap-1.5">
        {tiles.map(t => (
          <div key={t.label} className="card bg-[#0a0a10] border-slate-800/50 px-3 py-2.5">
            <div className="font-mono text-[9px] text-slate-600 uppercase tracking-widest">{t.label}</div>
            <div className="font-mono text-lg font-bold tabular-nums leading-tight mt-0.5" style={{ color: t.color }}>
              {t.value}
            </div>
          </div>
        ))}
      </div>

      {/* Achievements progress */}
      <div className="card bg-[#0a0a10] border-slate-800/50 p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono text-[10px] text-slate-600 uppercase tracking-widest">Achievements</span>
          <span className="font-mono text-[11px] font-semibold text-amber-300 tabular-nums">
            {state.unlockedAchievements.length}/{ACHIEVEMENTS.length}
          </span>
        </div>
        <div className="h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
          <div className="h-full bg-amber-500/70 transition-all duration-500" style={{ width: `${achPct * 100}%` }} />
        </div>
      </div>

      <Section title="Fortschritt" rows={progression} />
      <Section title="Wirtschaft" rows={economy} />
      <Section title="Basis · Chip" rows={chip} />
      <Section title="Kampf & Aktion" rows={action} />
      <Section title="Sozial" rows={social} />
    </div>
  )
}
