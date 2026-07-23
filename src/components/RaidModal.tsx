import { useState, useEffect, useCallback } from 'react'
import { useGameStore } from '../game/store'
import { fetchRaidTarget, resolveRaid } from '../game/supabase'
import { formatBits, chipNeighbours, raidEnergyInfo } from '../game/utils'
import {
  type RaidTarget,
  cellResistance,
  isEdgeCell,
  raidGoalCell,
  raidBudget,
  raidLoot,
  minBreachResistance,
  validateBreachPath,
  pathTrapChance,
} from '../game/raid'
import { CHIP_SIZE, RAID_ENERGY_MAX } from '../game/constants'
import { playSound } from '../game/sound'

interface Props { onClose: () => void }

const N = CHIP_SIZE * CHIP_SIZE
const ACCENT: Record<string, string> = { cyan: '#22d3ee', emerald: '#34d399', amber: '#fbbf24', purple: '#a78bfa', red: '#f87171' }

type Phase = 'loading' | 'ready' | 'result' | 'none' | 'noenergy'

function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

export function RaidModal({ onClose }: Props) {
  const state = useGameStore(s => s)
  const playerId = state.playerId
  const recordRaid = state.recordRaid

  const energy = raidEnergyInfo(state)
  const [phase, setPhase] = useState<Phase>(energy.energy < 1 ? 'noenergy' : 'loading')
  const [target, setTarget] = useState<RaidTarget | null>(null)
  const [path, setPath] = useState<number[]>([])
  const [result, setResult] = useState<{ won: boolean; loot: number; trapped: boolean } | null>(null)
  const [, tick] = useState(0)

  useEffect(() => { const id = setInterval(() => tick(n => n + 1), 500); return () => clearInterval(id) }, [])

  const loadTarget = useCallback(async () => {
    setPhase('loading'); setPath([]); setResult(null)
    const t = await fetchRaidTarget(playerId)
    setTarget(t)
    setPhase(t ? 'ready' : 'none')
  }, [playerId])

  useEffect(() => { if (energy.energy >= 1) loadTarget() /* eslint-disable-next-line */ }, [])

  const cells = target?.chipCells ?? {}
  const goal = target ? raidGoalCell(cells) : -1
  const budget = raidBudget()
  const val = validateBreachPath(cells, goal, path)
  const trap = pathTrapChance(cells, path)
  const atGoal = val.valid && val.reachedGoal
  const minRes = target ? minBreachResistance(cells, goal) : 0
  const breachable = minRes <= budget

  const clickCell = (i: number) => {
    if (phase !== 'ready' || result) return
    if (path.length === 0) {
      if (!isEdgeCell(i)) return
      if (cellResistance(cells[String(i)]) > budget) return
      setPath([i]); playSound('click')
      return
    }
    if (path.length >= 2 && i === path[path.length - 2]) { setPath(path.slice(0, -1)); return } // step back
    if (path.includes(i)) return
    if (!chipNeighbours(path[path.length - 1]).includes(i)) return
    if (val.resistance + cellResistance(cells[String(i)]) > budget) return
    setPath([...path, i]); playSound('click')
  }

  const commitBreach = async () => {
    if (!target || !atGoal || energy.energy < 1) return
    const trapped = Math.random() < trap
    const won = !trapped
    const loot = won ? raidLoot(target) : 0
    recordRaid(won, loot) // consumes 1 raid energy
    setResult({ won, loot, trapped })
    setPhase('result')
    playSound(won ? 'prestige' : 'event')
    await resolveRaid(playerId, target.playerId, won)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md card border-red-800/40 p-5 space-y-3 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-lg font-semibold text-red-300">⚔ Raid</span>
            <span className="flex gap-1" title={`Raid-Energie ${energy.energy}/${RAID_ENERGY_MAX}`}>
              {Array.from({ length: RAID_ENERGY_MAX }, (_, i) => (
                <span key={i} className="w-2 h-2 rounded-sm" style={{
                  background: i < energy.energy ? ACCENT.red : 'transparent',
                  border: `1px solid ${i < energy.energy ? ACCENT.red : 'rgba(148,163,184,0.3)'}`,
                }} />
              ))}
            </span>
          </div>
          <button onClick={onClose} className="font-mono text-xs text-slate-600 hover:text-slate-400">schließen</button>
        </div>

        {phase === 'noenergy' && (
          <div className="text-center py-8 space-y-2">
            <div className="text-3xl opacity-50">⚡</div>
            <div className="font-mono text-sm text-slate-400">Keine Raid-Energie</div>
            <div className="font-mono text-xs text-slate-600">Nächste Energie in {fmtDuration(energy.msToNext)}</div>
            <div className="font-mono text-[10px] text-slate-700">Ein Breach kostet 1 von {RAID_ENERGY_MAX} Energie — sie lädt langsam über Stunden nach.</div>
          </div>
        )}

        {phase === 'loading' && (
          <div className="text-center py-10 font-mono text-sm text-slate-500"><span className="cursor-blink">_</span> Suche Ziel…</div>
        )}

        {phase === 'none' && (
          <div className="text-center py-8 space-y-2">
            <div className="font-mono text-sm text-slate-400">Kein Ziel gefunden</div>
            <div className="font-mono text-xs text-slate-600">Gerade ist niemand angreifbar. Versuch es später.</div>
            <button onClick={loadTarget} className="mt-2 font-mono text-xs px-3 py-1.5 rounded border border-slate-700 text-slate-400 hover:border-slate-500">erneut suchen</button>
          </div>
        )}

        {target && (phase === 'ready' || phase === 'result') && (
          <>
            {/* Target header */}
            <div className="card bg-[#0a0a10] border-red-900/30 p-2.5 shrink-0">
              <div className="flex items-center justify-between">
                <div className="font-mono text-sm text-slate-200">{target.name}<span className="text-purple-400/60">#{target.nameTag}</span></div>
                <div className="font-mono text-[11px] text-red-400/80">🛡 {target.defenseRating.toLocaleString('de-DE')}</div>
              </div>
              <div className="flex items-center justify-between mt-1 font-mono text-[10px]">
                <span className="text-slate-500">Loot bei Sieg: <b className="text-amber-300">{formatBits(raidLoot(target))}</b></span>
                <span className={breachable ? 'text-emerald-400/70' : 'text-red-400/70'}>{breachable ? 'angreifbar' : 'stark verteidigt'}</span>
              </div>
            </div>

            {/* Objective + meters */}
            <div className="flex items-center justify-between font-mono text-[10px] text-slate-500 shrink-0">
              <span>Route vom <span className="text-cyan-300">Rand</span> zum <span className="text-amber-300">◈ Ziel</span></span>
              <span>Widerstand <b className={val.resistance > budget ? 'text-red-400' : 'text-cyan-300'}>{val.resistance}</b>/{budget}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800/60 rounded-full overflow-hidden shrink-0">
              <div className="h-full bg-cyan-500/70 transition-all" style={{ width: `${Math.min(100, (val.resistance / budget) * 100)}%` }} />
            </div>

            {/* The target as a tactical breach map — semantic tiles, not the builder's icons */}
            <div className="mx-auto" style={{ maxWidth: 'min(92vw, 340px)' }}>
              <div className="grid gap-[3px] p-2.5 rounded-md bg-[#070710] border border-slate-800/60"
                style={{ gridTemplateColumns: `repeat(${CHIP_SIZE}, minmax(0,1fr))`, gridTemplateRows: `repeat(${CHIP_SIZE}, minmax(0,1fr))`, aspectRatio: '1/1' }}>
                {Array.from({ length: N }, (_, i) => {
                  const cell = cells[String(i)]
                  const isFirewall = cell?.type === 'firewall'
                  const isHoneypot = cell?.type === 'honeypot'
                  const res = cellResistance(cell)
                  const inPath = path.includes(i)
                  const pathPos = path.indexOf(i)
                  const isStart = pathPos === 0
                  const isLast = pathPos === path.length - 1 && inPath
                  const isGoal = i === goal
                  const edge = isEdgeCell(i)
                  // Highlight only cheap passable edge cells as recommended entry points;
                  // edge firewalls/honeypots stay walls (you *can* start there, just not ideal).
                  const entryHint = !inPath && edge && path.length === 0 && !isGoal && !isFirewall && !isHoneypot
                  const canStart = phase === 'ready' && !result

                  // Base tile look by tactical role (path overlay wins visually).
                  let bg = '#0b0b14', border = 'rgba(51,65,85,0.35)', glow: string | undefined
                  if (isGoal) { bg = 'rgba(251,191,36,0.14)'; border = '#fbbf24'; glow = '0 0 12px -2px #fbbf24' }
                  else if (isFirewall) { bg = 'repeating-linear-gradient(45deg, rgba(248,113,113,0.30) 0 3px, rgba(248,113,113,0.08) 3px 7px)'; border = 'rgba(248,113,113,0.55)' }
                  else if (isHoneypot) { bg = 'rgba(251,191,36,0.14)'; border = 'rgba(251,191,36,0.5)' }
                  else if (cell) { bg = 'rgba(148,163,184,0.06)'; border = 'rgba(71,85,105,0.4)' } // passable econ/bus
                  if (entryHint) { bg = 'rgba(34,211,238,0.07)'; border = 'rgba(34,211,238,0.4)' }
                  if (inPath) { bg = 'rgba(34,211,238,0.32)'; border = isLast ? '#e2e8f0' : '#22d3ee' }

                  const title = isGoal ? 'Ziel (Vault/Core) — hierher routen'
                    : isFirewall ? `Firewall · Widerstand ${res}`
                    : isHoneypot ? `Honeypot · Widerstand ${res} · Falle`
                    : `passierbar · Widerstand ${res}`

                  return (
                    <button key={i} onClick={() => clickCell(i)}
                      className="relative rounded-[3px] flex items-center justify-center overflow-hidden transition-all duration-75"
                      style={{ minWidth: 0, minHeight: 0, background: bg, border: `1px solid ${border}`, boxShadow: glow,
                        borderStyle: entryHint ? 'dashed' : 'solid', cursor: canStart ? 'pointer' : 'default' }}
                      title={title}>
                      {isGoal ? (
                        <span style={{ color: '#fbbf24', fontSize: 'clamp(0.8rem,3.8vw,1.1rem)', lineHeight: 1 }}>◈</span>
                      ) : inPath ? (
                        <span style={{ color: isLast ? '#f1f5f9' : '#a5f3fc', fontSize: 'clamp(0.6rem,3vw,0.9rem)', lineHeight: 1 }}>
                          {isStart ? '▶' : isLast ? '◆' : '•'}
                        </span>
                      ) : (isFirewall || isHoneypot) ? (
                        <span className="font-mono font-semibold tabular-nums"
                          style={{ color: isFirewall ? '#fca5a5' : '#fcd34d', fontSize: 'clamp(0.5rem,2.5vw,0.72rem)', lineHeight: 1 }}>{res}</span>
                      ) : (
                        <span style={{ color: entryHint ? 'rgba(34,211,238,0.6)' : 'rgba(71,85,105,0.5)', fontSize: '0.4rem' }}>·</span>
                      )}
                    </button>
                  )
                })}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-2 font-mono text-[9px] text-slate-500">
                <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-[2px] inline-block border border-dashed" style={{ borderColor: 'rgba(34,211,238,0.5)', background: 'rgba(34,211,238,0.08)' }} />Rand = Einstieg</span>
                <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-[2px] inline-block" style={{ background: 'repeating-linear-gradient(45deg, rgba(248,113,113,0.5) 0 2px, rgba(248,113,113,0.12) 2px 4px)', border: '1px solid rgba(248,113,113,0.55)' }} />Firewall (Widerstand)</span>
                <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-[2px] inline-block" style={{ background: 'rgba(251,191,36,0.18)', border: '1px solid rgba(251,191,36,0.5)' }} />Honeypot (Falle)</span>
                <span className="flex items-center gap-1"><span className="text-amber-300">◈</span> Ziel</span>
              </div>
            </div>

            {/* Trap risk + actions */}
            {phase === 'ready' && !result && (
              <div className="space-y-2 shrink-0">
                {trap > 0 && (
                  <div className="font-mono text-[10px] text-amber-400/80 text-center">🍯 Fallen-Risiko auf dieser Route: {Math.round(trap * 100)}%</div>
                )}
                <div className="flex gap-2">
                  {path.length > 0 && <button onClick={() => setPath([])} className="font-mono text-[11px] px-3 py-2 rounded border border-slate-700 text-slate-400 hover:border-slate-500">Route löschen</button>}
                  <button onClick={loadTarget} className="font-mono text-[11px] px-3 py-2 rounded border border-slate-700 text-slate-400 hover:border-slate-500">Anderes Ziel</button>
                  {atGoal ? (
                    <button onClick={commitBreach} className="flex-1 font-mono text-sm py-2 rounded border border-red-500 text-red-200 bg-red-900/25 hover:bg-red-900/40 font-semibold animate-pulse">
                      Breach{trap > 0 ? ` (${Math.round((1 - trap) * 100)}%)` : ''} · 1⚡
                    </button>
                  ) : (
                    <button disabled className="flex-1 font-mono text-[11px] py-2 rounded border border-slate-800 text-slate-600 opacity-60">◈ Vault erreichen</button>
                  )}
                </div>
                <div className="font-mono text-[9px] text-slate-700 text-center">
                  {path.length === 0 ? '① Klicke eine gestrichelte Randzelle (Einstieg).' : '② Klicke Zelle für Zelle weiter bis zum ◈ Ziel. Zurück: letzte Zelle erneut klicken.'}
                </div>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className="text-center space-y-2 shrink-0">
                {result.won ? (
                  <>
                    <div className="font-mono text-lg font-semibold text-emerald-300">✓ Breach erfolgreich</div>
                    <div className="font-mono text-sm text-amber-300">+{formatBits(result.loot)} erbeutet</div>
                  </>
                ) : (
                  <>
                    <div className="font-mono text-lg font-semibold text-red-400">✗ Abgewehrt</div>
                    <div className="font-mono text-[11px] text-slate-500">In einen Honeypot gelaufen. Der Verteidiger kassiert eine Bounty.</div>
                  </>
                )}
                <button onClick={onClose} className="w-full mt-1 font-mono text-sm py-2 rounded border border-slate-700 text-slate-300 hover:border-slate-500">Fertig</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
