export interface ProducerDef {
  id: string
  name: string
  flavor: string
  baseCost: number
  baseBps: number
  icon: string
}

export interface UpgradeDef {
  id: string
  name: string
  description: string
  flavor: string
  cost: number
  type: 'producer_multiplier' | 'click_multiplier' | 'offline_cap'
  target?: string
  multiplier?: number
  offlineHours?: number
  unlockProducerId?: string
  unlockProducerMin?: number
  unlockBitsMin?: number
}

export interface PrestigeUpgradeDef {
  id: string
  name: string
  description: string
  flavor: string
  cost: number
  effect: 'global_multiplier' | 'click_multiplier' | 'start_bits' | 'ghost_bonus'
  value: number
  maxPurchases: number
}

export interface GameState {
  bits: number
  totalBitsEarned: number
  ghostCredits: number
  totalGhostCreditsEarned: number
  producers: Record<string, number>
  purchasedUpgrades: string[]
  purchasedPrestigeUpgrades: Record<string, number>
  prestigeCount: number
  lastActive: number
  playerId: string
  playerName: string
  playerTag: string
  syncCode: string
}
