import { useState } from 'react'
import { useGameStore } from '../game/store'
import {
  formatBits,
  isChipUnlocked,
  chipModuleDef,
  chipPlaceCost,
  chipUpgradeCost,
  chipBusMultiplier,
  calcChipBonuses,
  calcDefenseRating,
  defenseTier,
  chipTrapChance,
  busBonus,
  raidEnergyInfo,
} from '../game/utils'
import { CHIP_MODULES, CHIP_SIZE, CHIP_MODULE_MAX_LEVEL, CHIP_UNLOCK_BITS, RAID_ENERGY_MAX } from '../game/constants'
import { playSound } from '../game/sound'

const ACCENT: Record<string, string> = {
  cyan: '#22d3ee',
  emerald: '#34d399',
  amber: '#fbbf24',
  purple: '#a78bfa',
  red: '#f87171',
}

const EFFECT_LABEL: Record<string, string> = {
  production: 'Produktion',
  click: 'Klick-Power',
  offline: 'Offline-Effizienz',
  contract: 'Auftrags-Belohnung',
  bus: 'verstärkt Nachbarn',
  defense: 'Verteidigung',
  vault: 'Tresor',
}

const isDefense = (effect: string) => effect === 'defense' || effect === 'vault'

const CELLS = CHIP_SIZE * CHIP_SIZE

function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

export function ChipPanel({ onRaid }: { onRaid?: () => void }) {
  const state = useGameStore(s => s)
  const bits = useGameStore(s => s.bits)
  const chipCells = useGameStore(s => s.chipCells)
  const place = useGameStore(s => s.placeChipModule)
  const upgrade = useGameStore(s => s.upgradeChipModule)
  const remove = useGameStore(s => s.removeChipModule)

  const [tool, setTool] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)

  if (!isChipUnlocked(state)) {
    const pct = Math.min(1, state.totalBitsEarned / CHIP_UNLOCK_BITS)
    return (
      <div className="p-5 text-center space-y-3">
        <div className="text-4xl opacity-50">🔲</div>
        <div className="font-mono text-sm text-slate-300">Der Chip · gesperrt</div>
        <p className="font-mono text-[11px] text-slate-500 leading-relaxed max-w-xs mx-auto">
          Deine eigene Basis: ein Prozessor, den du aus <span className="text-cyan-400/80">Modulen</span> aufbaust —
          Cores, Cache, ALUs. Jedes gibt einen <span className="text-cyan-400/80">permanenten Bonus</span> auf
          Produktion, Klick, Offline und mehr. Er bleibt über jedes Prestige und jede Ascension.
        </p>
        <div className="pt-1">
          <div className="font-mono text-[10px] text-slate-600 mb-1.5">
            Schaltet frei bei {formatBits(CHIP_UNLOCK_BITS)} verdienten Bits · {Math.floor(pct * 100)}%
          </div>
          <div className="max-w-xs mx-auto h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-600/50 transition-all duration-500" style={{ width: `${pct * 100}%` }} />
          </div>
        </div>
      </div>
    )
  }

  const bonuses = calcChipBonuses(state)
  const bonusRows = [
    { key: 'production', v: bonuses.production, color: ACCENT.cyan },
    { key: 'click', v: bonuses.click, color: ACCENT.amber },
    { key: 'offline', v: bonuses.offline, color: ACCENT.emerald },
    { key: 'contract', v: bonuses.contract, color: ACCENT.purple },
  ].filter(r => r.v > 0)

  const handleCell = (i: number) => {
    const key = String(i)
    const occupied = chipCells[key]
    if (occupied) {
      setSelected(i === selected ? null : i)
      setTool(null)
    } else if (tool) {
      if (place(i, tool)) { playSound('buy'); setSelected(i); setTool(null) }
    } else {
      setSelected(null)
    }
  }

  const sel = selected != null ? chipCells[String(selected)] : undefined
  const selDef = sel ? chipModuleDef(sel.type) : undefined
  const selUpCost = selected != null && sel ? chipUpgradeCost(state, String(selected)) : Infinity
  const selBusMult = selected != null && sel ? chipBusMultiplier(state, selected) : 1
  const defenseRating = calcDefenseRating(state)
  const trapChance = chipTrapChance(state)
  const raidEnergy = raidEnergyInfo(state)

  return (
    <div className="p-2 space-y-3">
      {/* The die comes first so it never shifts — everything below it (bonus + defense
          summaries, inspector) reflows when you place a module, and reflow above the die
          is exactly what made the grid jump under the cursor. */}
      <div className="mx-auto" style={{ maxWidth: 'min(92vw, 340px)' }}>
        <div
          className="grid gap-1 p-2 rounded-md bg-[#080810] border border-slate-800/60"
          style={{
            // minmax(0, 1fr) on BOTH axes locks every cell to an equal share of the square.
            // Plain `1fr` carries an implicit `auto` (min-content) floor, so a filled cell
            // (glyph + level label) is taller than an empty one and the rows would reflow —
            // that was the shifting. Explicit equal rows + a 0 floor keep the grid fixed.
            gridTemplateColumns: `repeat(${CHIP_SIZE}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${CHIP_SIZE}, minmax(0, 1fr))`,
            aspectRatio: '1 / 1',
          }}
        >
          {Array.from({ length: CELLS }, (_, i) => {
            const cell = chipCells[String(i)]
            const def = cell ? chipModuleDef(cell.type) : undefined
            const color = def ? ACCENT[def.accent] : undefined
            const isSel = selected === i
            const boosted = cell && def && def.effect !== 'bus' && chipBusMultiplier(state, i) > 1
            return (
              <button
                key={i}
                onClick={() => handleCell(i)}
                className="relative rounded-sm flex flex-col items-center justify-center transition-all duration-100 overflow-hidden"
                style={{
                  minWidth: 0,
                  minHeight: 0,
                  background: color ? `color-mix(in srgb, ${color} 14%, #0a0a12)` : '#0c0c14',
                  border: `1px solid ${isSel ? '#e2e8f0' : color ? `color-mix(in srgb, ${color} 50%, transparent)` : 'rgba(51,65,85,0.4)'}`,
                  boxShadow: color ? `0 0 10px -4px ${color}${isSel ? ', 0 0 0 1px #e2e8f0 inset' : ''}` : undefined,
                  cursor: cell || tool ? 'pointer' : 'default',
                }}
                title={def ? `${def.name} · Lv ${cell!.level}` : tool ? `${chipModuleDef(tool)?.name} platzieren` : 'leer'}
              >
                {def ? (
                  <>
                    <span style={{ color, fontSize: 'clamp(0.7rem, 3.4vw, 1.05rem)', lineHeight: 1 }}>{def.glyph}</span>
                    <span className="font-mono text-slate-500" style={{ fontSize: '0.5rem' }}>L{cell!.level}</span>
                    {boosted && (
                      <span className="absolute top-0 right-0.5 text-cyan-300" style={{ fontSize: '0.5rem' }}>▲</span>
                    )}
                  </>
                ) : (
                  <span className="text-slate-800" style={{ fontSize: '0.6rem' }}>·</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Bonus summary */}
      <div className="card bg-[#0a0a10] border-slate-800/50 p-2.5">
        <div className="font-mono text-[10px] text-slate-600 uppercase tracking-widest mb-1.5">Chip-Boni aktiv</div>
        {bonusRows.length === 0 ? (
          <div className="font-mono text-[11px] text-slate-600">Noch keine — platziere dein erstes Modul.</div>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px]">
            {bonusRows.map(r => (
              <span key={r.key} style={{ color: r.color }}>
                {EFFECT_LABEL[r.key]} <b>+{Math.round(r.v * 100)}%</b>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Defense summary + raid launch */}
      <div className="card bg-[#0a0a10] border-red-900/30 p-2.5">
        <div className="flex items-center justify-between">
          <div className="font-mono text-[10px] text-slate-600 uppercase tracking-widest">Verteidigung</div>
          <span className="font-mono text-[10px] text-slate-500">🍯 {Math.round(trapChance * 100)}% Falle</span>
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="font-mono text-lg font-semibold" style={{ color: ACCENT.red }}>{defenseRating.toLocaleString('de-DE')}</span>
          <span className="font-mono text-[11px] text-slate-400">{defenseTier(defenseRating)}</span>
        </div>
        {defenseRating === 0 && (
          <div className="font-mono text-[10px] text-slate-600 mt-1">
            Baue Firewall, Honeypot oder Vault, um deine Basis gegen fremde Raids zu befestigen.
          </div>
        )}
        {/* Raid energy pips */}
        <div className="flex items-center gap-1.5 mt-2.5">
          <span className="font-mono text-[10px] text-slate-500">Raid-Energie</span>
          <div className="flex gap-1">
            {Array.from({ length: RAID_ENERGY_MAX }, (_, i) => (
              <span key={i} className="w-2.5 h-2.5 rounded-sm" style={{
                background: i < raidEnergy.energy ? ACCENT.red : 'transparent',
                border: `1px solid ${i < raidEnergy.energy ? ACCENT.red : 'rgba(148,163,184,0.3)'}`,
                boxShadow: i < raidEnergy.energy ? `0 0 6px -2px ${ACCENT.red}` : undefined,
              }} />
            ))}
          </div>
          <span className="font-mono text-[10px] text-slate-500 ml-auto tabular-nums">
            {raidEnergy.energy}/{RAID_ENERGY_MAX}{raidEnergy.energy < RAID_ENERGY_MAX && ` · +1 in ${fmtDuration(raidEnergy.msToNext)}`}
          </span>
        </div>
        <button
          onClick={() => { playSound('click'); onRaid?.() }}
          disabled={raidEnergy.energy < 1}
          className="mt-1.5 w-full font-mono text-sm py-2 rounded border border-red-600/60 text-red-200 bg-red-900/20 hover:bg-red-900/40 disabled:opacity-40 disabled:hover:bg-red-900/20 transition-colors font-semibold"
        >
          {raidEnergy.energy < 1 ? `⚔ Keine Energie — +1 in ${fmtDuration(raidEnergy.msToNext)}` : '⚔ Fremde Basis raiden'}
        </button>
      </div>

      {/* Selected module inspector */}
      {sel && selDef && selected != null && (
        <div className="card bg-[#0a0a10] p-3 space-y-2" style={{ borderColor: `color-mix(in srgb, ${ACCENT[selDef.accent]} 40%, transparent)` }}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span style={{ color: ACCENT[selDef.accent], fontSize: '1.1rem' }}>{selDef.glyph}</span>
              <div>
                <div className="font-mono text-sm text-slate-200">{selDef.name} <span className="text-slate-600">Lv {sel.level}/{CHIP_MODULE_MAX_LEVEL}</span></div>
                <div className="font-mono text-[10px] text-slate-500">{EFFECT_LABEL[selDef.effect]}</div>
              </div>
            </div>
            <button
              onClick={() => { remove(selected); playSound('click'); setSelected(null) }}
              className="font-mono text-[10px] text-red-400/70 hover:text-red-300 border border-red-900/40 rounded px-2 py-1 transition-colors"
              title="Modul entfernen (keine Rückerstattung)"
            >
              entfernen
            </button>
          </div>
          <div className="font-mono text-[10px] text-slate-600 italic">"{selDef.flavor}"</div>
          {selDef.effect === 'bus' ? (
            <div className="font-mono text-[11px] text-cyan-400/80">
              Verstärkt jedes angrenzende Modul um +{Math.round(busBonus(sel.level) * 100)}%
            </div>
          ) : isDefense(selDef.effect) ? (
            <div className="font-mono text-[11px]" style={{ color: ACCENT[selDef.accent] }}>
              Verteidigung: +{Math.round(selDef.perLevel * sel.level * selBusMult)}
              {selBusMult > 1 && <span className="text-cyan-300"> (Bus ×{selBusMult.toFixed(2)})</span>}
              {selDef.id === 'honeypot' && <span className="text-amber-400/80"> · +{Math.round(sel.level * 2)}% Falle</span>}
            </div>
          ) : (
            <div className="font-mono text-[11px]" style={{ color: ACCENT[selDef.accent] }}>
              Beitrag: +{(selDef.perLevel * sel.level * selBusMult * 100).toFixed(1)}%
              {selBusMult > 1 && <span className="text-cyan-300"> (Bus ×{selBusMult.toFixed(2)})</span>}
            </div>
          )}
          {sel.level < CHIP_MODULE_MAX_LEVEL ? (
            <button
              onClick={() => { if (upgrade(selected)) playSound('upgrade') }}
              disabled={bits < selUpCost}
              className={`w-full font-mono text-xs py-2 rounded border transition-all ${
                bits >= selUpCost
                  ? 'border-cyan-700/50 text-cyan-300 bg-cyan-950/20 hover:bg-cyan-950/30 hover:border-cyan-500/60'
                  : 'border-slate-800/50 text-slate-600 cursor-not-allowed'
              }`}
            >
              Upgrade → Lv {sel.level + 1} · {formatBits(selUpCost)}
            </button>
          ) : (
            <div className="w-full text-center font-mono text-xs py-2 rounded border border-emerald-900/30 text-emerald-500">MAX-STUFE</div>
          )}
        </div>
      )}

      {/* Module palette */}
      <div>
        <div className="font-mono text-[10px] text-slate-600 uppercase tracking-widest mb-1.5 px-1">
          {tool ? 'Tippe eine leere Zelle zum Platzieren' : 'Modul wählen'}
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {CHIP_MODULES.map(m => {
            const cost = chipPlaceCost(state, m.id)
            const affordable = bits >= cost
            const active = tool === m.id
            return (
              <button
                key={m.id}
                onClick={() => setTool(active ? null : m.id)}
                className="w-full text-left rounded p-2 border transition-all duration-100 flex items-center gap-2.5"
                style={{
                  background: active ? `color-mix(in srgb, ${ACCENT[m.accent]} 16%, #0a0a12)` : '#0a0a10',
                  borderColor: active ? ACCENT[m.accent] : affordable ? `color-mix(in srgb, ${ACCENT[m.accent]} 32%, transparent)` : 'rgba(51,65,85,0.4)',
                  opacity: affordable ? 1 : 0.5,
                }}
              >
                <span style={{ color: ACCENT[m.accent], fontSize: '1.05rem', width: '1.4rem', textAlign: 'center' }}>{m.glyph}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs text-slate-200">{m.name}</div>
                  <div className="font-mono text-[10px] text-slate-500">
                    {EFFECT_LABEL[m.effect]}
                    {m.effect === 'bus' ? '' : isDefense(m.effect) ? ` +${m.perLevel}/Lv` : ` +${Math.round(m.perLevel * 100)}%/Lv`}
                  </div>
                </div>
                <div className="font-mono text-[11px] shrink-0" style={{ color: affordable ? ACCENT[m.accent] : '#64748b' }}>
                  {formatBits(cost)}
                </div>
              </button>
            )
          })}
        </div>
        <div className="font-mono text-[9px] text-slate-700 mt-2 px-1 leading-relaxed">
          Der Chip ist permanent — er überlebt jedes Prestige und jede Ascension.
        </div>
      </div>
    </div>
  )
}
