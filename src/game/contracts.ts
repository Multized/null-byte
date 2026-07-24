import type { ActiveContract, ContractType, GameState } from './types'
import { calcBitsPerSecond, contractRewardMultiplier, isChipUnlocked } from './utils'
import { CHIP_SIZE } from './constants'

const CHIP_CELLS = CHIP_SIZE * CHIP_SIZE
/** Empty cells left on the chip die — a "place module" contract needs at least one. */
const freeChipCells = (s: GameState) => CHIP_CELLS - Object.keys(s.chipCells ?? {}).length

export interface ContractTemplate {
  type: ContractType
  icon: string
  /** Builds the target amount from the current state (already scaled). */
  makeTarget: (state: GameState) => number
  /** Reads the lifetime counter this contract tracks. */
  counter: (state: GameState) => number
  /** Human-readable objective, given the target. */
  label: (target: number) => string
  /** Base bits reward in seconds-of-production. */
  rewardSeconds: number
  /** Chance (0..1) that this contract pays ghost credits instead of bits (post-prestige only). */
  gcChance: number
  /** If set, the contract only rolls when the mechanic it references is available. */
  available?: (state: GameState) => boolean
}

const TEMPLATES: ContractTemplate[] = [
  {
    type: 'clicks',
    icon: '⌨',
    makeTarget: s => 50 + Math.min(450, Math.floor(s.totalClicks / 20)),
    counter: s => s.totalClicks,
    label: t => `Führe ${t} Klicks aus`,
    rewardSeconds: 75,
    gcChance: 0,
  },
  {
    type: 'buy_producers',
    icon: '⬡',
    makeTarget: () => 5 + Math.floor(Math.random() * 11),
    counter: s => s.totalProducersBought,
    label: t => `Kaufe ${t} Producer`,
    rewardSeconds: 90,
    gcChance: 0,
  },
  {
    type: 'earn_bits',
    icon: '💾',
    makeTarget: s => Math.max(500, Math.ceil(calcBitsPerSecond(s) * 600)),
    counter: s => s.totalBitsEarned,
    label: t => `Verdiene ${formatShort(t)} Bits`,
    rewardSeconds: 105,
    gcChance: 0.1,
  },
  {
    type: 'reach_combo',
    icon: '🔥',
    makeTarget: () => 8 + Math.floor(Math.random() * 3) * 4, // 8, 12, 16
    counter: s => s.maxCombo,
    label: t => `Erreiche eine ${t}er-Combo`,
    rewardSeconds: 75,
    gcChance: 0.15,
  },
  {
    type: 'claim_event',
    icon: '⚡',
    makeTarget: () => 1,
    counter: s => s.totalEventsClaimed,
    label: () => 'Claime 1 Event',
    rewardSeconds: 120,
    gcChance: 0.2,
  },
  {
    type: 'buy_upgrades',
    icon: '🛠',
    makeTarget: () => 1 + Math.floor(Math.random() * 2),
    counter: s => s.totalUpgradesBought,
    label: t => t === 1 ? 'Kaufe 1 Upgrade' : `Kaufe ${t} Upgrades`,
    rewardSeconds: 105,
    gcChance: 0.1,
  },
  {
    type: 'catch_packet',
    icon: '📦',
    makeTarget: () => 1,
    counter: s => s.packetsCaught,
    label: () => 'Fange 1 Data Packet',
    rewardSeconds: 135,
    gcChance: 0.25,
  },
  {
    type: 'playtime',
    icon: '⏱',
    makeTarget: () => 300 + Math.floor(Math.random() * 3) * 150, // 5, 7.5, 10 min
    counter: s => s.totalPlaytimeSeconds,
    label: t => `Bleib ${Math.round(t / 60)} min aktiv`,
    rewardSeconds: 90,
    gcChance: 0,
  },
  {
    type: 'overdrive',
    icon: '🔋',
    makeTarget: () => 1 + Math.floor(Math.random() * 2), // 1–2
    counter: s => s.overdrivesUsed ?? 0,
    label: t => t === 1 ? 'Zünde 1× Overdrive' : `Zünde ${t}× Overdrive`,
    rewardSeconds: 90,
    gcChance: 0.15,
  },
  {
    type: 'chip_module',
    icon: '▦',
    // Clamp to the free cells so it's always completable — never ask for more modules
    // than there's room to place.
    makeTarget: s => Math.max(1, Math.min(freeChipCells(s), 1 + Math.floor(Math.random() * 2))), // 1–2
    counter: s => s.chipModulesPlaced ?? 0,
    label: t => t === 1 ? 'Platziere 1 Chip-Modul' : `Platziere ${t} Chip-Module`,
    rewardSeconds: 120,
    gcChance: 0.1,
    // Only when the chip exists AND there's a free cell to place into (a full die can't).
    available: s => isChipUnlocked(s) && freeChipCells(s) >= 1,
  },
]

// Compact number label for contract text (no import cycle with utils formatBits needed for bits amounts)
function formatShort(n: number): string {
  if (n < 1000) return String(Math.floor(n))
  const units = ['K', 'M', 'B', 'T', 'Qa']
  let i = -1
  let v = n
  while (v >= 1000 && i < units.length - 1) { v /= 1000; i++ }
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)}${units[i]}`
}

export function templateFor(type: ContractType): ContractTemplate {
  return TEMPLATES.find(t => t.type === type) ?? TEMPLATES[0]
}

let contractIdCounter = 0

/** Rolls one new contract whose type differs from the currently active ones. */
export function rollContract(state: GameState): ActiveContract {
  const activeTypes = new Set(state.activeContracts.map(c => c.type))
  const pool = TEMPLATES.filter(t => !activeTypes.has(t.type) && (t.available?.(state) ?? true))
  // Fall back to any not-already-active template if the gated pool is empty.
  const usable = pool.length > 0 ? pool : TEMPLATES.filter(t => !activeTypes.has(t.type))
  const tpl = usable[Math.floor(Math.random() * usable.length)] ?? TEMPLATES[0]

  const bps = calcBitsPerSecond(state)
  const reward = Math.max(100, Math.ceil(bps * tpl.rewardSeconds * contractRewardMultiplier(state)))

  return {
    id: `c${Date.now()}_${contractIdCounter++}`,
    type: tpl.type,
    target: tpl.makeTarget(state),
    baseline: tpl.counter(state),
    reward,
    // Ghost Credits come only from prestige — contracts pay in bits
    rewardGc: 0,
    bestCombo: 0,
  }
}

export function contractProgress(contract: ActiveContract, state: GameState): number {
  // reach_combo tracks its own per-contract best; see ActiveContract.bestCombo.
  if (contract.type === 'reach_combo') {
    return Math.max(0, Math.min(contract.target, contract.bestCombo ?? 0))
  }
  const current = templateFor(contract.type).counter(state) - contract.baseline
  return Math.max(0, Math.min(contract.target, current))
}

export function isContractComplete(contract: ActiveContract, state: GameState): boolean {
  return contractProgress(contract, state) >= contract.target
}
