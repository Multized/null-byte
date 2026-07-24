import { useState, useEffect, useCallback, useMemo } from 'react'
import { useGameStore } from '../game/store'
import { fetchRaidTarget, resolveRaid } from '../game/supabase'
import { formatBits, chipNeighbours, raidEnergyInfo } from '../game/utils'
import {
  type RaidTarget,
  cellResistance,
  isEdgeCell,
  raidTrace,
  lootNodes,
  totalLoot,
  cellDetection,
  extractRepelChance,
} from '../game/raid'
import {
  CHIP_SIZE,
  RAID_ENERGY_MAX,
  RAID_BASE_BUDGET,
  RAID_KIT_ICE,
  RAID_KIT_SPOOF,
  RAID_KIT_BANDWIDTH,
  RAID_BANDWIDTH_BONUS,
} from '../game/constants'
import { playSound } from '../game/sound'

interface Props { onClose: () => void }

const N = CHIP_SIZE * CHIP_SIZE
const ACCENT = { red: '#f87171', cyan: '#22d3ee', amber: '#fbbf24', emerald: '#34d399' }

type Phase = 'loading' | 'ready' | 'result' | 'none' | 'noenergy'
type Tool = 'ice' | 'spoof'
type Mods = Record<number, Tool>

function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

const freshKit = () => ({ ice: RAID_KIT_ICE, spoof: RAID_KIT_SPOOF, bandwidth: RAID_KIT_BANDWIDTH })

export function RaidModal({ onClose }: Props) {
  const state = useGameStore(s => s)
  const playerId = state.playerId
  const recordRaid = state.recordRaid

  const energy = raidEnergyInfo(state)
  const [phase, setPhase] = useState<Phase>(energy.energy < 1 ? 'noenergy' : 'loading')
  const [target, setTarget] = useState<RaidTarget | null>(null)
  const [path, setPath] = useState<number[]>([])
  const [mods, setMods] = useState<Mods>({})
  const [kit, setKit] = useState(freshKit())
  const [bonusBudget, setBonusBudget] = useState(0)
  const [toolMode, setToolMode] = useState<Tool | null>(null)
  const [result, setResult] = useState<{ won: boolean; loot: number } | null>(null)
  const [, tick] = useState(0)

  useEffect(() => { const id = setInterval(() => tick(n => n + 1), 500); return () => clearInterval(id) }, [])

  const loadTarget = useCallback(async () => {
    setPhase('loading'); setPath([]); setMods({}); setKit(freshKit()); setBonusBudget(0); setToolMode(null); setResult(null)
    const t = await fetchRaidTarget(playerId)
    setTarget(t)
    setPhase(t ? 'ready' : 'none')
  }, [playerId])

  useEffect(() => { if (energy.energy >= 1) loadTarget() /* eslint-disable-next-line */ }, [])

  const cells = target?.chipCells ?? {}
  const trace = target ? raidTrace(target.defenseRating) : 0
  const nodes = useMemo(() => target ? lootNodes(cells, target.totalBitsEarned) : {}, [target]) // eslint-disable-line react-hooks/exhaustive-deps
  const availLoot = useMemo(() => target ? totalLoot(cells, target.totalBitsEarned) : 0, [target]) // eslint-disable-line react-hooks/exhaustive-deps

  const budget = RAID_BASE_BUDGET + bonusBudget
  const effRes = (i: number) => mods[i] === 'ice' ? 1 : mods[i] === 'spoof' ? 2 : cellResistance(cells[String(i)])
  const effDet = (i: number) => cellDetection(mods[i] ? undefined : cells[String(i)], trace)

  const spent = path.reduce((s, i) => s + effRes(i), 0)
  const detection = Math.min(1, path.reduce((s, i) => s + effDet(i), 0))
  const runLoot = path.reduce((s, i) => s + (nodes[String(i)]?.value ?? 0), 0)
  const captured = path.filter(i => nodes[String(i)]).length
  const repel = extractRepelChance(detection)
  const active = phase === 'ready' && !result

  const clickCell = (i: number) => {
    if (!active) return
    const cell = cells[String(i)]
    // Tool targeting mode: click a valid cell to apply the selected tool.
    if (toolMode) {
      if (toolMode === 'ice' && cell?.type === 'firewall' && !mods[i] && kit.ice > 0) {
        setMods(m => ({ ...m, [i]: 'ice' })); setKit(k => ({ ...k, ice: k.ice - 1 })); playSound('buy')
      } else if (toolMode === 'spoof' && cell?.type === 'honeypot' && !mods[i] && kit.spoof > 0) {
        setMods(m => ({ ...m, [i]: 'spoof' })); setKit(k => ({ ...k, spoof: k.spoof - 1 })); playSound('buy')
      }
      setToolMode(null)
      return
    }
    // Routing.
    if (path.length === 0) {
      if (!isEdgeCell(i) || effRes(i) > budget) return
      setPath([i]); playSound('click'); return
    }
    if (path.length >= 2 && i === path[path.length - 2]) { setPath(path.slice(0, -1)); return } // step back
    if (path.includes(i)) return
    if (!chipNeighbours(path[path.length - 1]).includes(i)) return
    if (spent + effRes(i) > budget) return
    setPath([...path, i]); playSound('click')
  }

  const selectTool = (t: Tool) => { if (!active) return; setToolMode(m => m === t ? null : t) }
  const applyBandwidth = () => {
    if (!active || kit.bandwidth < 1) return
    setBonusBudget(b => b + RAID_BANDWIDTH_BONUS); setKit(k => ({ ...k, bandwidth: k.bandwidth - 1 })); playSound('buy')
  }

  const extract = async () => {
    if (!target || runLoot <= 0 || energy.energy < 1) return
    const won = Math.random() >= repel
    const loot = won ? Math.round(runLoot) : 0
    recordRaid(won, loot) // consumes 1 raid energy
    setResult({ won, loot })
    setPhase('result')
    playSound(won ? 'prestige' : 'event')
    await resolveRaid(playerId, target.playerId, won)
  }

  const detColor = detection < 0.34 ? ACCENT.emerald : detection < 0.67 ? ACCENT.amber : ACCENT.red

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md card border-red-800/40 p-5 space-y-3 max-h-[92vh] overflow-y-auto flex flex-col">
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
            <div className="font-mono text-[10px] text-slate-700">Ein Raid kostet 1 von {RAID_ENERGY_MAX} Energie — sie lädt langsam über Stunden nach.</div>
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
                <div className="font-mono text-[11px] text-red-400/80">🛡 {target.defenseRating.toLocaleString('de-DE')}{trace > 0 && <span className="text-orange-400/70"> · Trace +{trace}</span>}</div>
              </div>
              <div className="mt-1 font-mono text-[10px] text-slate-500">
                Beute im Netz: <b className="text-amber-300">{formatBits(availLoot)}</b> über {Object.keys(nodes).length} Knoten
              </div>
            </div>

            {!result && (
              <>
                {/* Meters */}
                <div className="grid grid-cols-2 gap-2 shrink-0">
                  <div>
                    <div className="flex items-center justify-between font-mono text-[10px] text-slate-500">
                      <span>Bandbreite</span><span className={spent > budget ? 'text-red-400' : 'text-cyan-300'}>{spent}/{budget}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800/60 rounded-full overflow-hidden mt-0.5">
                      <div className="h-full bg-cyan-500/70 transition-all" style={{ width: `${Math.min(100, (spent / budget) * 100)}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between font-mono text-[10px] text-slate-500">
                      <span>Entdeckung</span><span style={{ color: detColor }}>{Math.round(detection * 100)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800/60 rounded-full overflow-hidden mt-0.5">
                      <div className="h-full transition-all" style={{ width: `${detection * 100}%`, background: detColor }} />
                    </div>
                  </div>
                </div>

                {/* Loot secured so far */}
                <div className="flex items-center justify-between font-mono text-[11px] shrink-0">
                  <span className="text-slate-500">Beute gesichert</span>
                  <span className="text-amber-300 font-semibold tabular-nums">{formatBits(runLoot)} <span className="text-slate-600 text-[10px]">· {captured} Knoten</span></span>
                </div>
              </>
            )}

            {/* The breach map */}
            <div className="mx-auto" style={{ maxWidth: 'min(92vw, 340px)' }}>
              <div className="grid gap-[3px] p-2.5 rounded-md bg-[#070710] border border-slate-800/60"
                style={{ gridTemplateColumns: `repeat(${CHIP_SIZE}, minmax(0,1fr))`, gridTemplateRows: `repeat(${CHIP_SIZE}, minmax(0,1fr))`, aspectRatio: '1/1' }}>
                {Array.from({ length: N }, (_, i) => {
                  const cell = cells[String(i)]
                  const mod = mods[i]
                  const isFirewall = cell?.type === 'firewall' && !mod
                  const isHoneypot = cell?.type === 'honeypot' && !mod
                  const node = nodes[String(i)]
                  const inPath = path.includes(i)
                  const pathPos = path.indexOf(i)
                  const isStart = pathPos === 0
                  const isLast = pathPos === path.length - 1 && inPath
                  const edge = isEdgeCell(i)
                  const entryHint = !inPath && edge && path.length === 0 && !node && !isFirewall && !isHoneypot
                  const toolTarget = toolMode === 'ice' ? isFirewall : toolMode === 'spoof' ? isHoneypot : false
                  const res = effRes(i)

                  let bg = '#0b0b14', border = 'rgba(51,65,85,0.35)', glow: string | undefined
                  if (node?.kind === 'vault') { bg = 'rgba(251,191,36,0.14)'; border = 'rgba(251,191,36,0.7)'; glow = '0 0 12px -3px #fbbf24' }
                  else if (node) { bg = 'rgba(52,211,153,0.12)'; border = 'rgba(52,211,153,0.5)' }
                  else if (isFirewall) { bg = 'repeating-linear-gradient(45deg, rgba(248,113,113,0.30) 0 3px, rgba(248,113,113,0.08) 3px 7px)'; border = 'rgba(248,113,113,0.55)' }
                  else if (isHoneypot) { bg = 'rgba(251,191,36,0.14)'; border = 'rgba(251,191,36,0.5)' }
                  else if (mod) { bg = 'rgba(100,116,139,0.10)'; border = 'rgba(100,116,139,0.4)' } // neutralised
                  else if (cell) { bg = 'rgba(148,163,184,0.06)'; border = 'rgba(71,85,105,0.4)' }
                  if (entryHint) { bg = 'rgba(34,211,238,0.07)'; border = 'rgba(34,211,238,0.4)' }
                  if (toolTarget) { border = toolMode === 'ice' ? '#67e8f9' : '#a78bfa'; glow = `0 0 10px -2px ${toolMode === 'ice' ? '#67e8f9' : '#a78bfa'}` }
                  if (inPath) {
                    bg = node ? 'rgba(251,191,36,0.30)' : 'rgba(34,211,238,0.30)'
                    border = isLast ? '#e2e8f0' : node ? '#fbbf24' : '#22d3ee'
                  }

                  const title = node?.kind === 'vault' ? `Vault · Jackpot ${formatBits(node.value)}`
                    : node ? `Daten-Knoten · ${formatBits(node.value)}`
                    : isFirewall ? `Firewall · Widerstand ${res}`
                    : isHoneypot ? `Honeypot · Widerstand ${res} · Falle (+Entdeckung)`
                    : mod === 'ice' ? 'Firewall geknackt' : mod === 'spoof' ? 'Honeypot entschärft'
                    : `passierbar · Widerstand ${res}`

                  return (
                    <button key={i} onClick={() => clickCell(i)}
                      className="relative rounded-[3px] flex items-center justify-center overflow-hidden transition-all duration-75"
                      style={{ minWidth: 0, minHeight: 0, background: bg, border: `1px solid ${border}`, boxShadow: glow,
                        borderStyle: entryHint ? 'dashed' : 'solid', cursor: active ? 'pointer' : 'default' }}
                      title={title}>
                      {inPath ? (
                        <span style={{ color: isLast ? '#f1f5f9' : node ? '#fde68a' : '#a5f3fc', fontSize: 'clamp(0.6rem,3vw,0.9rem)', lineHeight: 1 }}>
                          {isStart ? '▶' : isLast ? '◆' : node ? '◈' : '•'}
                        </span>
                      ) : node?.kind === 'vault' ? (
                        <span style={{ color: '#fbbf24', fontSize: 'clamp(0.8rem,3.8vw,1.1rem)', lineHeight: 1 }}>◈</span>
                      ) : node ? (
                        <span style={{ color: '#6ee7b7', fontSize: 'clamp(0.55rem,2.7vw,0.8rem)', lineHeight: 1 }}>▪</span>
                      ) : (isFirewall || isHoneypot) ? (
                        <span className="font-mono font-semibold tabular-nums"
                          style={{ color: isFirewall ? '#fca5a5' : '#fcd34d', fontSize: 'clamp(0.5rem,2.5vw,0.72rem)', lineHeight: 1 }}>{res}</span>
                      ) : mod ? (
                        <span style={{ color: 'rgba(148,163,184,0.5)', fontSize: '0.6rem' }}>✓</span>
                      ) : (
                        <span style={{ color: entryHint ? 'rgba(34,211,238,0.6)' : 'rgba(71,85,105,0.5)', fontSize: '0.4rem' }}>·</span>
                      )}
                    </button>
                  )
                })}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-2 font-mono text-[9px] text-slate-500">
                <span className="flex items-center gap-1"><span className="text-amber-300">◈</span> Vault</span>
                <span className="flex items-center gap-1"><span className="text-emerald-300">▪</span> Daten-Knoten</span>
                <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-[2px] inline-block" style={{ background: 'repeating-linear-gradient(45deg, rgba(248,113,113,0.5) 0 2px, rgba(248,113,113,0.12) 2px 4px)', border: '1px solid rgba(248,113,113,0.55)' }} />Firewall</span>
                <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-[2px] inline-block" style={{ background: 'rgba(251,191,36,0.18)', border: '1px solid rgba(251,191,36,0.5)' }} />Honeypot</span>
              </div>
            </div>

            {/* Tools + actions */}
            {!result && (
              <div className="space-y-2 shrink-0">
                {/* Intrusion kit */}
                <div className="grid grid-cols-3 gap-1.5">
                  <button onClick={() => selectTool('ice')} disabled={kit.ice < 1}
                    className="font-mono text-[10px] py-1.5 rounded border transition-colors disabled:opacity-35"
                    style={{ borderColor: toolMode === 'ice' ? '#67e8f9' : 'rgba(51,65,85,0.7)', color: toolMode === 'ice' ? '#67e8f9' : '#94a3b8', background: toolMode === 'ice' ? 'rgba(34,211,238,0.1)' : 'transparent' }}>
                    🧊 ICE-Breaker ×{kit.ice}
                  </button>
                  <button onClick={() => selectTool('spoof')} disabled={kit.spoof < 1}
                    className="font-mono text-[10px] py-1.5 rounded border transition-colors disabled:opacity-35"
                    style={{ borderColor: toolMode === 'spoof' ? '#a78bfa' : 'rgba(51,65,85,0.7)', color: toolMode === 'spoof' ? '#a78bfa' : '#94a3b8', background: toolMode === 'spoof' ? 'rgba(167,139,250,0.1)' : 'transparent' }}>
                    📡 Spoofer ×{kit.spoof}
                  </button>
                  <button onClick={applyBandwidth} disabled={kit.bandwidth < 1}
                    className="font-mono text-[10px] py-1.5 rounded border border-slate-700 text-slate-400 hover:border-slate-500 transition-colors disabled:opacity-35">
                    ➕ Bandbreite ×{kit.bandwidth}
                  </button>
                </div>

                {toolMode && (
                  <div className="font-mono text-[10px] text-center" style={{ color: toolMode === 'ice' ? '#67e8f9' : '#a78bfa' }}>
                    {toolMode === 'ice' ? 'Wähle eine Firewall zum Knacken' : 'Wähle einen Honeypot zum Entschärfen'} · nochmal klicken zum Abbrechen
                  </div>
                )}

                <div className="flex gap-2">
                  {path.length > 0 && <button onClick={() => setPath([])} className="font-mono text-[11px] px-3 py-2 rounded border border-slate-700 text-slate-400 hover:border-slate-500">Route löschen</button>}
                  <button onClick={loadTarget} className="font-mono text-[11px] px-3 py-2 rounded border border-slate-700 text-slate-400 hover:border-slate-500">Anderes Ziel</button>
                  <button onClick={extract} disabled={runLoot <= 0}
                    className="flex-1 font-mono text-sm py-2 rounded border font-semibold transition-colors disabled:opacity-40"
                    style={{ borderColor: runLoot > 0 ? (repel > 0.5 ? '#f87171' : '#34d399') : 'rgba(51,65,85,0.6)',
                      color: runLoot > 0 ? (repel > 0.5 ? '#fca5a5' : '#6ee7b7') : '#64748b',
                      background: runLoot > 0 ? (repel > 0.5 ? 'rgba(248,113,113,0.12)' : 'rgba(52,211,153,0.12)') : 'transparent' }}>
                    {runLoot > 0 ? `Extrahieren · Risiko ${Math.round(repel * 100)}% · 1⚡` : 'Erst Beute sichern'}
                  </button>
                </div>
                <div className="font-mono text-[9px] text-slate-700 text-center">
                  {path.length === 0
                    ? '① Am Rand eindringen, dann zu ◈/▪ Knoten routen und Beute sichern.'
                    : '② Tiefer = mehr Beute, aber Entdeckung steigt. Extrahiere, bevor du auffliegst.'}
                </div>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className="text-center space-y-2 shrink-0">
                {result.won ? (
                  <>
                    <div className="font-mono text-lg font-semibold text-emerald-300">✓ Extraktion erfolgreich</div>
                    <div className="font-mono text-sm text-amber-300">+{formatBits(result.loot)} erbeutet</div>
                  </>
                ) : (
                  <>
                    <div className="font-mono text-lg font-semibold text-red-400">✗ Entdeckt & abgewehrt</div>
                    <div className="font-mono text-[11px] text-slate-500">Beim Rausziehen aufgeflogen — die Beute ist futsch, der Verteidiger kassiert eine Bounty.</div>
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
