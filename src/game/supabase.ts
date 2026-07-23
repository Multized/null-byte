import { createClient } from '@supabase/supabase-js'
import type { GameState } from './types'
import { calcDefenseRating } from './utils'
import { getSerializableState } from './store'

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
  ascension_count: number
  defense_rating: number
  updated_at: string
  active_title: string | null
}

const LEADERBOARD_COLUMNS =
  'player_id, name, name_tag, total_bits_earned, prestige_count, ascension_count, defense_rating, updated_at, active_title'

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
    // Store only the persistent state in game_state — the raw store also carries transient
    // timers (overclock/event/penalty) and computed fields, which would otherwise ride along
    // and be re-applied on a cross-device sync load.
    const persisted = getSerializableState()
    const { error } = await supabase.rpc('nb_submit_score', {
      p_player_id: state.playerId,
      p_sync_code: state.syncCode,
      p_name: state.playerName,
      p_name_tag: state.playerTag || '0000',
      p_bits: state.totalBitsEarned,
      p_prestige: state.prestigeCount,
      p_state: persisted,
      p_defense_rating: calcDefenseRating(state),
      p_ascension_count: state.ascensionCount ?? 0,
    })
    if (error) console.warn('Score submit failed:', error.message)
  } catch (e) {
    console.warn('Score submit failed:', e)
  }
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  // Progression order: ascension first, then prestige, then bits (which reset per
  // prestige and so would rank a fresh veteran near the bottom if used as the primary key).
  const { data, error } = await supabase
    .from('null_byte_leaderboard_public')
    .select(LEADERBOARD_COLUMNS)
    .order('ascension_count', { ascending: false })
    .order('prestige_count', { ascending: false })
    .order('total_bits_earned', { ascending: false })
    .limit(50)

  if (error || !data) return []
  return data.map((row, i) => ({ ...row, rank: i + 1 } as LeaderboardEntry))
}

/**
 * The player's own standing when they're outside the fetched top slice: their public
 * row plus an exact rank (count of everyone ranked strictly above, +1). Returns null if
 * the player has no row yet.
 */
export async function fetchMyStanding(state: GameState): Promise<LeaderboardEntry | null> {
  const asc = state.ascensionCount ?? 0
  const pres = state.prestigeCount ?? 0
  // toFixed(0) keeps large values in plain digits — a template literal would render
  // >=1e21 as "1e+21", which PostgREST rejects as a numeric filter value.
  const bits = (state.totalBitsEarned ?? 0).toFixed(0)

  const { count } = await supabase
    .from('null_byte_leaderboard_public')
    .select('player_id', { count: 'exact', head: true })
    .or(
      `ascension_count.gt.${asc},` +
      `and(ascension_count.eq.${asc},prestige_count.gt.${pres}),` +
      `and(ascension_count.eq.${asc},prestige_count.eq.${pres},total_bits_earned.gt.${bits})`,
    )

  const { data } = await supabase
    .from('null_byte_leaderboard_public')
    .select(LEADERBOARD_COLUMNS)
    .eq('player_id', state.playerId)
    .maybeSingle()

  if (!data) return null
  return { ...(data as object), rank: (count ?? 0) + 1 } as LeaderboardEntry
}

// ---- Raiding (phase 3a) ------------------------------------------------------

import type { RaidTarget } from './raid'

/** Find one raid target — a random eligible opponent's base snapshot. */
export async function fetchRaidTarget(playerId: string): Promise<RaidTarget | null> {
  const { data, error } = await supabase.rpc('nb_get_raid_target', { p_player_id: playerId })
  if (error || !data || data.length === 0) return null
  const row = data[0]
  return {
    playerId: row.player_id,
    name: row.name,
    nameTag: row.name_tag,
    defenseRating: row.defense_rating ?? 0,
    totalBitsEarned: row.total_bits_earned ?? 0,
    chipCells: (row.chip_cells ?? {}) as RaidTarget['chipCells'],
  }
}

/** Report a raid outcome so the defender is shielded (on a breach) or paid a bounty (on a repel). */
export async function resolveRaid(attackerId: string, targetId: string, won: boolean): Promise<void> {
  try {
    await supabase.rpc('nb_resolve_raid', { p_attacker_id: attackerId, p_target_id: targetId, p_won: won })
  } catch (e) {
    console.warn('Raid resolve failed:', e)
  }
}

/** Claim (and clear) bits owed to you for raids your base repelled while you were away. */
export async function claimBounty(playerId: string, syncCode: string): Promise<number> {
  const { data, error } = await supabase.rpc('nb_claim_bounty', { p_player_id: playerId, p_sync_code: syncCode })
  if (error || typeof data !== 'number') return 0
  return data
}

export async function loadFromSyncCode(code: string): Promise<GameState | null> {
  const { data, error } = await supabase.rpc('nb_load_by_sync_code', {
    p_code: normalizeSyncCode(code),
  })
  if (error || !data) return null
  return data as GameState
}
