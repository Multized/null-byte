import { createClient } from '@supabase/supabase-js'
import type { GameState } from './types'

const SUPABASE_URL = 'https://supabase.westmeier.tech'
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
}

// Check if a name+tag combo is taken by someone else
export async function isNameTagTaken(name: string, tag: string, excludePlayerId: string): Promise<boolean> {
  const { data } = await supabase
    .from('null_byte_leaderboard')
    .select('player_id')
    .eq('name', name)
    .eq('name_tag', tag)
    .neq('player_id', excludePlayerId)
    .maybeSingle()
  return !!data
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
  if (!state.playerName || !state.playerId) return
  try {
    await supabase.from('null_byte_leaderboard').upsert(
      {
        player_id: state.playerId,
        name: state.playerName,
        name_tag: state.playerTag,
        sync_code: state.syncCode,
        total_bits_earned: state.totalBitsEarned,
        prestige_count: state.prestigeCount,
        game_state: state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'player_id' }
    )
  } catch (e) {
    console.warn('Score submit failed:', e)
  }
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('null_byte_leaderboard')
    .select('player_id, name, name_tag, total_bits_earned, prestige_count, updated_at')
    .order('total_bits_earned', { ascending: false })
    .limit(50)

  if (error || !data) return []
  return data.map((row, i) => ({ ...row, rank: i + 1 }))
}

export async function loadFromSyncCode(code: string): Promise<GameState | null> {
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const formatted = normalized.length === 6 ? `${normalized.slice(0, 3)}-${normalized.slice(3)}` : code.toUpperCase()

  const { data, error } = await supabase
    .from('null_byte_leaderboard')
    .select('game_state')
    .eq('sync_code', formatted)
    .maybeSingle()

  if (error || !data?.game_state) return null
  return data.game_state as GameState
}
