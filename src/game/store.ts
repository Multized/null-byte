import { create } from 'zustand'
import type { GameState, ActiveContract } from './types'
import {
  calcBitsPerSecond,
  calcBitsPerClick,
  calcGhostCreditsFromBits,
  calcMaxAffordable,
  calcBulkProducerCost,
  getStartBits,
  getStartProducers,
  keptUpgradeCount,
  canPrestige,
  canAscend,
  calcRootKeysFromAscension,
  getAscensionHeadstartGc,
  ascensionUpgradeCost,
  chipPlaceCost,
  chipUpgradeCost,
  regenOverdriveEnergy,
  isUpgradeUnlocked,
  hasAutoBuy,
  prestigeUpgradeCost,
} from './utils'
import { UPGRADES, PRESTIGE_UPGRADES, ASCENSION_UPGRADES, CHIP_MODULES, CHIP_MODULE_MAX_LEVEL, MILESTONE_THRESHOLDS, PRODUCERS, SAVE_EPOCH, OVERCLOCK_MULT, OVERCLOCK_DURATION_MS, OVERDRIVE_ENERGY_MAX } from './constants'
import { findNewlyUnlocked } from './achievements'
import { rollContract, isContractComplete } from './contracts'
import { nextAvailableQuest, questById, isStepComplete, artifactContractSlots } from './quests'
import type { DilemmaOutcome } from './dilemmas'
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
  // 12 chars over a 32-char alphabet (~1.15e18). The sync code is the only secret
  // guarding a save, and the lookup RPC can be called freely, so the old 6-char code
  // (~1.07e9) was within reach of a blind sweep once enough players existed.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const groups: string[] = []
  for (let g = 0; g < 3; g++) {
    let part = ''
    for (let i = 0; i < 4; i++) {
      part += chars[Math.floor(Math.random() * chars.length)]
    }
    groups.push(part)
  }
  return groups.join('-')
}

function randomTag(): string {
  return String(Math.floor(Math.random() * 9000) + 1000)
}

function defaultState(): GameState {
  return {
    saveEpoch: SAVE_EPOCH,
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
    activeQuestId: null,
    questStepIndex: 0,
    questStepBaseline: 0,
    completedQuests: [],
    earnedTitles: [],
    earnedArtifacts: [],
    activeTitle: null,
    autoBuyEnabled: true,
    decisionsMade: 0,
    gamblesWon: 0,
    rootKeys: 0,
    totalRootKeysEarned: 0,
    ascensionCount: 0,
    ghostCreditsAtLastAscension: 0,
    purchasedAscensionUpgrades: {},
    chipCells: {},
    overdriveEnergy: OVERDRIVE_ENERGY_MAX,
    lastEnergyRegen: Date.now(),
    overdrivesUsed: 0,
    chipModulesPlaced: 0,
    lastRaidAt: 0,
    raidsWon: 0,
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

  // Dilemma penalty debuff (not persisted)
  penaltyMultiplier: number
  penaltyExpiresAt: number

  // Overdrive — active window end (not persisted; energy itself IS persisted in GameState)
  overclockActiveUntil: number

  // Actions
  click: (comboMultiplier?: number) => number
  tick: (delta: number) => void
  buyProducer: (id: string, qty?: number) => { bought: number; cost: number; milestoneReached: number | null }
  buyUpgrade: (id: string) => boolean
  prestige: () => void
  buyPrestigeUpgrade: (id: string) => boolean
  ascend: () => void
  buyAscensionUpgrade: (id: string) => boolean
  activateOverclock: () => boolean
  placeChipModule: (cell: number, type: string) => boolean
  upgradeChipModule: (cell: number) => boolean
  removeChipModule: (cell: number) => boolean
  recordRaid: (won: boolean, loot: number) => void
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
  syncQuest: () => void
  claimQuest: () => { questId: string; title?: string; artifact?: string } | null
  setActiveTitle: (id: string | null) => void
  setAutoBuyEnabled: (enabled: boolean) => void
  activatePenalty: (multiplier: number, durationMs: number) => void
  applyDilemmaOutcome: (outcome: DilemmaOutcome) => void
  resetAll: () => void
}

function computeDerived(state: GameState) {
  // Compute bps once and hand it to calcBitsPerClick, which would otherwise recompute it —
  // this runs on every state update (10× a second via tick), so the saving is worth it.
  const bitsPerSecond = calcBitsPerSecond(state)
  return {
    bitsPerSecond,
    bitsPerClick: calcBitsPerClick(state, bitsPerSecond),
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...defaultState(),
  bitsPerSecond: 0,
  bitsPerClick: 1,
  eventBpsMultiplier: 1,
  eventClickMultiplier: 1,
  eventExpiresAt: 0,
  penaltyMultiplier: 1,
  penaltyExpiresAt: 0,
  overclockActiveUntil: 0,

  click: (comboMultiplier = 1) => {
    const state = get()
    const now = Date.now()
    const clickMult = now < state.eventExpiresAt ? state.eventClickMultiplier : 1
    const overclockMult = now < state.overclockActiveUntil ? OVERCLOCK_MULT : 1
    const bpc = calcBitsPerClick(state) * clickMult * overclockMult * comboMultiplier
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
    // Expire dilemma penalty
    if (state.penaltyExpiresAt > 0 && now >= state.penaltyExpiresAt) {
      set({ penaltyMultiplier: 1, penaltyExpiresAt: 0 })
    }
    // Materialise Overdrive energy regen. Only writes when a whole interval has elapsed
    // (~every 15 min, incl. offline time caught up on the first tick after load), so this
    // is effectively free per tick.
    if (state.overdriveEnergy < OVERDRIVE_ENERGY_MAX) {
      const r = regenOverdriveEnergy(state.overdriveEnergy, state.lastEnergyRegen, now)
      if (r.energy !== state.overdriveEnergy) set({ overdriveEnergy: r.energy, lastEnergyRegen: r.lastRegen })
    }
    const bpsMult = now < state.eventExpiresAt ? state.eventBpsMultiplier : 1
    const penaltyMult = now < state.penaltyExpiresAt ? state.penaltyMultiplier : 1
    const overclockMult = now < state.overclockActiveUntil ? OVERCLOCK_MULT : 1
    const bps = calcBitsPerSecond(state) * bpsMult * penaltyMult * overclockMult
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

    if (hasAutoBuy(get()) && get().autoBuyEnabled) {
      const s = get()
      let cheapestId: string | null = null
      let cheapestCost = Infinity
      for (const def of PRODUCERS) {
        const owned = s.producers[def.id] ?? 0
        const cost = calcBulkProducerCost(def.id, owned, 1, s)
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
    const maxAffordable = calcMaxAffordable(id, owned, state.bits, state)
    const actualQty = Math.min(qty, maxAffordable)
    if (actualQty <= 0) return { bought: 0, cost: 0, milestoneReached: null }
    const cost = calcBulkProducerCost(id, owned, actualQty, state)
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
    if (!canPrestige(state)) return
    const earned = calcGhostCreditsFromBits(state.totalBitsEarned, state)
    const startBits = getStartBits(state)
    const startProducers = getStartProducers(state)
    // "Versteckte Partition" keeps the cheapest purchased upgrades across the reset —
    // cheapest first so the head start is a smooth ramp, not an endgame upgrade carried over.
    const keep = keptUpgradeCount(state)
    const keptUpgrades = keep === 0
      ? []
      : [...state.purchasedUpgrades]
          .sort((a, b) => {
            const ua = UPGRADES.find(u => u.id === a)
            const ub = UPGRADES.find(u => u.id === b)
            return (ua?.cost ?? 0) - (ub?.cost ?? 0)
          })
          .slice(0, keep)
    set(s => {
      const next: Partial<GameState> = {
        bits: startBits,
        totalBitsEarned: startBits,
        ghostCredits: s.ghostCredits + earned,
        totalGhostCreditsEarned: s.totalGhostCreditsEarned + earned,
        producers: startProducers,
        purchasedUpgrades: keptUpgrades,
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
    const cost = prestigeUpgradeCost(upgrade, timesBought)
    if (state.ghostCredits < cost) return false
    set(s => {
      const purchasedPrestigeUpgrades = {
        ...s.purchasedPrestigeUpgrades,
        [id]: timesBought + 1,
      }
      const next: Partial<GameState> = {
        ghostCredits: s.ghostCredits - cost,
        purchasedPrestigeUpgrades,
      }
      return { ...next, ...computeDerived({ ...s, ...next }) }
    })
    get().checkAchievements()
    return true
  },

  ascend: () => {
    const state = get()
    if (!canAscend(state)) return
    const earnedKeys = calcRootKeysFromAscension(state)
    // Everything below the ascension layer is wiped; the layer itself and identity stay.
    // The head-start GC seed lets the ascension upgrade shortcut the early ghost grind.
    set(s => {
      const headstartGc = getAscensionHeadstartGc(s)
      const next: Partial<GameState> = {
        bits: 0,
        totalBitsEarned: 0,
        ghostCredits: headstartGc,
        // lifetime totalGhostCreditsEarned is kept (achievements/leaderboard); the ascension
        // earn formula measures from ghostCreditsAtLastAscension, which we reset to "now".
        ghostCreditsAtLastAscension: s.totalGhostCreditsEarned,
        producers: {},
        purchasedUpgrades: [],
        purchasedPrestigeUpgrades: {},
        prestigeCount: 0,
        activeContracts: [],
        rootKeys: s.rootKeys + earnedKeys,
        totalRootKeysEarned: s.totalRootKeysEarned + earnedKeys,
        ascensionCount: s.ascensionCount + 1,
        lastActive: Date.now(),
      }
      return { ...next, ...computeDerived({ ...s, ...next } as GameState) }
    })
    get().ensureContracts()
    get().checkAchievements()
  },

  buyAscensionUpgrade: (id: string) => {
    const state = get()
    const upgrade = ASCENSION_UPGRADES.find(u => u.id === id)
    if (!upgrade) return false
    const timesBought = state.purchasedAscensionUpgrades[id] ?? 0
    if (timesBought >= upgrade.maxPurchases) return false
    const cost = ascensionUpgradeCost(upgrade, timesBought)
    if (state.rootKeys < cost) return false
    set(s => {
      const purchasedAscensionUpgrades = {
        ...s.purchasedAscensionUpgrades,
        [id]: timesBought + 1,
      }
      const next: Partial<GameState> = {
        rootKeys: s.rootKeys - cost,
        purchasedAscensionUpgrades,
      }
      return { ...next, ...computeDerived({ ...s, ...next }) }
    })
    get().checkAchievements()
    return true
  },

  activateOverclock: () => {
    const state = get()
    const now = Date.now()
    if (now < state.overclockActiveUntil) return false // already running
    // Catch up regen first so a point that just refilled is spendable.
    const { energy, lastRegen } = regenOverdriveEnergy(state.overdriveEnergy, state.lastEnergyRegen, now)
    if (energy < 1) return false
    set(s => ({
      overdriveEnergy: energy - 1,
      lastEnergyRegen: lastRegen, // regen already set the clock correctly (now if it was full)
      overclockActiveUntil: now + OVERCLOCK_DURATION_MS,
      overdrivesUsed: s.overdrivesUsed + 1,
    }))
    return true
  },

  placeChipModule: (cell: number, type: string) => {
    const state = get()
    const key = String(cell)
    if (state.chipCells[key]) return false // occupied
    if (!CHIP_MODULES.some(m => m.id === type)) return false
    const cost = chipPlaceCost(state, type)
    if (state.bits < cost) return false
    set(s => {
      const chipCells = { ...s.chipCells, [key]: { type, level: 1 } }
      const next: Partial<GameState> = { bits: s.bits - cost, chipCells, chipModulesPlaced: s.chipModulesPlaced + 1 }
      return { ...next, ...computeDerived({ ...s, ...next }) }
    })
    get().checkAchievements()
    return true
  },

  upgradeChipModule: (cell: number) => {
    const state = get()
    const key = String(cell)
    const existing = state.chipCells[key]
    if (!existing || existing.level >= CHIP_MODULE_MAX_LEVEL) return false
    const cost = chipUpgradeCost(state, key)
    if (state.bits < cost) return false
    set(s => {
      const chipCells = { ...s.chipCells, [key]: { ...existing, level: existing.level + 1 } }
      const next: Partial<GameState> = { bits: s.bits - cost, chipCells }
      return { ...next, ...computeDerived({ ...s, ...next }) }
    })
    get().checkAchievements()
    return true
  },

  recordRaid: (won: boolean, loot: number) => {
    set(s => {
      const next: Partial<GameState> = { lastRaidAt: Date.now() }
      if (won && loot > 0) {
        next.bits = s.bits + loot
        next.totalBitsEarned = s.totalBitsEarned + loot
        next.raidsWon = s.raidsWon + 1
      }
      return { ...next, ...computeDerived({ ...s, ...next }) }
    })
    get().checkAchievements()
  },

  removeChipModule: (cell: number) => {
    const state = get()
    const key = String(cell)
    if (!state.chipCells[key]) return false
    // Removing refunds nothing — placement is a commitment, keeps the puzzle meaningful.
    set(s => {
      const chipCells = { ...s.chipCells }
      delete chipCells[key]
      const next: Partial<GameState> = { chipCells }
      return { ...next, ...computeDerived({ ...s, ...next }) }
    })
    return true
  },

  loadState: (state: GameState) => {
    set({ ...state, ...computeDerived(state) })
  },

  resetAll: () => {
    const s = get()
    // Wipe all progress but keep the player's identity (name#tag) and sync/id continuity
    const fresh: GameState = {
      ...defaultState(),
      playerId: s.playerId,
      playerName: s.playerName,
      playerTag: s.playerTag,
      syncCode: s.syncCode,
    }
    set({
      ...fresh,
      ...computeDerived(fresh),
      // clear transient buffs/debuffs too
      eventBpsMultiplier: 1,
      eventClickMultiplier: 1,
      eventExpiresAt: 0,
      penaltyMultiplier: 1,
      penaltyExpiresAt: 0,
      overclockActiveUntil: 0,
    })
    get().syncQuest()
    get().ensureContracts()
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
    const state = get()
    const isNewRecord = combo > state.maxCombo
    // Must run even when it is not a new lifetime record: active reach_combo contracts
    // track their own best, otherwise they stall forever once maxCombo hits the cap.
    const needsContractUpdate = state.activeContracts.some(
      c => c.type === 'reach_combo' && combo > (c.bestCombo ?? 0)
    )
    if (!isNewRecord && !needsContractUpdate) return
    set(s => ({
      maxCombo: Math.max(s.maxCombo, combo),
      activeContracts: needsContractUpdate
        ? s.activeContracts.map(c =>
            c.type === 'reach_combo' && combo > (c.bestCombo ?? 0)
              ? { ...c, bestCombo: combo }
              : c
          )
        : s.activeContracts,
    }))
    get().checkAchievements()
  },

  recordPacketCaught: () => {
    set(s => ({ packetsCaught: s.packetsCaught + 1 }))
    get().checkAchievements()
  },

  ensureContracts: () => {
    let state = get()
    const slots = 3 + artifactContractSlots(state)
    while (state.activeContracts.length < slots) {
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
    const reward = Math.max(50, Math.ceil(calcBitsPerSecond(state) * 300 * Math.min(streak, 7)))
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

  syncQuest: () => {
    let state = get()

    // Assign a quest if none is active
    if (!state.activeQuestId) {
      const quest = nextAvailableQuest(state)
      if (!quest) return
      const firstStep = quest.steps[0]
      set({
        activeQuestId: quest.id,
        questStepIndex: 0,
        questStepBaseline: firstStep.metric(state),
      })
      state = get()
    }

    // Auto-advance through completed intermediate steps (the final step waits for a manual claim)
    const quest = questById(state.activeQuestId!)
    if (!quest) return
    while (state.questStepIndex < quest.steps.length - 1) {
      const step = quest.steps[state.questStepIndex]
      if (!isStepComplete(step, state.questStepBaseline, state)) break
      const nextIndex = state.questStepIndex + 1
      const nextStep = quest.steps[nextIndex]
      set({
        questStepIndex: nextIndex,
        questStepBaseline: nextStep.metric(state),
      })
      state = get()
    }
  },

  claimQuest: () => {
    const state = get()
    if (!state.activeQuestId) return null
    const quest = questById(state.activeQuestId)
    if (!quest) return null
    // Only claimable on the final step and once it's complete
    const onFinalStep = state.questStepIndex === quest.steps.length - 1
    const finalStep = quest.steps[quest.steps.length - 1]
    if (!onFinalStep || !isStepComplete(finalStep, state.questStepBaseline, state)) return null

    const reward = Math.max(100, Math.ceil(calcBitsPerSecond(state) * quest.rewardBitsSeconds))
    set(s => {
      const earnedTitles = quest.rewardTitle && !s.earnedTitles.includes(quest.rewardTitle)
        ? [...s.earnedTitles, quest.rewardTitle]
        : s.earnedTitles
      const earnedArtifacts = quest.rewardArtifact && !s.earnedArtifacts.includes(quest.rewardArtifact)
        ? [...s.earnedArtifacts, quest.rewardArtifact]
        : s.earnedArtifacts
      const next: Partial<GameState> = {
        bits: s.bits + reward,
        totalBitsEarned: s.totalBitsEarned + reward,
        ghostCredits: s.ghostCredits + quest.rewardGc,
        totalGhostCreditsEarned: s.totalGhostCreditsEarned + quest.rewardGc,
        completedQuests: [...s.completedQuests, quest.id],
        earnedTitles,
        earnedArtifacts,
        // Auto-equip the first title the player ever earns
        activeTitle: quest.rewardTitle && !s.activeTitle ? quest.rewardTitle : s.activeTitle,
        activeQuestId: null,
        questStepIndex: 0,
        questStepBaseline: 0,
      }
      return { ...next, ...computeDerived({ ...s, ...next }) }
    })
    get().syncQuest()
    get().checkAchievements()
    return { questId: quest.id, title: quest.rewardTitle, artifact: quest.rewardArtifact }
  },

  setActiveTitle: (id: string | null) => {
    set(s => (id === null || s.earnedTitles.includes(id) ? { activeTitle: id } : {}))
  },

  setAutoBuyEnabled: (enabled: boolean) => {
    set({ autoBuyEnabled: enabled })
  },

  activatePenalty: (multiplier: number, durationMs: number) => {
    set({ penaltyMultiplier: multiplier, penaltyExpiresAt: Date.now() + durationMs })
  },

  applyDilemmaOutcome: (outcome: DilemmaOutcome) => {
    if (outcome.bits) get().addInstantBits(outcome.bits)
    if (outcome.ghostCredits) {
      set(s => ({
        ghostCredits: Math.max(0, s.ghostCredits + outcome.ghostCredits!),
        totalGhostCreditsEarned: s.totalGhostCreditsEarned + Math.max(0, outcome.ghostCredits!),
      }))
    }
    if (outcome.bpsBuff) get().activateEventBps(outcome.bpsBuff.mult, outcome.bpsBuff.durationMs)
    if (outcome.clickBuff) get().activateEventClick(outcome.clickBuff.mult, outcome.clickBuff.durationMs)
    if (outcome.penalty) get().activatePenalty(outcome.penalty.mult, outcome.penalty.durationMs)
    set(s => ({
      decisionsMade: s.decisionsMade + 1,
      gamblesWon: outcome.won === true ? s.gamblesWon + 1 : s.gamblesWon,
    }))
    get().checkAchievements()
  },

  checkAchievements: () => {
    get().syncQuest()
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
    saveEpoch: SAVE_EPOCH,
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
    activeQuestId: s.activeQuestId,
    questStepIndex: s.questStepIndex,
    questStepBaseline: s.questStepBaseline,
    completedQuests: s.completedQuests,
    earnedTitles: s.earnedTitles,
    earnedArtifacts: s.earnedArtifacts,
    activeTitle: s.activeTitle,
    autoBuyEnabled: s.autoBuyEnabled,
    decisionsMade: s.decisionsMade,
    gamblesWon: s.gamblesWon,
    rootKeys: s.rootKeys,
    totalRootKeysEarned: s.totalRootKeysEarned,
    ascensionCount: s.ascensionCount,
    ghostCreditsAtLastAscension: s.ghostCreditsAtLastAscension,
    purchasedAscensionUpgrades: s.purchasedAscensionUpgrades,
    chipCells: s.chipCells,
    overdriveEnergy: s.overdriveEnergy,
    lastEnergyRegen: s.lastEnergyRegen,
    overdrivesUsed: s.overdrivesUsed,
    chipModulesPlaced: s.chipModulesPlaced,
    lastRaidAt: s.lastRaidAt,
    raidsWon: s.raidsWon,
  }
}

export { randomAnonName, randomTag, generateSyncCode }
/** A pristine GameState — used by the epoch reset in save.ts. */
export const defaultGameState = defaultState
