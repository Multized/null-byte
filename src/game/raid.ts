import type { ChipCell } from './types'
import {
  CHIP_SIZE,
  CHIP_MODULES,
  CHIP_MODULE_MAX_LEVEL,
  RAID_BASE_BUDGET,
  RAID_LOOT_VAULT_PCT,
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
import { chipNeighbours, chipModuleDef } from './utils'

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

/**
 * The cell the attacker must reach: the Vault if the base has one, else the highest-level
 * Core, else the centre. Guaranteed to return a valid index so every base is raidable.
 */
export function raidGoalCell(cells: Record<string, ChipCell>): number {
  let vault = -1, core = -1, coreLevel = -1
  for (const key of Object.keys(cells)) {
    const cell = cells[key]
    const def = CHIP_MODULES.find(m => m.id === cell.type)
    if (def?.effect === 'vault') vault = Number(key)
    else if (cell.type === 'core' && cell.level > coreLevel) { coreLevel = cell.level; core = Number(key) }
  }
  if (vault >= 0) return vault
  if (core >= 0) return core
  return Math.floor(N / 2) + Math.floor(CHIP_SIZE / 2) // rough centre
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

/** Cost of stepping onto cell `i` during a breach: its resistance (0 for the goal) + trace. */
function stepCost(cells: Record<string, ChipCell>, i: number, goal: number, trace: number): number {
  return (i === goal ? 0 : cellResistance(cells[String(i)])) + trace
}

const ECON_EFFECTS = new Set(['production', 'click', 'offline', 'contract'])

export interface LootNode { value: number; kind: 'vault' | 'data' }

/**
 * The plunderable data nodes on a base, keyed by cell index. The Vault is the jackpot;
 * economy modules are smaller nodes whose worth scales with their level. Loot is minted
 * (the victim loses nothing) but scaled by the target's wealth and their own build, so a
 * rich, module-dense base is genuinely worth more to crack than a bare one.
 */
export function lootNodes(cells: Record<string, ChipCell>, wealth: number): Record<string, LootNode> {
  const out: Record<string, LootNode> = {}
  const w = Math.max(0, wealth ?? 0)
  for (const key of Object.keys(cells)) {
    const cell = cells[key]
    const def = chipModuleDef(cell.type)
    if (!def) continue
    if (def.effect === 'vault') out[key] = { value: Math.max(1, w * RAID_LOOT_VAULT_PCT), kind: 'vault' }
    else if (ECON_EFFECTS.has(def.effect)) {
      out[key] = { value: Math.max(1, w * RAID_LOOT_NODE_PCT * (cell.level / CHIP_MODULE_MAX_LEVEL)), kind: 'data' }
    }
  }
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

/**
 * Cheapest breach resistance from any edge to the goal (Dijkstra over cell resistances).
 * Used to tell the player up front whether a base is breachable and how tough it is.
 */
export function minBreachResistance(cells: Record<string, ChipCell>, goal: number, trace = 0): number {
  const dist = new Array(N).fill(Infinity)
  const cost = (i: number) => stepCost(cells, i, goal, trace)
  // Multi-source: every edge cell is a valid entry, seeded with its own step cost.
  const pq: [number, number][] = []
  for (let i = 0; i < N; i++) if (isEdgeCell(i)) { dist[i] = cost(i); pq.push([dist[i], i]) }
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0])
    const [d, u] = pq.shift()!
    if (d > dist[u]) continue
    if (u === goal) return d
    for (const v of chipNeighbours(u)) {
      const nd = d + cost(v)
      if (nd < dist[v]) { dist[v] = nd; pq.push([nd, v]) }
    }
  }
  return dist[goal]
}

/** Validate a proposed path (ordered cell indices) as a legal breach route. */
export function validateBreachPath(
  cells: Record<string, ChipCell>,
  goal: number,
  path: number[],
  trace = 0,
): { valid: boolean; resistance: number; reachedGoal: boolean } {
  if (path.length === 0) return { valid: false, resistance: 0, reachedGoal: false }
  if (!isEdgeCell(path[0])) return { valid: false, resistance: 0, reachedGoal: false }
  let resistance = stepCost(cells, path[0], goal, trace)
  for (let i = 1; i < path.length; i++) {
    if (path.slice(0, i).includes(path[i])) return { valid: false, resistance, reachedGoal: false } // no revisits
    if (!chipNeighbours(path[i - 1]).includes(path[i])) return { valid: false, resistance, reachedGoal: false }
    resistance += stepCost(cells, path[i], goal, trace)
  }
  return { valid: true, resistance, reachedGoal: path[path.length - 1] === goal }
}
