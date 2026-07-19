import type { GameState } from './types'
import { PRODUCERS, UPGRADES, PRESTIGE_UPGRADES, COST_SCALING, DEFAULT_OFFLINE_CAP_HOURS, MILESTONE_THRESHOLDS } from './constants'
import { calcAchievementMultiplier } from './achievements'

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

export function calcProducerCost(producerId: string, owned: number): number {
  const def = PRODUCERS.find(p => p.id === producerId)
  if (!def) return Infinity
  return Math.ceil(def.baseCost * Math.pow(COST_SCALING, owned))
}

/** Closed-form cost of buying `qty` consecutive units of a producer starting at `owned`. */
export function calcBulkProducerCost(producerId: string, owned: number, qty: number): number {
  const def = PRODUCERS.find(p => p.id === producerId)
  if (!def || qty <= 0) return 0
  const r = COST_SCALING
  const raw = def.baseCost * Math.pow(r, owned) * (Math.pow(r, qty) - 1) / (r - 1)
  return Math.ceil(raw)
}

/** Max units of a producer affordable with `bits`, starting at `owned`. */
export function calcMaxAffordable(producerId: string, owned: number, bits: number): number {
  const def = PRODUCERS.find(p => p.id === producerId)
  if (!def) return 0
  const r = COST_SCALING
  const firstCost = def.baseCost * Math.pow(r, owned)
  if (bits < firstCost) return 0
  const rhs = (bits * (r - 1)) / firstCost + 1
  let n = Math.max(0, Math.floor(Math.log(rhs) / Math.log(r)))
  // Correct for floating-point drift against the actual ceil'd cost
  for (let i = 0; i < 5 && n > 0 && calcBulkProducerCost(producerId, owned, n) > bits; i++) n--
  for (let i = 0; i < 5 && calcBulkProducerCost(producerId, owned, n + 1) <= bits; i++) n++
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
  return mult
}

export function calcGlobalMultiplier(state: GameState): number {
  let mult = 1
  const prestigeGlobalUpgrade = PRESTIGE_UPGRADES.find(u => u.effect === 'global_multiplier')
  if (prestigeGlobalUpgrade) {
    const times = state.purchasedPrestigeUpgrades[prestigeGlobalUpgrade.id] ?? 0
    if (times > 0) mult *= Math.pow(prestigeGlobalUpgrade.value, times)
  }
  mult *= calcAchievementMultiplier(state)
  return mult
}

export function calcMilestoneMultiplier(producerId: string, state: GameState): number {
  const owned = state.producers[producerId] ?? 0
  const reached = MILESTONE_THRESHOLDS.filter(t => owned >= t).length
  return Math.pow(2, reached)
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

export function calcBitsPerClick(state: GameState): number {
  const bps = calcBitsPerSecond(state)
  const base = Math.max(1, bps * 0.01)
  const globalMult = calcGlobalMultiplier(state)
  const clickMult = calcClickMultiplier(state)
  return base * clickMult * globalMult
}

export function calcGhostCreditsFromBits(totalBitsEarned: number, state: GameState): number {
  const base = Math.floor(Math.sqrt(totalBitsEarned / 1_000_000))
  const ghostBonusUpgrade = PRESTIGE_UPGRADES.find(u => u.effect === 'ghost_bonus')
  let bonusMult = 1
  if (ghostBonusUpgrade) {
    const times = state.purchasedPrestigeUpgrades[ghostBonusUpgrade.id] ?? 0
    bonusMult = 1 + ghostBonusUpgrade.value * times
  }
  return Math.floor(base * bonusMult)
}

export function calcOfflineEfficiency(state: GameState): number {
  let base = 0.5
  const offlineUpgrade = PRESTIGE_UPGRADES.find(u => u.effect === 'offline_efficiency')
  if (offlineUpgrade) {
    const times = state.purchasedPrestigeUpgrades[offlineUpgrade.id] ?? 0
    base += offlineUpgrade.value * times
  }
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
