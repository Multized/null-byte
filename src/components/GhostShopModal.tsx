import { useGameStore } from '../game/store'
import { formatBits } from '../game/utils'
import { PRESTIGE_UPGRADES } from '../game/constants'
import { playSound } from '../game/sound'
import type { PrestigeUpgradeDef } from '../game/types'

interface Props {
  onClose: () => void
}

const ECONOMY_EFFECTS = ['global_multiplier', 'click_multiplier', 'ghost_bonus', 'offline_efficiency']

function currentEffectLabel(u: PrestigeUpgradeDef, bought: number): string {
  switch (u.effect) {
    case 'global_multiplier':
    case 'click_multiplier':
      return `×${Math.pow(u.value, bought).toFixed(bought > 0 ? 2 : 0)}`
    case 'ghost_bonus':
      return `+${Math.round(u.value * bought * 100)}%`
    case 'offline_efficiency':
      return `${Math.min(100, Math.round((0.5 + u.value * bought) * 100))}% eff.`
    case 'start_bits':
      return bought > 0 ? formatBits(u.value * bought) : '—'
    case 'auto_buy':
      return bought > 0 ? 'aktiv' : 'inaktiv'
    default:
      return ''
  }
}

function nextEffectLabel(u: PrestigeUpgradeDef, bought: number): string {
  return currentEffectLabel(u, bought + 1)
}

export function GhostShopModal({ onClose }: Props) {
  const ghostCredits = useGameStore(s => s.ghostCredits)
  const purchasedPrestigeUpgrades = useGameStore(s => s.purchasedPrestigeUpgrades)
  const buyPrestigeUpgrade = useGameStore(s => s.buyPrestigeUpgrade)

  const economyUpgrades = PRESTIGE_UPGRADES.filter(u => ECONOMY_EFFECTS.includes(u.effect))
  const utilityUpgrades = PRESTIGE_UPGRADES.filter(u => !ECONOMY_EFFECTS.includes(u.effect))

  const renderRow = (u: PrestigeUpgradeDef) => {
    const bought = purchasedPrestigeUpgrades[u.id] ?? 0
    const maxed = bought >= u.maxPurchases
    const canAfford = ghostCredits >= u.cost && !maxed

    return (
      <button
        key={u.id}
        onClick={() => { if (buyPrestigeUpgrade(u.id)) playSound('upgrade') }}
        disabled={!canAfford}
        className={`
          w-full text-left rounded p-2.5 border transition-all duration-150
          ${maxed
            ? 'border-purple-900/20 bg-purple-950/10 opacity-50 cursor-default'
            : canAfford
              ? 'border-purple-700/40 bg-purple-950/10 hover:border-purple-500/50 hover:bg-purple-950/20 cursor-pointer'
              : 'border-slate-800/40 bg-[#080810] opacity-40 cursor-not-allowed'
          }
        `}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-slate-200">{u.name}</span>
              {u.maxPurchases > 1 && (
                <span className="font-mono text-[10px] text-slate-600">{bought}/{u.maxPurchases}</span>
              )}
              {maxed && <span className="font-mono text-[10px] text-green-500">MAXED</span>}
            </div>
            <div className="font-mono text-xs text-purple-400/70 mt-0.5">{u.description}</div>
            <div className="font-mono text-[10px] text-slate-600 italic mt-0.5">"{u.flavor}"</div>
            <div className="font-mono text-[10px] mt-1.5 flex items-center gap-1.5">
              <span className="text-slate-500">aktuell {currentEffectLabel(u, bought)}</span>
              {!maxed && (
                <>
                  <span className="text-slate-700">→</span>
                  <span className="text-cyan-500/80">nach Kauf {nextEffectLabel(u, bought)}</span>
                </>
              )}
            </div>
          </div>
          <div className="font-mono text-sm neon-purple shrink-0">
            {maxed ? '' : `${u.cost} gc`}
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
      <div className="w-full max-w-md card border-purple-800/40 p-5 space-y-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <div className="font-mono text-lg font-semibold neon-purple">👻 Ghost Shop</div>
            <div className="font-mono text-xs text-slate-500 mt-0.5">
              Permanente Boni, bezahlt mit Ghost Credits — bleiben über jedes Prestige hinweg erhalten.
            </div>
          </div>
        </div>

        <div className="card bg-[#0a0a10] border-purple-900/30 p-3 flex items-center justify-between shrink-0">
          <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">Guthaben</span>
          <span className="font-mono text-lg font-semibold neon-purple">{Math.floor(ghostCredits)} gc</span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
          <div>
            <div className="font-mono text-[10px] text-slate-600 uppercase tracking-widest mb-1.5">
              Ökonomie — stapelbar
            </div>
            <div className="space-y-1.5">
              {economyUpgrades.map(renderRow)}
            </div>
          </div>

          {utilityUpgrades.length > 0 && (
            <div>
              <div className="font-mono text-[10px] text-slate-600 uppercase tracking-widest mb-1.5">
                Utility
              </div>
              <div className="space-y-1.5">
                {utilityUpgrades.map(renderRow)}
              </div>
            </div>
          )}
        </div>

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
