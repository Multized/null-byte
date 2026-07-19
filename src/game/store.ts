import { create } from 'zustand'
import type { GameState, ActiveContract } from './types'
import {
  calcBitsPerSecond,
  calcBitsPerClick,
  calcGhostCreditsFromBits,
  calcMaxAffordable,
  calcBulkProducerCost,
  getStartBits,
  isUpgradeUnlocked,
  hasAutoBuy,
} from './utils'
import { UPGRADES, PRESTIGE_UPGRADES, PRESTIGE_UNLOCK_BITS, MILESTONE_THRESHOLDS, PRODUCERS } from './constants'
import { findNewlyUnlocked } from './achievements'
import { rollContract, isContractComplete } from './contracts'
import { emitToast } from './toastBus'

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function yesterdayString(): string {
  const d = new Date(Date.now() - 24 * 3600 * 1000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function generatePlayerId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function randomAnonName(): string {
  const words = ['ghost', 'null', 'root', 'void', 'hex', 'zero', 'byte', 'dark', 'sys', 'anon']
  const word = words[Math.floor(Math.random() * words.length)]
  return word
}

function generateSyncCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    if (i === 3) code += '-'
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

function randomTag(): string {
  return String(Math.floor(Math.random() * 9000) + 1000)
}

function defaultState(): GameState {
  return {
    bits: 0,
    totalBitsEarned: 0,
    ghostCredits: 0,
    totalGhostCreditsEarned: 0,
    producers: {},
    purchasedUpgrades: [],
    purchasedPrestigeUpgrades: {},
    prestigeCount: 0,
    lastActive: Date.now(),
    playerId: generatePlayerId(),
    playerName: '',
    playerTag: randomTag(),
    syncCode: generateSyncCode(),
    totalClicks: 0,
    totalEventsClaimed: 0,
    maxCombo: 0,
    unlockedAchievements: [],
    totalPlaytimeSeconds: 0,
    packetsCaught: 0,
    totalProducersBought: 0,
    totalUpgradesBought: 0,
    contractsCompleted: 0,
    activeContracts: [],
    dailyStreak: 0,
    lastDailyClaim: '',
  }
}

interface GameStore extends GameState {
  // Computed (not persisted)
  bitsPerSecond: number
  bitsPerClick: number

  // Event multipliers (not persisted)
  eventBpsMultiplier: number
  eventClickMultiplier: number
  eventExpiresAt: number

  // Actions
  click: (comboMultiplier?: number) => number
  tick: (delta: number) => void
  buyProducer: (id: string, qty?: number) => { bought: number; cost: number; milestoneReached: number | null }
  buyUpgrade: (id: string) => boolean
  prestige: () => void
  buyPrestigeUpgrade: (id: string) => boolean
  loadState: (state: GameState) => void
  updateLastActive: () => void
  setPlayerName: (name: string, tag: string) => void
  activateEventBps: (multiplier: number, durationMs: number) => void
  activateEventClick: (multiplier: number, durationMs: number) => void
  addInstantBits: (amount: number) => void
  recordEventClaim: () => void
  recordCombo: (combo: number) => void
  checkAchievements: () => string[]
  recordPacketCaught: () => void
  ensureContracts: () => void
  claimContract: (id: string) => ActiveContract | null
  claimDaily: () => { streak: number; reward: number } | null
}

function computeDerived(state: GameState) {
  return {
    bitsPerSecond: calcBitsPerSecond(state),
    bitsPerClick: calcBitsPerClick(state),
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...defaultState(),
  bitsPerSecond: 0,
  bitsPerClick: 1,
  eventBpsMultiplier: 1,
  eventClickMultiplier: 1,
  eventExpiresAt: 0,

  click: (comboMultiplier = 1) => {
    const state = get()
    const now = Date.now()
    const clickMult = now < state.eventExpiresAt ? state.eventClickMultiplier : 1
    const bpc = calcBitsPerClick(state) * clickMult * comboMultiplier
    set(s => {
      const next: Partial<GameState> = {
        bits: s.bits + bpc,
        totalBitsEarned: s.totalBitsEarned + bpc,
        totalClicks: s.totalClicks + 1,
      }
      return { ...next, ...computeDerived({ ...s, ...next }) }
    })
    get().checkAchievements()
    return bpc
  },

  tick: (delta: number) => {
    const state = get()
    const now = Date.now()
    // Expire event multipliers
    if (state.eventExpiresAt > 0 && now >= state.eventExpiresAt) {
      set({ eventBpsMultiplier: 1, eventClickMultiplier: 1, eventExpiresAt: 0 })
    }
    const bpsMult = now < state.eventExpiresAt ? state.eventBpsMultiplier : 1
    const bps = calcBitsPerSecond(state) * bpsMult
    const earned = bps * delta
    set(s => {
      const next: Partial<GameState> = {
        totalPlaytimeSeconds: s.totalPlaytimeSeconds + delta,
      }
      if (earned > 0) {
        next.bits = s.bits + earned
        next.totalBitsEarned = s.totalBitsEarned + earned
      }
      return { ...next, ...computeDerived({ ...s, ...next }) }
    })
    if (earned <= 0) return
    get().checkAchievements()

    if (hasAutoBuy(get())) {
      const s = get()
      let cheapestId: string | null = null
      let cheapestCost = Infinity
      for (const def of PRODUCERS) {
        const owned = s.producers[def.id] ?? 0
        const cost = calcBulkProducerCost(def.id, owned, 1)
        if (cost < cheapestCost) {
          cheapestCost = cost
          cheapestId = def.id
        }
      }
      if (cheapestId && s.bits >= cheapestCost) {
        get().buyProducer(cheapestId, 1)
      }
    }
  },

  activateEventBps: (multiplier: number, durationMs: number) => {
    set({ eventBpsMultiplier: multiplier, eventClickMultiplier: 1, eventExpiresAt: Date.now() + durationMs })
  },

  activateEventClick: (multiplier: number, durationMs: number) => {
    set({ eventClickMultiplier: multiplier, eventBpsMultiplier: 1, eventExpiresAt: Date.now() + durationMs })
  },

  addInstantBits: (amount: number) => {
    set(s => {
      const next: Partial<GameState> = {
        bits: s.bits + amount,
        totalBitsEarned: s.totalBitsEarned + amount,
      }
      return { ...next, ...computeDerived({ ...s, ...next }) }
    })
  },

  buyProducer: (id: string, qty = 1) => {
    const state = get()
    const owned = state.producers[id] ?? 0
    const maxAffordable = calcMaxAffordable(id, owned, state.bits)
    const actualQty = Math.min(qty, maxAffordable)
    if (actualQty <= 0) return { bought: 0, cost: 0, milestoneReached: null }
    const cost = calcBulkProducerCost(id, owned, actualQty)
    const newOwned = owned + actualQty
    const milestoneReached = MILESTONE_THRESHOLDS.find(t => owned < t && newOwned >= t) ?? null
    set(s => {
      const producers = { ...s.producers, [id]: newOwned }
      const next: Partial<GameState> = {
        bits: s.bits - cost,
        producers,
        totalProducersBought: s.totalProducersBought + actualQty,
      }
      return { ...next, ...computeDerived({ ...s, ...next }) }
    })
    get().checkAchievements()
    return { bought: actualQty, cost, milestoneReached }
  },

  buyUpgrade: (id: string) => {
    const state = get()
    if (state.purchasedUpgrades.includes(id)) return false
    const upgrade = UPGRADES.find(u => u.id === id)
    if (!upgrade) return false
    if (!isUpgradeUnlocked(id, state)) return false
    if (state.bits < upgrade.cost) return false
    set(s => {
      const purchasedUpgrades = [...s.purchasedUpgrades, id]
      const next: Partial<GameState> = {
        bits: s.bits - upgrade.cost,
        purchasedUpgrades,
        totalUpgradesBought: s.totalUpgradesBought + 1,
      }
      return { ...next, ...computeDerived({ ...s, ...next }) }
    })
    get().checkAchievements()
    return true
  },

  prestige: () => {
    const state = get()
    if (state.totalBitsEarned < PRESTIGE_UNLOCK_BITS) return
    const earned = calcGhostCreditsFromBits(state.totalBitsEarned, state)
    const startBits = getStartBits(state)
    set(s => {
      const next: Partial<GameState> = {
        bits: startBits,
        totalBitsEarned: startBits,
        ghostCredits: s.ghostCredits + earned,
        totalGhostCreditsEarned: s.totalGhostCreditsEarned + earned,
        producers: {},
        purchasedUpgrades: [],
        prestigeCount: s.prestigeCount + 1,
        lastActive: Date.now(),
      }
      return { ...next, ...computeDerived({ ...s, ...next } as GameState) }
    })
    get().checkAchievements()
  },

  buyPrestigeUpgrade: (id: string) => {
    const state = get()
    const upgrade = PRESTIGE_UPGRADES.find(u => u.id === id)
    if (!upgrade) return false
    const timesBought = state.purchasedPrestigeUpgrades[id] ?? 0
    if (timesBought >= upgrade.maxPurchases) return false
    if (state.ghostCredits < upgrade.cost) return false
    set(s => {
      const purchasedPrestigeUpgrades = {
        ...s.purchasedPrestigeUpgrades,
        [id]: timesBought + 1,
      }
      const next: Partial<GameState> = {
        ghostCredits: s.ghostCredits - upgrade.cost,
        purchasedPrestigeUpgrades,
      }
      return { ...next, ...computeDerived({ ...s, ...next }) }
    })
    get().checkAchievements()
    return true
  },

  loadState: (state: GameState) => {
    set({ ...state, ...computeDerived(state) })
  },

  updateLastActive: () => {
    set({ lastActive: Date.now() })
  },

  setPlayerName: (name: string, tag: string) => {
    set({ playerName: name, playerTag: tag })
  },

  recordEventClaim: () => {
    set(s => ({ totalEventsClaimed: s.totalEventsClaimed + 1 }))
    get().checkAchievements()
  },

  recordCombo: (combo: number) => {
    if (combo <= get().maxCombo) return
    set({ maxCombo: combo })
    get().checkAchievements()
  },

  recordPacketCaught: () => {
    set(s => ({ packetsCaught: s.packetsCaught + 1 }))
    get().checkAchievements()
  },

  ensureContracts: () => {
    let state = get()
    while (state.activeContracts.length < 3) {
      const contract = rollContract(state)
      set(s => ({ activeContracts: [...s.activeContracts, contract] }))
      state = get()
    }
  },

  claimContract: (id: string) => {
    const state = get()
    const contract = state.activeContracts.find(c => c.id === id)
    if (!contract || !isContractComplete(contract, state)) return null
    set(s => {
      const next: Partial<GameState> = {
        bits: s.bits + contract.reward,
        totalBitsEarned: s.totalBitsEarned + contract.reward,
        ghostCredits: s.ghostCredits + contract.rewardGc,
        totalGhostCreditsEarned: s.totalGhostCreditsEarned + contract.rewardGc,
        contractsCompleted: s.contractsCompleted + 1,
        activeContracts: s.activeContracts.filter(c => c.id !== id),
      }
      return { ...next, ...computeDerived({ ...s, ...next }) }
    })
    get().ensureContracts()
    get().checkAchievements()
    return contract
  },

  claimDaily: () => {
    const state = get()
    const today = todayString()
    if (state.lastDailyClaim === today) return null
    const streak = state.lastDailyClaim === yesterdayString() ? state.dailyStreak + 1 : 1
    const reward = Math.max(50, Math.ceil(calcBitsPerSecond(state) * 600 * Math.min(streak, 7)))
    set(s => {
      const next: Partial<GameState> = {
        bits: s.bits + reward,
        totalBitsEarned: s.totalBitsEarned + reward,
        dailyStreak: streak,
        lastDailyClaim: today,
      }
      return { ...next, ...computeDerived({ ...s, ...next }) }
    })
    get().checkAchievements()
    return { streak, reward }
  },

  checkAchievements: () => {
    const state = get()
    const newly = findNewlyUnlocked(state)
    if (newly.length === 0) return []
    set(s => {
      const unlockedAchievements = [...s.unlockedAchievements, ...newly.map(a => a.id)]
      const next: Partial<GameState> = { unlockedAchievements }
      return { ...next, ...computeDerived({ ...s, ...next }) }
    })
    for (const def of newly) emitToast({ kind: 'achievement', def })
    return newly.map(a => a.id)
  },
}))

export function getSerializableState(): GameState {
  const s = useGameStore.getState()
  return {
    bits: s.bits,
    totalBitsEarned: s.totalBitsEarned,
    ghostCredits: s.ghostCredits,
    totalGhostCreditsEarned: s.totalGhostCreditsEarned,
    producers: s.producers,
    purchasedUpgrades: s.purchasedUpgrades,
    purchasedPrestigeUpgrades: s.purchasedPrestigeUpgrades,
    prestigeCount: s.prestigeCount,
    lastActive: s.lastActive,
    playerId: s.playerId,
    playerName: s.playerName,
    playerTag: s.playerTag,
    syncCode: s.syncCode,
    totalClicks: s.totalClicks,
    totalEventsClaimed: s.totalEventsClaimed,
    maxCombo: s.maxCombo,
    unlockedAchievements: s.unlockedAchievements,
    totalPlaytimeSeconds: s.totalPlaytimeSeconds,
    packetsCaught: s.packetsCaught,
    totalProducersBought: s.totalProducersBought,
    totalUpgradesBought: s.totalUpgradesBought,
    contractsCompleted: s.contractsCompleted,
    activeContracts: s.activeContracts,
    dailyStreak: s.dailyStreak,
    lastDailyClaim: s.lastDailyClaim,
  }
}

export { randomAnonName, randomTag, generateSyncCode }
