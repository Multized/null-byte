import type { GameState } from './types'
import { PRODUCERS, UPGRADES, PRESTIGE_UPGRADES, COST_SCALING, DEFAULT_OFFLINE_CAP_HOURS } from './constants'

const BIT_UNITS = ['bits', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
const NUM_SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc']

export function formatBits(n: number): string {
  if (n < 0) return '0 bits'
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

export function calcProducerCost(producerId: string, owned: number): number {
  const def = PRODUCERS.find(p => p.id === producerId)
  if (!def) return Infinity
  return Math.ceil(def.baseCost * Math.pow(COST_SCALING, owned))
}

export function calcProducerMultiplier(producerId: string, state: GameState): number {
  let mult = 1
  const relevant = UPGRADES.filter(
    u => u.type === 'producer_multiplier' && u.target === producerId
  )
  for (const u of relevant) {
    if (state.purchasedUpgrades.includes(u.id)) {
      mult *= (u.multiplier ?? 1)
    }
  }
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
  return mult
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
