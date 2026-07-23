import type { GameState, PrestigeUpgradeDef, AscensionUpgradeDef, ChipModuleDef } from './types'
import {
  PRODUCERS,
  UPGRADES,
  PRESTIGE_UPGRADES,
  ASCENSION_UPGRADES,
  CHIP_MODULES,
  CHIP_SIZE,
  CHIP_MODULE_MAX_LEVEL,
  CHIP_BUS_BASE_BONUS,
  CHIP_BUS_BONUS_PER_LEVEL,
  CHIP_UNLOCK_BITS,
  CHIP_DEFENSE_TIERS,
  CHIP_TRAP_PER_LEVEL,
  CHIP_TRAP_CAP,
  COST_SCALING,
  COST_SCALING_REDUCTION_PER_LEVEL,
  DEFAULT_OFFLINE_CAP_HOURS,
  MILESTONE_THRESHOLDS,
  MILESTONE_FACTOR,
  PRESTIGE_BASE_REQ,
  PRESTIGE_REQ_GROWTH,
  GC_BASE,
  GC_CAP_BASE,
  GC_CAP_PER_PRESTIGE,
  ASCENSION_BASE_REQ,
  ASCENSION_REQ_GROWTH,
  RK_BASE,
  RK_CAP_BASE,
  RK_CAP_PER_ASCENSION,
  RK_GLOBAL_PER_KEY,
  OVERDRIVE_ENERGY_MAX,
  OVERDRIVE_ENERGY_REGEN_MS,
  RAID_ENERGY_MAX,
  RAID_ENERGY_REGEN_MS,
} from './constants'
import { calcAchievementMultiplier } from './achievements'
import { artifactGlobalMultiplier, artifactOfflineBonus } from './quests'

const BIT_UNITS = ['bits', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
const NUM_SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc']

export function formatBits(n: number): string {
  if (n < 0) return '0 bits'
  if (n < 1) return `${n.toFixed(2)} bits`
  if (n < 10) return `${n.toFixed(1)} bits`
  if (n < 1024) return `${Math.floor(n)} bits`
  let i = 0
  let val = n
  while (val >= 1024 && i < BIT_UNITS.length - 1) {
    val /= 1024
    i++
  }
  return `${val >= 100 ? val.toFixed(1) : val.toFixed(2)} ${BIT_UNITS[i]}`
}

export function formatNumber(n: number): string {
  if (n < 1000) return Math.floor(n).toString()
  let i = 0
  let val = n
  while (val >= 1000 && i < NUM_SUFFIXES.length - 1) {
    val /= 1000
    i++
  }
  return `${val >= 100 ? val.toFixed(1) : val.toFixed(2)}${NUM_SUFFIXES[i]}`
}

export function formatRate(bps: number): string {
  return `${formatBits(bps)}/s`
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.floor(seconds))}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

/** Effective per-unit cost growth, lowered by the `ghost_cost_scaling` prestige upgrade. */
export function effectiveCostScaling(state: GameState): number {
  const def = PRESTIGE_UPGRADES.find(u => u.effect === 'cost_scaling')
  if (!def) return COST_SCALING
  const times = state.purchasedPrestigeUpgrades[def.id] ?? 0
  return COST_SCALING - COST_SCALING_REDUCTION_PER_LEVEL * times
}

export function calcProducerCost(producerId: string, owned: number, state: GameState): number {
  const def = PRODUCERS.find(p => p.id === producerId)
  if (!def) return Infinity
  return Math.ceil(def.baseCost * Math.pow(effectiveCostScaling(state), owned))
}

/** Closed-form cost of buying `qty` consecutive units of a producer starting at `owned`. */
export function calcBulkProducerCost(
  producerId: string,
  owned: number,
  qty: number,
  state: GameState,
): number {
  const def = PRODUCERS.find(p => p.id === producerId)
  if (!def || qty <= 0) return 0
  const r = effectiveCostScaling(state)
  const raw = def.baseCost * Math.pow(r, owned) * (Math.pow(r, qty) - 1) / (r - 1)
  return Math.ceil(raw)
}

/** Max units of a producer affordable with `bits`, starting at `owned`. */
export function calcMaxAffordable(
  producerId: string,
  owned: number,
  bits: number,
  state: GameState,
): number {
  const def = PRODUCERS.find(p => p.id === producerId)
  if (!def) return 0
  const r = effectiveCostScaling(state)
  const firstCost = def.baseCost * Math.pow(r, owned)
  if (bits < firstCost) return 0
  const rhs = (bits * (r - 1)) / firstCost + 1
  let n = Math.max(0, Math.floor(Math.log(rhs) / Math.log(r)))
  // Correct for floating-point drift against the actual ceil'd cost
  for (let i = 0; i < 5 && n > 0 && calcBulkProducerCost(producerId, owned, n, state) > bits; i++) n--
  for (let i = 0; i < 5 && calcBulkProducerCost(producerId, owned, n + 1, state) <= bits; i++) n++
  return n
}

export function calcProducerMultiplier(producerId: string, state: GameState): number {
  let mult = 1
  for (const u of UPGRADES) {
    if (u.target !== producerId || !state.purchasedUpgrades.includes(u.id)) continue
    if (u.type === 'producer_multiplier') {
      mult *= (u.multiplier ?? 1)
    } else if (u.type === 'synergy' && u.synergySource && u.synergyValue) {
      const sourceCount = state.producers[u.synergySource] ?? 0
      mult *= 1 + (u.synergyValue / 100) * sourceCount
    }
  }
  mult *= calcMilestoneMultiplier(producerId, state)
  return mult
}

export function calcClickMultiplier(state: GameState): number {
  let mult = 1
  for (const u of UPGRADES) {
    if (u.type === 'click_multiplier' && state.purchasedUpgrades.includes(u.id)) {
      mult *= (u.multiplier ?? 1)
    }
  }
  // Prestige click multiplier
  const prestigeClickUpgrade = PRESTIGE_UPGRADES.find(u => u.effect === 'click_multiplier')
  if (prestigeClickUpgrade) {
    const times = state.purchasedPrestigeUpgrades[prestigeClickUpgrade.id] ?? 0
    if (times > 0) mult *= Math.pow(prestigeClickUpgrade.value, times)
  }
  // Chip ALUs — permanent click bonus from the base
  mult *= 1 + calcChipBonuses(state).click
  return mult
}

/** Level of an ascension upgrade (0 if never bought). */
export function ascensionLevel(state: GameState, effect: AscensionUpgradeDef['effect']): number {
  const def = ASCENSION_UPGRADES.find(u => u.effect === effect)
  if (!def) return 0
  return state.purchasedAscensionUpgrades?.[def.id] ?? 0
}

/**
 * Permanent multiplier from the ascension layer. Persists through every prestige AND
 * ascension — it is the whole point of Root Keys.
 */
export function calcAscensionMultiplier(state: GameState): number {
  const keys = state.totalRootKeysEarned ?? 0
  let mult = 1 + RK_GLOBAL_PER_KEY * keys
  const globalDef = ASCENSION_UPGRADES.find(u => u.effect === 'global_multiplier')
  if (globalDef) mult *= Math.pow(globalDef.value, ascensionLevel(state, 'global_multiplier'))
  return mult
}

/** The inherent per-prestige bonus rate, boosted by the `asc_prestige_boost` upgrade. */
export function prestigeBonusRate(state: GameState): number {
  const def = ASCENSION_UPGRADES.find(u => u.effect === 'prestige_boost')
  return 0.2 + (def?.value ?? 0) * ascensionLevel(state, 'prestige_boost')
}

export function calcGlobalMultiplier(state: GameState): number {
  let mult = 1
  const prestigeGlobalUpgrade = PRESTIGE_UPGRADES.find(u => u.effect === 'global_multiplier')
  if (prestigeGlobalUpgrade) {
    const times = state.purchasedPrestigeUpgrades[prestigeGlobalUpgrade.id] ?? 0
    if (times > 0) mult *= Math.pow(prestigeGlobalUpgrade.value, times)
  }
  mult *= calcAchievementMultiplier(state)
  mult *= artifactGlobalMultiplier(state)
  // Inherent per-prestige bonus — every prestige makes you directly stronger (linear, no runaway)
  mult *= 1 + prestigeBonusRate(state) * state.prestigeCount
  // Permanent ascension bonus — survives prestige and ascension
  mult *= calcAscensionMultiplier(state)
  // Chip Cores — permanent production bonus from the base
  mult *= 1 + calcChipBonuses(state).production
  return mult
}

/** Per-milestone factor, boosted by the `ghost_milestone` prestige upgrade. */
export function milestoneFactor(state: GameState): number {
  const def = PRESTIGE_UPGRADES.find(u => u.effect === 'milestone_boost')
  if (!def) return MILESTONE_FACTOR
  const times = state.purchasedPrestigeUpgrades[def.id] ?? 0
  return MILESTONE_FACTOR * (1 + def.value * times)
}

export function calcMilestoneMultiplier(producerId: string, state: GameState): number {
  const owned = state.producers[producerId] ?? 0
  const reached = MILESTONE_THRESHOLDS.filter(t => owned >= t).length
  return Math.pow(milestoneFactor(state), reached)
}

export function nextMilestone(producerId: string, state: GameState): number | null {
  const owned = state.producers[producerId] ?? 0
  return MILESTONE_THRESHOLDS.find(t => owned < t) ?? null
}

export function calcBitsPerSecond(state: GameState): number {
  let total = 0
  const globalMult = calcGlobalMultiplier(state)
  for (const def of PRODUCERS) {
    const count = state.producers[def.id] ?? 0
    if (count === 0) continue
    const prodMult = calcProducerMultiplier(def.id, state)
    total += def.baseBps * count * prodMult
  }
  return total * globalMult
}

export function calcBitsPerClick(state: GameState, bps = calcBitsPerSecond(state)): number {
  // bps already includes the global multiplier — apply only the click multipliers on top,
  // otherwise global would be counted twice and clicks would scale with global².
  // Callers that already have bps (e.g. computeDerived) pass it in to avoid recomputing it.
  const base = Math.max(1, bps * 0.02)
  const clickMult = calcClickMultiplier(state)
  return base * clickMult
}

/** Bits that must be earned this run before prestige unlocks. Grows with every prestige. */
export function prestigeRequirement(state: GameState): number {
  return PRESTIGE_BASE_REQ * Math.pow(PRESTIGE_REQ_GROWTH, state.prestigeCount)
}

export function canPrestige(state: GameState): boolean {
  return state.totalBitsEarned >= prestigeRequirement(state)
}

/** Hard ceiling on Ghost Credits from a single prestige, before the Shadow Economy bonus. */
export function ghostCreditCap(state: GameState): number {
  return GC_CAP_BASE + GC_CAP_PER_PRESTIGE * state.prestigeCount
}

export function calcGhostCreditsFromBits(totalBitsEarned: number, state: GameState): number {
  const req = prestigeRequirement(state)
  if (totalBitsEarned < req) return 0

  const ghostBonusUpgrade = PRESTIGE_UPGRADES.find(u => u.effect === 'ghost_bonus')
  let bonusMult = 1
  if (ghostBonusUpgrade) {
    const times = state.purchasedPrestigeUpgrades[ghostBonusUpgrade.id] ?? 0
    bonusMult = 1 + ghostBonusUpgrade.value * times
  }
  // Ascension "Tiefe Taschen" boosts GC gain on top; the cap is boosted too so it
  // actually pays out rather than being clipped away.
  const ascGcDef = ASCENSION_UPGRADES.find(u => u.effect === 'gc_gain')
  if (ascGcDef) bonusMult *= 1 + ascGcDef.value * ascensionLevel(state, 'gc_gain')

  // Cube-root of "how far past the gate you got": overshooting pays, but 8x the bits
  // only doubles the payout. The hard cap on top stops the geometric runaway that the
  // permanent multipliers would otherwise create across runs.
  const base = GC_BASE * Math.cbrt(totalBitsEarned / req)
  return Math.min(Math.floor(ghostCreditCap(state) * bonusMult), Math.floor(base * bonusMult))
}

// ---- Ascension formulas ------------------------------------------------------

/** Ghost credits that must be earned since the last ascension before it unlocks. */
export function ascensionRequirement(state: GameState): number {
  return ASCENSION_BASE_REQ * Math.pow(ASCENSION_REQ_GROWTH, state.ascensionCount ?? 0)
}

/** Ghost credits banked toward the next ascension. */
export function ghostCreditsThisAscension(state: GameState): number {
  return (state.totalGhostCreditsEarned ?? 0) - (state.ghostCreditsAtLastAscension ?? 0)
}

/** True once every ghost-shop upgrade is at max level. */
export function isGhostShopMaxed(state: GameState): boolean {
  return PRESTIGE_UPGRADES.every(
    u => (state.purchasedPrestigeUpgrades[u.id] ?? 0) >= u.maxPurchases
  )
}

export function canAscend(state: GameState): boolean {
  // Two gates: enough ghost credits earned this cycle AND the whole ghost shop bought.
  // The shop gate is what actually binds — it makes ascension "the thing after the shop"
  // and stops the button tempting players away from an unfinished shop.
  return (
    ghostCreditsThisAscension(state) >= ascensionRequirement(state) &&
    isGhostShopMaxed(state)
  )
}

/** Hard ceiling on Root Keys from a single ascension. */
export function rootKeyCap(state: GameState): number {
  return RK_CAP_BASE + RK_CAP_PER_ASCENSION * (state.ascensionCount ?? 0)
}

export function calcRootKeysFromAscension(state: GameState): number {
  const req = ascensionRequirement(state)
  const earned = ghostCreditsThisAscension(state)
  if (earned < req) return 0
  const base = RK_BASE * Math.cbrt(earned / req)
  return Math.min(rootKeyCap(state), Math.floor(base))
}

/** Ghost credits granted at the start of each ascension (`asc_headstart`). */
export function getAscensionHeadstartGc(state: GameState): number {
  const def = ASCENSION_UPGRADES.find(u => u.effect === 'gc_headstart')
  if (!def) return 0
  return def.value * ascensionLevel(state, 'gc_headstart')
}

/** Cost of the next level of an ascension upgrade, given how many are already owned. */
export function ascensionUpgradeCost(def: AscensionUpgradeDef, owned: number): number {
  const growth = def.costGrowth ?? 1
  return Math.ceil(def.cost * Math.pow(growth, owned))
}

// ---- The Chip ----------------------------------------------------------------

export function chipModuleDef(type: string): ChipModuleDef | undefined {
  return CHIP_MODULES.find(m => m.id === type)
}

export function isChipUnlocked(state: GameState): boolean {
  return (state.totalBitsEarned ?? 0) >= CHIP_UNLOCK_BITS ||
    (state.prestigeCount ?? 0) >= 1 ||
    Object.keys(state.chipCells ?? {}).length > 0
}

/** Orthogonal neighbour cell indices of a cell on the square die. */
export function chipNeighbours(index: number): number[] {
  const r = Math.floor(index / CHIP_SIZE)
  const c = index % CHIP_SIZE
  const out: number[] = []
  if (r > 0) out.push(index - CHIP_SIZE)
  if (r < CHIP_SIZE - 1) out.push(index + CHIP_SIZE)
  if (c > 0) out.push(index - 1)
  if (c < CHIP_SIZE - 1) out.push(index + 1)
  return out
}

/** Adjacency bonus a single Bus of the given level grants to each neighbour. */
export function busBonus(level: number): number {
  return CHIP_BUS_BASE_BONUS + CHIP_BUS_BONUS_PER_LEVEL * (level - 1)
}

/**
 * Bus multiplier acting on the module at `index` — one plus the bonus of the *best*
 * adjacent Bus. Only the strongest neighbour counts (not the sum), so buses are about
 * coverage, not surrounding a cell with four of them. That keeps placement an honest
 * routing puzzle instead of a degenerate "wall a core in with buses" exploit.
 */
export function chipBusMultiplier(state: GameState, index: number): number {
  let best = 0
  for (const n of chipNeighbours(index)) {
    const cell = state.chipCells?.[String(n)]
    if (cell && chipModuleDef(cell.type)?.effect === 'bus') best = Math.max(best, busBonus(cell.level))
  }
  return 1 + best
}

export interface ChipBonuses { production: number; click: number; offline: number; contract: number }

/** Aggregate chip bonuses, Bus adjacency already applied to each economy module. */
export function calcChipBonuses(state: GameState): ChipBonuses {
  const b: ChipBonuses = { production: 0, click: 0, offline: 0, contract: 0 }
  const cells = state.chipCells
  if (!cells) return b
  for (const key of Object.keys(cells)) {
    const cell = cells[key]
    const def = chipModuleDef(cell.type)
    if (!def || def.effect === 'bus') continue
    const contrib = def.perLevel * cell.level * chipBusMultiplier(state, Number(key))
    if (def.effect === 'production') b.production += contrib
    else if (def.effect === 'click') b.click += contrib
    else if (def.effect === 'offline') b.offline += contrib
    else if (def.effect === 'contract') b.contract += contrib
  }
  return b
}

// ---- Overdrive energy --------------------------------------------------------

/**
 * Standard energy-regen accounting: consume whole elapsed intervals into energy (capped),
 * preserving the leftover time. While full, the clock idles at `now` so no backlog builds.
 * Works offline because it's driven purely by elapsed real time.
 */
export function regenEnergy(
  energy: number,
  lastRegen: number,
  now: number,
  max: number,
  regenMs: number,
): { energy: number; lastRegen: number } {
  if (energy >= max) return { energy: max, lastRegen: now }
  const gained = Math.floor((now - lastRegen) / regenMs)
  if (gained <= 0) return { energy, lastRegen }
  const next = Math.min(max, energy + gained)
  // Advance the clock by the intervals actually consumed; snap to `now` once full.
  const lr = next >= max ? now : lastRegen + gained * regenMs
  return { energy: next, lastRegen: lr }
}

export function regenOverdriveEnergy(energy: number, lastRegen: number, now: number) {
  return regenEnergy(energy, lastRegen, now, OVERDRIVE_ENERGY_MAX, OVERDRIVE_ENERGY_REGEN_MS)
}

export interface EnergyInfo {
  energy: number
  max: number
  /** Milliseconds until the next energy point (0 when already full). */
  msToNext: number
}

/** Live Overdrive energy status for display — applies regen without mutating state. */
export function overdriveEnergyInfo(state: GameState, now = Date.now()): EnergyInfo {
  const { energy, lastRegen } = regenOverdriveEnergy(state.overdriveEnergy ?? 0, state.lastEnergyRegen ?? now, now)
  const msToNext = energy >= OVERDRIVE_ENERGY_MAX ? 0 : OVERDRIVE_ENERGY_REGEN_MS - (now - lastRegen)
  return { energy, max: OVERDRIVE_ENERGY_MAX, msToNext }
}

/** Live raid energy status for display — applies regen without mutating state. */
export function raidEnergyInfo(state: GameState, now = Date.now()): EnergyInfo {
  const { energy, lastRegen } = regenEnergy(
    state.raidEnergy ?? RAID_ENERGY_MAX, state.lastRaidEnergyRegen ?? now, now,
    RAID_ENERGY_MAX, RAID_ENERGY_REGEN_MS,
  )
  const msToNext = energy >= RAID_ENERGY_MAX ? 0 : RAID_ENERGY_REGEN_MS - (now - lastRegen)
  return { energy, max: RAID_ENERGY_MAX, msToNext }
}

// ---- Daily streak ------------------------------------------------------------

function localYMD(offsetDays = 0): string {
  const d = new Date(Date.now() - offsetDays * 86_400_000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface DailyStreakInfo {
  /** True if today's bonus hasn't been claimed yet. */
  claimable: boolean
  /** Streak to show right now: the live count, or 0 if it lapsed and isn't yet re-claimed. */
  effective: number
  /** What the streak becomes after claiming today. */
  willBe: number
  /** True when the streak lapsed (a day was skipped) and claiming today restarts it. */
  wasBroken: boolean
  /** Reward (bits) the claim would grant. */
  reward: number
}

/**
 * Cheap streak status (date logic only) — for the header flame and the dossier, which
 * need the count every render but not the reward. Mirrors store.claimDaily's date logic.
 */
export function dailyStreakStatus(state: GameState): Omit<DailyStreakInfo, 'reward'> {
  const today = localYMD(0)
  const yesterday = localYMD(1)
  const last = state.lastDailyClaim
  const claimedToday = last === today
  const continues = last === yesterday
  const willBe = claimedToday ? state.dailyStreak : continues ? state.dailyStreak + 1 : 1
  const effective = claimedToday ? state.dailyStreak : continues ? state.dailyStreak : 0
  const wasBroken = !claimedToday && !continues && state.dailyStreak > 0
  return { claimable: !claimedToday, effective, willBe, wasBroken }
}

/** Full status incl. the reward preview (computes bps) — for the daily modal. */
export function dailyStreakInfo(state: GameState): DailyStreakInfo {
  const s = dailyStreakStatus(state)
  const reward = Math.max(50, Math.ceil(calcBitsPerSecond(state) * 300 * Math.min(s.willBe, 7)))
  return { ...s, reward }
}

// ---- The Chip, phase 2: defense ----------------------------------------------

/**
 * Defense rating from Firewall / Honeypot / Vault modules, Bus adjacency applied the
 * same way it boosts economy modules. Raiding (phase 3) reads this to gate breaches.
 */
export function calcDefenseRating(state: GameState): number {
  const cells = state.chipCells
  if (!cells) return 0
  let total = 0
  for (const key of Object.keys(cells)) {
    const cell = cells[key]
    const def = chipModuleDef(cell.type)
    if (!def || (def.effect !== 'defense' && def.effect !== 'vault')) continue
    total += def.perLevel * cell.level * chipBusMultiplier(state, Number(key))
  }
  return Math.round(total)
}

export function defenseTier(rating: number): string {
  let label = CHIP_DEFENSE_TIERS[0].label
  for (const t of CHIP_DEFENSE_TIERS) if (rating >= t.min) label = t.label
  return label
}

/** Chance a raid is auto-repelled, from Honeypot levels (phase 3 mechanic). */
export function chipTrapChance(state: GameState): number {
  const cells = state.chipCells
  if (!cells) return 0
  let levels = 0
  for (const key of Object.keys(cells)) {
    if (cells[key].type === 'honeypot') levels += cells[key].level
  }
  return Math.min(CHIP_TRAP_CAP, levels * CHIP_TRAP_PER_LEVEL)
}

/** Bit cost to place a new module of `type`, given how many of that type already exist. */
export function chipPlaceCost(state: GameState, type: string): number {
  const def = chipModuleDef(type)
  if (!def) return Infinity
  const owned = Object.values(state.chipCells ?? {}).filter(c => c.type === type).length
  return Math.ceil(def.placeCost * Math.pow(def.placeGrowth, owned))
}

/** Bit cost to upgrade the module in `cellKey` from its current level to the next. */
export function chipUpgradeCost(state: GameState, cellKey: string): number {
  const cell = state.chipCells?.[cellKey]
  if (!cell) return Infinity
  const def = chipModuleDef(cell.type)
  if (!def || cell.level >= CHIP_MODULE_MAX_LEVEL) return Infinity
  return Math.ceil(def.upgradeCost * Math.pow(def.upgradeGrowth, cell.level - 1))
}

/** Multiplier on contract bit rewards from the `ghost_contract` prestige upgrade + chip Registers. */
export function contractRewardMultiplier(state: GameState): number {
  const def = PRESTIGE_UPGRADES.find(u => u.effect === 'contract_bonus')
  const ghost = def ? def.value * (state.purchasedPrestigeUpgrades[def.id] ?? 0) : 0
  return 1 + ghost + calcChipBonuses(state).contract
}

/** How many purchased upgrades survive a prestige (`ghost_keep_upgrades`). */
export function keptUpgradeCount(state: GameState): number {
  const def = PRESTIGE_UPGRADES.find(u => u.effect === 'keep_upgrades')
  if (!def) return 0
  return def.value * (state.purchasedPrestigeUpgrades[def.id] ?? 0)
}

/** Producers granted at the start of a run (`ghost_start_producers`). */
export function getStartProducers(state: GameState): Record<string, number> {
  const def = PRESTIGE_UPGRADES.find(u => u.effect === 'start_producers')
  if (!def) return {}
  const times = state.purchasedPrestigeUpgrades[def.id] ?? 0
  if (times === 0) return {}
  const count = def.value * times
  return { script: count, crawler: count }
}

/** Cost of the next level of a prestige upgrade, given how many are already owned. */
export function prestigeUpgradeCost(def: PrestigeUpgradeDef, owned: number): number {
  const growth = def.costGrowth ?? 1
  return Math.ceil(def.cost * Math.pow(growth, owned))
}

export function calcOfflineEfficiency(state: GameState): number {
  let base = 0.5
  const offlineUpgrade = PRESTIGE_UPGRADES.find(u => u.effect === 'offline_efficiency')
  if (offlineUpgrade) {
    const times = state.purchasedPrestigeUpgrades[offlineUpgrade.id] ?? 0
    base += offlineUpgrade.value * times
  }
  base += artifactOfflineBonus(state)
  base += calcChipBonuses(state).offline // Chip Caches
  return Math.min(1, base)
}

export function hasAutoBuy(state: GameState): boolean {
  const autoBuyUpgrade = PRESTIGE_UPGRADES.find(u => u.effect === 'auto_buy')
  if (!autoBuyUpgrade) return false
  return (state.purchasedPrestigeUpgrades[autoBuyUpgrade.id] ?? 0) > 0
}

export function getOfflineCapHours(state: GameState): number {
  let cap = DEFAULT_OFFLINE_CAP_HOURS
  for (const u of UPGRADES) {
    if (u.type === 'offline_cap' && state.purchasedUpgrades.includes(u.id)) {
      cap = Math.max(cap, u.offlineHours ?? cap)
    }
  }
  return cap
}

export function isUpgradeUnlocked(upgradeId: string, state: GameState): boolean {
  const u = UPGRADES.find(u => u.id === upgradeId)
  if (!u) return false
  if (u.unlockBitsMin !== undefined && state.totalBitsEarned < u.unlockBitsMin) return false
  if (u.unlockProducerId !== undefined && u.unlockProducerMin !== undefined) {
    const count = state.producers[u.unlockProducerId] ?? 0
    if (count < u.unlockProducerMin) return false
  }
  return true
}

export function getStartBits(state: GameState): number {
  const startUpgrade = PRESTIGE_UPGRADES.find(u => u.effect === 'start_bits')
  if (!startUpgrade) return 0
  const times = state.purchasedPrestigeUpgrades[startUpgrade.id] ?? 0
  return startUpgrade.value * times
}
