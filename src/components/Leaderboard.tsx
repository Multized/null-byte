import { useEffect, useState } from 'react'
import { fetchLeaderboard, submitScore, type LeaderboardEntry } from '../game/supabase'
import { useGameStore } from '../game/store'
import { formatBits } from '../game/utils'
import { titleById } from '../game/quests'

export { type LeaderboardEntry }

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'gerade eben'
  if (diff < 3600) return `vor ${Math.floor(diff / 60)}m`
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)}h`
  return `vor ${Math.floor(diff / 86400)}d`
}

interface Props {
  onEntriesChange?: (entries: LeaderboardEntry[]) => void
}

export function Leaderboard({ onEntriesChange }: Props) {
  const playerId = useGameStore(s => s.playerId)

  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const data = await fetchLeaderboard()
    setEntries(data)
    onEntriesChange?.(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
    submitScore(useGameStore.getState())
  }, [])

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex items-center justify-between px-1 mb-1">
        <div className="font-mono text-xs text-slate-600 uppercase tracking-widest">
          &gt; leaderboard
        </div>
        <button onClick={load} className="font-mono text-[10px] text-slate-600 hover:text-cyan-400 transition-colors">
          ↻ refresh
        </button>
      </div>

      {loading ? (
        <div className="font-mono text-xs text-slate-600 text-center py-8">
          <span className="cursor-blink">_</span> loading...
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map(entry => {
            const isMe = entry.player_id === playerId
            return (
              <div
                key={entry.player_id}
                className={`
                  flex items-center gap-2 rounded px-2.5 py-2 border
                  ${isMe ? 'border-cyan-800/50 bg-cyan-950/20' : 'border-slate-800/30 bg-[#0a0a10]'}
                `}
              >
                <div className={`font-mono text-xs w-6 text-right shrink-0 ${
                  entry.rank === 1 ? 'text-yellow-400' :
                  entry.rank === 2 ? 'text-slate-300' :
                  entry.rank === 3 ? 'text-orange-400' : 'text-slate-600'
                }`}>
                  {entry.rank === 1 ? '👑' : entry.rank}
                </div>

                <div className="font-mono text-sm flex-1 truncate">
                  {(() => {
                    const t = entry.active_title ? titleById(entry.active_title) : undefined
                    return t ? <span className="text-amber-400/80 mr-1" title={t.label}>{t.icon}</span> : null
                  })()}
                  <span className={isMe ? 'text-cyan-400' : 'text-slate-300'}>{entry.name}</span>
                  <span className="text-purple-400/60">#{entry.name_tag}</span>
                  {isMe && <span className="text-[10px] text-slate-600 ml-1">(du)</span>}
                </div>

                {entry.prestige_count > 0 && (
                  <span className="font-mono text-[10px] text-purple-400/70 shrink-0">v{entry.prestige_count}</span>
                )}

                <div className="font-mono text-xs text-slate-400 shrink-0 text-right">
                  <div>{formatBits(entry.total_bits_earned)}</div>
                  <div className="text-[9px] text-slate-600">{timeAgo(entry.updated_at)}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
