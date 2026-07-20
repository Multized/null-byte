import type { GameState } from './types'
import { useGameStore, getSerializableState, generateSyncCode, randomTag, defaultGameState } from './store'
import { calcBitsPerSecond, getOfflineCapHours, calcOfflineEfficiency } from './utils'
import { SAVE_KEY, SAVE_EPOCH, GC_CAP_BASE, GC_CAP_PER_PRESTIGE } from './constants'

/** True when this save predates the current epoch and its progress must be wiped. */
export function isStaleEpoch(data: Pick<GameState, 'saveEpoch'>): boolean {
  return (data.saveEpoch ?? 1) < SAVE_EPOCH
}

/**
 * Ghost Credits used to be uncapped and grew geometrically — old saves can hold millions,
 * which would buy out the entire rebalanced shop instantly. Clamp them to what the same
 * number of prestiges would earn under the current cap (the sum of every per-prestige cap
 * up to `prestigeCount`), so old progress still counts without skipping the new economy.
 */
function clampLegacyGhostCredits(ghostCredits: number, prestigeCount: number): number {
  const p = Math.max(0, prestigeCount)
  const maxEarnable = p * GC_CAP_BASE + GC_CAP_PER_PRESTIGE * (p * (p - 1)) / 2
  return Math.min(ghostCredits, maxEarnable)
}

export function saveGame(): void {
  try {
    const state = getSerializableState()
    state.lastActive = Date.now()
    localStorage.setItem(SAVE_KEY, JSON.stringify(state))
  } catch (e) {
    console.error('Save failed:', e)
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as GameState
    // Sanity checks
    if (typeof data.bits !== 'number') return null

    // Epoch reset: wipe progress but keep who the player is, so their leaderboard row
    // gets overwritten with the fresh run instead of lingering as a stale entry.
    if (isStaleEpoch(data)) {
      return {
        ...defaultGameState(),
        saveEpoch: SAVE_EPOCH,
        playerId: data.playerId || crypto.randomUUID(),
        playerName: data.playerName ?? '',
        playerTag: data.playerTag || randomTag(),
        syncCode: data.syncCode || generateSyncCode(),
      }
    }

    return {
      saveEpoch: SAVE_EPOCH,
      bits: data.bits ?? 0,
      totalBitsEarned: data.totalBitsEarned ?? 0,
      ghostCredits: clampLegacyGhostCredits(data.ghostCredits ?? 0, data.prestigeCount ?? 0),
      totalGhostCreditsEarned: data.totalGhostCreditsEarned ?? 0,
      producers: data.producers ?? {},
      purchasedUpgrades: data.purchasedUpgrades ?? [],
      purchasedPrestigeUpgrades: data.purchasedPrestigeUpgrades ?? {},
      prestigeCount: data.prestigeCount ?? 0,
      lastActive: data.lastActive ?? Date.now(),
      playerId: data.playerId || crypto.randomUUID(),
      playerName: data.playerName ?? '',
      playerTag: data.playerTag || randomTag(),
      syncCode: data.syncCode || generateSyncCode(),
      totalClicks: data.totalClicks ?? 0,
      totalEventsClaimed: data.totalEventsClaimed ?? 0,
      maxCombo: data.maxCombo ?? 0,
      unlockedAchievements: data.unlockedAchievements ?? [],
      totalPlaytimeSeconds: data.totalPlaytimeSeconds ?? 0,
      packetsCaught: data.packetsCaught ?? 0,
      totalProducersBought: data.totalProducersBought ?? 0,
      totalUpgradesBought: data.totalUpgradesBought ?? 0,
      contractsCompleted: data.contractsCompleted ?? 0,
      activeContracts: data.activeContracts ?? [],
      dailyStreak: data.dailyStreak ?? 0,
      lastDailyClaim: data.lastDailyClaim ?? '',
      activeQuestId: data.activeQuestId ?? null,
      questStepIndex: data.questStepIndex ?? 0,
      questStepBaseline: data.questStepBaseline ?? 0,
      completedQuests: data.completedQuests ?? [],
      earnedTitles: data.earnedTitles ?? [],
      earnedArtifacts: data.earnedArtifacts ?? [],
      activeTitle: data.activeTitle ?? null,
      autoBuyEnabled: data.autoBuyEnabled ?? true,
      decisionsMade: data.decisionsMade ?? 0,
      gamblesWon: data.gamblesWon ?? 0,
    }
  } catch (e) {
    console.error('Load failed:', e)
    return null
  }
}

export function deleteGame(): void {
  localStorage.removeItem(SAVE_KEY)
}

export interface OfflineResult {
  earnings: number
  seconds: number
  cappedAt: number
}

export function calcOfflineEarnings(state: GameState): OfflineResult {
  const now = Date.now()
  const elapsed = (now - state.lastActive) / 1000
  const capSeconds = getOfflineCapHours(state) * 3600
  const cappedSeconds = Math.min(elapsed, capSeconds)
  const bps = calcBitsPerSecond(state)
  const earnings = bps * cappedSeconds * calcOfflineEfficiency(state)
  return {
    earnings,
    seconds: cappedSeconds,
    cappedAt: capSeconds,
  }
}

export function exportSave(): string {
  const state = getSerializableState()
  return btoa(JSON.stringify(state))
}

export function importSave(encoded: string): boolean {
  try {
    const raw = atob(encoded)
    const data = JSON.parse(raw) as GameState
    if (typeof data.bits !== 'number') return false
    // Don't let a pre-epoch export smuggle old progress back in
    if (isStaleEpoch(data)) return false
    useGameStore.getState().loadState(data)
    saveGame()
    return true
  } catch {
    return false
  }
}
