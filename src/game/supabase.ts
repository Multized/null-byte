import { createClient } from '@supabase/supabase-js'
import type { GameState } from './types'

const SUPABASE_URL = 'https://supabase.westmeier.tech'
// Public by design; all authorisation happens server-side. The client has no direct
// access to null_byte_leaderboard — reads go through the public view, writes and the
// sync-code lookup through SECURITY DEFINER functions (see supabase/migrations).
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc0Mjc4ODUxLCJleHAiOjE5MzE5NTg4NTF9.HxwIv6QkUx5P0CqZdaI077nghSrMqpWotBpdV7wp1JE'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export interface LeaderboardEntry {
  rank: number
  player_id: string
  name: string
  name_tag: string
  total_bits_earned: number
  prestige_count: number
  updated_at: string
  active_title: string | null
}

/** True for the old 6-char sync codes, which are weak enough to be worth rotating. */
export function isLegacySyncCode(code: string): boolean {
  return code.replace(/[^A-Z0-9]/gi, '').length === 6
}

/**
 * Swaps a legacy sync code for a fresh one. Returns true only when the server confirmed
 * the swap (or has no row yet) — the caller must keep the old code otherwise, because
 * adopting a code the stored row does not have would lock the player out of saving.
 */
export async function rotateSyncCode(
  playerId: string,
  oldCode: string,
  newCode: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('nb_rotate_sync_code', {
    p_player_id: playerId,
    p_old_code: oldCode,
    p_new_code: newCode,
  })
  if (error) return false
  return data === true
}

/** Normalises user-typed sync codes to the stored format (XXX-XXX or XXXX-XXXX-XXXX). */
export function normalizeSyncCode(code: string): string {
  const raw = code.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (raw.length === 12) return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`
  if (raw.length === 6) return `${raw.slice(0, 3)}-${raw.slice(3)}`
  return code.toUpperCase()
}

// Check if a name+tag combo is taken by someone else
export async function isNameTagTaken(name: string, tag: string, excludePlayerId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('nb_is_name_tag_taken', {
    p_name: name,
    p_name_tag: tag,
    p_player_id: excludePlayerId,
  })
  if (error) return false
  return data === true
}

// Find a free tag for a given name (tries up to 20 random tags)
export async function findFreeTag(name: string, playerId: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const tag = String(Math.floor(Math.random() * 9000) + 1000)
    const taken = await isNameTagTaken(name, tag, playerId)
    if (!taken) return tag
  }
  // Fallback: use timestamp-based tag
  return String(Date.now()).slice(-4)
}

export async function submitScore(state: GameState): Promise<void> {
  if (!state.playerId || !state.syncCode || !state.playerName) return
  try {
    const { error } = await supabase.rpc('nb_submit_score', {
      p_player_id: state.playerId,
      p_sync_code: state.syncCode,
      p_name: state.playerName,
      p_name_tag: state.playerTag || '0000',
      p_bits: state.totalBitsEarned,
      p_prestige: state.prestigeCount,
      p_state: state,
    })
    if (error) console.warn('Score submit failed:', error.message)
  } catch (e) {
    console.warn('Score submit failed:', e)
  }
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('null_byte_leaderboard_public')
    .select('player_id, name, name_tag, total_bits_earned, prestige_count, updated_at, active_title')
    .order('total_bits_earned', { ascending: false })
    .limit(50)

  if (error || !data) return []
  return data.map((row, i) => ({ ...row, rank: i + 1 } as LeaderboardEntry))
}

export async function loadFromSyncCode(code: string): Promise<GameState | null> {
  const { data, error } = await supabase.rpc('nb_load_by_sync_code', {
    p_code: normalizeSyncCode(code),
  })
  if (error || !data) return null
  return data as GameState
}
