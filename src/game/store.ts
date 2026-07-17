import { create } from 'zustand'
import type { GameState } from './types'
import {
  calcBitsPerSecond,
  calcBitsPerClick,
  calcGhostCreditsFromBits,
  calcProducerCost,
  getStartBits,
  isUpgradeUnlocked,
} from './utils'
import { UPGRADES, PRESTIGE_UPGRADES, PRESTIGE_UNLOCK_BITS } from './constants'

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
  }
}

interface GameStore extends GameState {
  // Computed (not persisted)
  bitsPerSecond: number
  bitsPerClick: number

  // Actions
  click: () => number
  tick: (delta: number) => void
  buyProducer: (id: string) => boolean
  buyUpgrade: (id: string) => boolean
  prestige: () => void
  buyPrestigeUpgrade: (id: string) => boolean
  loadState: (state: GameState) => void
  updateLastActive: () => void
  setPlayerName: (name: string, tag: string) => void
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

  click: () => {
    const state = get()
    const bpc = calcBitsPerClick(state)
    set(s => {
      const next: Partial<GameState> = {
        bits: s.bits + bpc,
        totalBitsEarned: s.totalBitsEarned + bpc,
      }
      return { ...next, ...computeDerived({ ...s, ...next }) }
    })
    return bpc
  },

  tick: (delta: number) => {
    const state = get()
    const bps = calcBitsPerSecond(state)
    const earned = bps * delta
    if (earned <= 0) return
    set(s => {
      const next: Partial<GameState> = {
        bits: s.bits + earned,
        totalBitsEarned: s.totalBitsEarned + earned,
      }
      return { ...next, ...computeDerived({ ...s, ...next }) }
    })
  },

  buyProducer: (id: string) => {
    const state = get()
    const owned = state.producers[id] ?? 0
    const cost = calcProducerCost(id, owned)
    if (state.bits < cost) return false
    set(s => {
      const producers = { ...s.producers, [id]: (s.producers[id] ?? 0) + 1 }
      const next: Partial<GameState> = {
        bits: s.bits - cost,
        producers,
      }
      return { ...next, ...computeDerived({ ...s, ...next }) }
    })
    return true
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
      }
      return { ...next, ...computeDerived({ ...s, ...next }) }
    })
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
  }
}

export { randomAnonName, randomTag, generateSyncCode }
