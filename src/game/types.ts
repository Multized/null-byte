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

export interface AscensionUpgradeDef {
  id: string
  name: string
  description: string
  flavor: string
  cost: number
  /** Per-level cost multiplier; each already-owned level multiplies the price. Default 1 = flat. */
  costGrowth?: number
  effect: 'global_multiplier' | 'gc_gain' | 'prestige_boost' | 'gc_headstart'
  value: number
  maxPurchases: number
}

export type ChipEffect = 'production' | 'click' | 'offline' | 'contract' | 'bus'

export interface ChipModuleDef {
  id: string
  name: string
  glyph: string
  flavor: string
  accent: 'cyan' | 'emerald' | 'amber' | 'purple' | 'red'
  effect: ChipEffect
  /** Bonus per level for economy modules (Bus has none; it boosts neighbours). */
  perLevel: number
  placeCost: number
  placeGrowth: number
  upgradeCost: number
  upgradeGrowth: number
}

/** One placed module on the chip die. */
export interface ChipCell {
  type: string
  level: number
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
  /**
   * Best combo reached while THIS contract was active. `reach_combo` needs its own
   * counter because `maxCombo` is a lifetime high-water mark — once it sat at the cap,
   * the usual `counter - baseline` progress was permanently 0.
   */
  bestCombo?: number
}

export interface GameState {
  /** Progress-reset marker; see SAVE_EPOCH. Absent on saves written before it existed. */
  saveEpoch?: number
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
  // ---- Ascension (second prestige layer) ----
  rootKeys: number
  totalRootKeysEarned: number
  ascensionCount: number
  /** totalGhostCreditsEarned at the last ascension; the earn formula measures from here. */
  ghostCreditsAtLastAscension: number
  purchasedAscensionUpgrades: Record<string, number>
  // ---- The Chip (base-building) ----
  /** Placed modules keyed by cell index ("0".."35" on a 6×6 die). Permanent across resets. */
  chipCells: Record<string, ChipCell>
}
