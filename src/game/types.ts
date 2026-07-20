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
  type: 'producer_multiplier' | 'click_multiplier' | 'offline_cap' | 'synergy'
  target?: string
  multiplier?: number
  offlineHours?: number
  synergySource?: string
  synergyValue?: number
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
  /** Per-level cost multiplier; each already-owned level multiplies the price. Default 1 = flat. */
  costGrowth?: number
  effect:
    | 'global_multiplier'
    | 'click_multiplier'
    | 'start_bits'
    | 'ghost_bonus'
    | 'offline_efficiency'
    | 'auto_buy'
    | 'cost_scaling'
    | 'keep_upgrades'
    | 'milestone_boost'
    | 'start_producers'
    | 'contract_bonus'
  value: number
  maxPurchases: number
}

export type ContractType =
  | 'clicks'
  | 'buy_producers'
  | 'earn_bits'
  | 'reach_combo'
  | 'claim_event'
  | 'buy_upgrades'
  | 'catch_packet'
  | 'playtime'

export interface ActiveContract {
  id: string
  type: ContractType
  target: number
  baseline: number
  reward: number
  rewardGc: number
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
  totalClicks: number
  totalEventsClaimed: number
  maxCombo: number
  unlockedAchievements: string[]
  totalPlaytimeSeconds: number
  packetsCaught: number
  totalProducersBought: number
  totalUpgradesBought: number
  contractsCompleted: number
  activeContracts: ActiveContract[]
  dailyStreak: number
  lastDailyClaim: string
  activeQuestId: string | null
  questStepIndex: number
  questStepBaseline: number
  completedQuests: string[]
  earnedTitles: string[]
  earnedArtifacts: string[]
  activeTitle: string | null
  autoBuyEnabled: boolean
  decisionsMade: number
  gamblesWon: number
}
