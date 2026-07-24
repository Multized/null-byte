import type { ChipCell } from './types'
import {
  CHIP_SIZE,
  CHIP_MODULES,
  CHIP_MODULE_MAX_LEVEL,
  RAID_BASE_BUDGET,
  RAID_LOOT_CORE_PCT,
  RAID_LOOT_NODE_PCT,
  RAID_RES_EMPTY,
  RAID_RES_ECON,
  RAID_RES_BUS,
  RAID_RES_FIREWALL_BASE,
  RAID_RES_FIREWALL_PER_LEVEL,
  RAID_RES_HONEYPOT_BASE,
  RAID_RES_HONEYPOT_PER_LEVEL,
  RAID_TRACE_DEFENSE_DIVISOR,
  RAID_TRACE_CAP,
  RAID_DETECT_PER_STEP,
  RAID_DETECT_FIREWALL,
  RAID_DETECT_HONEYPOT,
  RAID_DETECT_PER_TRACE,
  RAID_EXTRACT_MAX_REPEL,
} from './constants'
import { chipModuleDef } from './utils'

export interface RaidTarget {
  playerId: string
  name: string
  nameTag: string
  defenseRating: number
  totalBitsEarned: number
  chipCells: Record<string, ChipCell>
}

const N = CHIP_SIZE * CHIP_SIZE

/** Resistance of stepping onto a target cell during a breach. Higher = harder to cross. */
export function cellResistance(cell: ChipCell | undefined): number {
  if (!cell) return RAID_RES_EMPTY
  const def = CHIP_MODULES.find(m => m.id === cell.type)
  if (!def) return RAID_RES_EMPTY
  if (def.effect === 'vault') return 0 // the goal itself is free to enter
  if (def.effect === 'bus') return RAID_RES_BUS
  if (def.effect === 'defense') {
    return cell.type === 'honeypot'
      ? RAID_RES_HONEYPOT_BASE + cell.level * RAID_RES_HONEYPOT_PER_LEVEL
      : RAID_RES_FIREWALL_BASE + cell.level * RAID_RES_FIREWALL_PER_LEVEL
  }
  return RAID_RES_ECON // core / alu / cache / register
}

export function isEdgeCell(index: number): boolean {
  const r = Math.floor(index / CHIP_SIZE), c = index % CHIP_SIZE
  return r === 0 || c === 0 || r === CHIP_SIZE - 1 || c === CHIP_SIZE - 1
}

const CENTER_CELL = Math.floor(N / 2) + Math.floor(CHIP_SIZE / 2) // rough centre (index 21 on 6×6)

/** The Vault cell if the base has one, else -1. */
function vaultCell(cells: Record<string, ChipCell>): number {
  for (const key of Object.keys(cells)) {
    if (CHIP_MODULES.find(m => m.id === cells[key].type)?.effect === 'vault') return Number(key)
  }
  return -1
}

/**
 * Where the target's data core sits — the jackpot node. A built Vault relocates the core
 * to that (defensible) cell; without one it lies exposed in the centre. Always valid, so
 * every base — even a bare one — has a core worth stealing.
 */
export function mainframeCell(cells: Record<string, ChipCell>): number {
  const v = vaultCell(cells)
  return v >= 0 ? v : CENTER_CELL
}

export function raidBudget(): number {
  // Pure-skill: a flat budget. What makes a breach hard is the defender — their layout
  // (walls between edge and vault) plus their trace level (see raidTrace).
  return RAID_BASE_BUDGET
}

/**
 * Per-step trace cost added to every cell of a breach path, scaled by the target's overall
 * defence rating and capped. This is what makes defence matter even on a base that never
 * walled its vault: crossing a well-defended die is costly step for step.
 */
export function raidTrace(defenseRating: number): number {
  return Math.min(RAID_TRACE_CAP, Math.round((defenseRating ?? 0) / RAID_TRACE_DEFENSE_DIVISOR))
}

const ECON_EFFECTS = new Set(['production', 'click', 'offline', 'contract'])

export interface LootNode { value: number; kind: 'vault' | 'data' }

/**
 * The plunderable nodes on a base, keyed by cell index. Every base has a data core (the
 * jackpot) — at the Vault if one is built, else exposed in the centre — so even a bare base
 * is worth raiding. Economy modules add smaller nodes scaled by level. Loot is minted (the
 * victim loses nothing) but scaled by the target's wealth and build, so a rich, module-dense
 * base is genuinely worth more than a bare one.
 */
export function lootNodes(cells: Record<string, ChipCell>, wealth: number): Record<string, LootNode> {
  const out: Record<string, LootNode> = {}
  const w = Math.max(0, wealth ?? 0)
  // Economy modules = bonus data nodes.
  for (const key of Object.keys(cells)) {
    const def = chipModuleDef(cells[key].type)
    if (def && ECON_EFFECTS.has(def.effect)) {
      out[key] = { value: Math.max(1, w * RAID_LOOT_NODE_PCT * (cells[key].level / CHIP_MODULE_MAX_LEVEL)), kind: 'data' }
    }
  }
  // The data core is always present — it's the target's actual bits, not a placed module.
  const mf = String(mainframeCell(cells))
  out[mf] = { value: (out[mf]?.value ?? 0) + Math.max(1, w * RAID_LOOT_CORE_PCT), kind: 'vault' }
  return out
}

/** Total loot available across every node — the ceiling for a perfect, greedy sweep. */
export function totalLoot(cells: Record<string, ChipCell>, wealth: number): number {
  return Object.values(lootNodes(cells, wealth)).reduce((s, n) => s + n.value, 0)
}

/** Detection added by stepping onto a cell: a base rate + trace, spiked by defensive cells. */
export function cellDetection(cell: ChipCell | undefined, trace: number): number {
  let d = RAID_DETECT_PER_STEP + trace * RAID_DETECT_PER_TRACE
  if (cell?.type === 'firewall') d += RAID_DETECT_FIREWALL
  else if (cell?.type === 'honeypot') d += RAID_DETECT_HONEYPOT
  return d
}

/** Chance an extraction is repelled, from accumulated detection (0..1), capped. */
export function extractRepelChance(detection: number): number {
  return Math.min(RAID_EXTRACT_MAX_REPEL, Math.max(0, detection))
}
