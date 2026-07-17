import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://supabase.westmeier.tech'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc0Mjc4ODUxLCJleHAiOjE5MzE5NTg4NTF9.HxwIv6QkUx5P0CqZdaI077nghSrMqpWotBpdV7wp1JE'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export interface LeaderboardEntry {
  rank: number
  player_id: string
  name: string
  total_bits_earned: number
  prestige_count: number
  updated_at: string
}

export async function submitScore(
  playerId: string,
  name: string,
  totalBitsEarned: number,
  prestigeCount: number
): Promise<void> {
  await supabase.from('null_byte_leaderboard').upsert(
    {
      player_id: playerId,
      name,
      total_bits_earned: totalBitsEarned,
      prestige_count: prestigeCount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'player_id' }
  )
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('null_byte_leaderboard')
    .select('player_id, name, total_bits_earned, prestige_count, updated_at')
    .order('total_bits_earned', { ascending: false })
    .limit(50)

  if (error || !data) return []

  return data.map((row, i) => ({ ...row, rank: i + 1 }))
}

export async function getPlayerRank(playerId: string): Promise<number | null> {
  const { count } = await supabase
    .from('null_byte_leaderboard')
    .select('*', { count: 'exact', head: true })
    .gt('total_bits_earned',
      (await supabase
        .from('null_byte_leaderboard')
        .select('total_bits_earned')
        .eq('player_id', playerId)
        .single()
      ).data?.total_bits_earned ?? 0
    )
  return count !== null ? count + 1 : null
}
