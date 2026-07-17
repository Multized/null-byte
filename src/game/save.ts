import type { GameState } from './types'
import { useGameStore, getSerializableState } from './store'
import { calcBitsPerSecond, getOfflineCapHours } from './utils'
import { SAVE_KEY } from './constants'

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
    return {
      bits: data.bits ?? 0,
      totalBitsEarned: data.totalBitsEarned ?? 0,
      ghostCredits: data.ghostCredits ?? 0,
      totalGhostCreditsEarned: data.totalGhostCreditsEarned ?? 0,
      producers: data.producers ?? {},
      purchasedUpgrades: data.purchasedUpgrades ?? [],
      purchasedPrestigeUpgrades: data.purchasedPrestigeUpgrades ?? {},
      prestigeCount: data.prestigeCount ?? 0,
      lastActive: data.lastActive ?? Date.now(),
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
  const earnings = bps * cappedSeconds * 0.5 // 50% offline efficiency
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
    useGameStore.getState().loadState(data)
    saveGame()
    return true
  } catch {
    return false
  }
}
