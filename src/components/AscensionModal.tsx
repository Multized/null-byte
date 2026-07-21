import { useGameStore } from '../game/store'
import {
  canAscend,
  calcRootKeysFromAscension,
  ghostCreditsThisAscension,
  ascensionRequirement,
  isGhostShopMaxed,
  rootKeyCap,
  ascensionUpgradeCost,
  ascensionLevel,
  getAscensionHeadstartGc,
} from '../game/utils'
import { ASCENSION_UPGRADES, RK_GLOBAL_PER_KEY } from '../game/constants'
import { playSound } from '../game/sound'
import type { AscensionUpgradeDef } from '../game/types'

interface Props {
  onClose: () => void
}

function currentEffectLabel(u: AscensionUpgradeDef, lvl: number): string {
  switch (u.effect) {
    case 'global_multiplier':
      return `×${Math.pow(u.value, lvl).toFixed(lvl > 0 ? 2 : 0)}`
    case 'gc_gain':
      return `+${Math.round(u.value * lvl * 100)}%`
    case 'prestige_boost':
      return `+${(u.value * lvl).toFixed(1)}`
    case 'gc_headstart':
      return lvl > 0 ? `${u.value * lvl} gc` : '—'
    default:
      return ''
  }
}

export function AscensionModal({ onClose }: Props) {
  const state = useGameStore(s => s)
  const rootKeys = useGameStore(s => s.rootKeys)
  const ascensionCount = useGameStore(s => s.ascensionCount)
  const ascend = useGameStore(s => s.ascend)
  const buyAscensionUpgrade = useGameStore(s => s.buyAscensionUpgrade)

  const ready = canAscend(state)
  const willEarn = calcRootKeysFromAscension(state)
  const gcThis = ghostCreditsThisAscension(state)
  const req = ascensionRequirement(state)
  const shopMaxed = isGhostShopMaxed(state)
  const gcPct = Math.min(1, gcThis / req)
  const headstart = getAscensionHeadstartGc(state)

  const handleAscend = () => {
    ascend()
    playSound('prestige')
    onClose()
  }

  const renderRow = (u: AscensionUpgradeDef) => {
    const lvl = ascensionLevel(state, u.effect)
    const maxed = lvl >= u.maxPurchases
    const nextCost = ascensionUpgradeCost(u, lvl)
    const canAfford = rootKeys >= nextCost && !maxed
    return (
      <button
        key={u.id}
        onClick={() => { if (buyAscensionUpgrade(u.id)) playSound('upgrade') }}
        disabled={!canAfford}
        className={`
          w-full text-left rounded p-2.5 border transition-all duration-150
          ${maxed
            ? 'border-emerald-900/20 bg-emerald-950/10 opacity-50 cursor-default'
            : canAfford
              ? 'border-emerald-700/40 bg-emerald-950/10 hover:border-emerald-500/50 hover:bg-emerald-950/20 cursor-pointer'
              : 'border-slate-800/40 bg-[#080810] opacity-40 cursor-not-allowed'
          }
        `}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-slate-200">{u.name}</span>
              <span className="font-mono text-[10px] text-slate-600">{lvl}/{u.maxPurchases}</span>
              {maxed && <span className="font-mono text-[10px] text-emerald-500">MAXED</span>}
            </div>
            <div className="font-mono text-xs text-emerald-400/70 mt-0.5">{u.description}</div>
            <div className="font-mono text-[10px] text-slate-600 italic mt-0.5">"{u.flavor}"</div>
            <div className="font-mono text-[10px] mt-1.5 flex items-center gap-1.5">
              <span className="text-slate-500">aktuell {currentEffectLabel(u, lvl)}</span>
              {!maxed && (
                <>
                  <span className="text-slate-700">→</span>
                  <span className="text-emerald-400/80">nach Kauf {currentEffectLabel(u, lvl + 1)}</span>
                </>
              )}
            </div>
          </div>
          <div className="font-mono text-sm text-emerald-300 shrink-0">
            {maxed ? '' : `${nextCost} ⬢`}
          </div>
        </div>
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md card border-emerald-800/40 p-5 space-y-4 max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="shrink-0">
          <div className="font-mono text-lg font-semibold text-emerald-300">⬢ Root Access</div>
          <div className="font-mono text-xs text-slate-500 mt-0.5">
            Gib die gesamte Ghost-Ebene auf für Root Keys — ihr Bonus bleibt für immer, durch jedes
            Prestige und jede weitere Ascension.
          </div>
        </div>

        {/* Balance */}
        <div className="card bg-[#0a0a10] border-emerald-900/30 p-3 flex items-center justify-between shrink-0">
          <div className="flex flex-col">
            <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">Root Keys</span>
            <span className="font-mono text-[10px] text-slate-600">
              {ascensionCount}× transzendiert · +{Math.round(RK_GLOBAL_PER_KEY * 100)}% global je Key
            </span>
          </div>
          <span className="font-mono text-lg font-semibold text-emerald-300">{Math.floor(rootKeys)} ⬢</span>
        </div>

        {/* Ascend action */}
        <div className="card bg-emerald-950/10 border-emerald-900/30 p-3 shrink-0">
          {ready ? (
            <>
              <div className="text-center">
                <div className="font-mono text-[10px] text-slate-600 uppercase tracking-widest mb-1">
                  Bei Ascension erhältst du
                </div>
                <div className="font-mono text-2xl font-bold text-emerald-300">
                  +{willEarn} <span className="text-base">Root Keys</span>
                </div>
                <div className="font-mono text-[10px] text-slate-600 mt-1">
                  Maximum bei dieser Ascension: {rootKeyCap(state)} ⬢
                </div>
              </div>
              <div className="font-mono text-[10px] text-slate-500 mt-3 leading-relaxed">
                <span className="text-red-500/80">↺ Zurückgesetzt:</span> Bits, Producer, Upgrades,
                Ghost Credits, Prestige-Level und der komplette Ghost Shop.
                <br />
                <span className="text-green-500/80">✓ Bleibt:</span> Achievements, Titel, Artefakte,
                Story, Root Keys{headstart > 0 && ` · Start mit ${headstart} gc`}.
              </div>
              <button
                onClick={handleAscend}
                className="w-full mt-3 font-mono text-sm py-2 rounded border border-emerald-600 text-emerald-200 bg-emerald-900/20 hover:bg-emerald-900/40 hover:border-emerald-400 transition-all font-semibold"
              >
                Transzendieren
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <div className="font-mono text-xs text-slate-400">Ascension noch nicht verfügbar:</div>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className={shopMaxed ? 'text-green-500' : 'text-slate-600'}>
                  {shopMaxed ? '✓' : '○'}
                </span>
                <span className={shopMaxed ? 'text-slate-400' : 'text-slate-500'}>
                  Ghost Shop komplett gekauft
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className={gcThis >= req ? 'text-green-500' : 'text-slate-600'}>
                  {gcThis >= req ? '✓' : '○'}
                </span>
                <span className={gcThis >= req ? 'text-slate-400' : 'text-slate-500'}>
                  {Math.floor(gcThis)} / {Math.floor(req)} gc seit letzter Ascension
                </span>
              </div>
              <div className="h-[3px] bg-slate-800/60 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-600/50 transition-all duration-500" style={{ width: `${gcPct * 100}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Root shop */}
        {(rootKeys > 0 || ascensionCount > 0) && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
            <div className="font-mono text-[10px] text-slate-600 uppercase tracking-widest mb-1.5">
              Root-Upgrades — permanent
            </div>
            {ASCENSION_UPGRADES.map(renderRow)}
          </div>
        )}

        <button
          onClick={onClose}
          className="shrink-0 w-full font-mono text-sm py-2 rounded border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-all"
        >
          Schließen
        </button>
      </div>
    </div>
  )
}
