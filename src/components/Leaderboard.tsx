import { useEffect, useState } from 'react'
import { fetchLeaderboard, fetchMyStanding, submitScore, type LeaderboardEntry } from '../game/supabase'
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

const MEDAL: Record<number, string> = { 1: '👑', 2: '🥈', 3: '🥉' }

interface Props {
  onEntriesChange?: (entries: LeaderboardEntry[]) => void
}

function Row({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  const title = entry.active_title ? titleById(entry.active_title) : undefined
  return (
    <div
      className={`flex items-center gap-2 rounded px-2.5 py-2 border ${
        isMe ? 'border-cyan-700/60 bg-cyan-950/25' : 'border-slate-800/30 bg-[#0a0a10]'
      }`}
    >
      <div
        className={`font-mono text-xs w-7 text-right shrink-0 tabular-nums ${
          entry.rank === 1 ? 'text-yellow-400' :
          entry.rank === 2 ? 'text-slate-300' :
          entry.rank === 3 ? 'text-orange-400' : 'text-slate-600'
        }`}
      >
        {MEDAL[entry.rank] ?? entry.rank}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm truncate">
          {title && <span className="text-amber-400/80 mr-1" title={title.label}>{title.icon}</span>}
          <span className={isMe ? 'text-cyan-400' : 'text-slate-300'}>{entry.name}</span>
          <span className="text-purple-400/60">#{entry.name_tag}</span>
          {isMe && <span className="text-[10px] text-slate-600 ml-1">(du)</span>}
        </div>
        {/* Progression badges — the real ranking, led by ascension then prestige. */}
        <div className="flex items-center gap-2 mt-0.5 font-mono text-[10px]">
          {entry.ascension_count > 0 && (
            <span className="text-emerald-400/80" title="Ascensions">⬢ {entry.ascension_count}</span>
          )}
          {entry.prestige_count > 0 && (
            <span className="text-purple-400/70" title="Prestiges">👻 {entry.prestige_count}</span>
          )}
          {entry.defense_rating > 0 && (
            <span className="text-red-400/60" title="Defense-Rating">🛡 {entry.defense_rating.toLocaleString('de-DE')}</span>
          )}
          {entry.ascension_count === 0 && entry.prestige_count === 0 && (
            <span className="text-slate-600">Neuling</span>
          )}
        </div>
      </div>

      <div className="font-mono text-[10px] text-slate-500 shrink-0 text-right">
        <div className="text-slate-400">{formatBits(entry.total_bits_earned)}</div>
        <div className="text-slate-700">{timeAgo(entry.updated_at)}</div>
      </div>
    </div>
  )
}

export function Leaderboard({ onEntriesChange }: Props) {
  const playerId = useGameStore(s => s.playerId)

  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [myStanding, setMyStanding] = useState<LeaderboardEntry | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const data = await fetchLeaderboard()
    setEntries(data)
    onEntriesChange?.(data)
    // If I'm not in the shown slice, look up my exact standing separately.
    if (!data.some(e => e.player_id === playerId)) {
      setMyStanding(await fetchMyStanding(useGameStore.getState()))
    } else {
      setMyStanding(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    submitScore(useGameStore.getState())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex items-center justify-between px-1 mb-1">
        <div className="font-mono text-xs text-slate-600 uppercase tracking-widest">&gt; leaderboard</div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-slate-700 uppercase tracking-wider">Ascension · Prestige · Bits</span>
          <button onClick={load} className="font-mono text-[10px] text-slate-600 hover:text-cyan-400 transition-colors">
            ↻ refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="font-mono text-xs text-slate-600 text-center py-8">
          <span className="cursor-blink">_</span> loading...
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map(entry => (
            <Row key={entry.player_id} entry={entry} isMe={entry.player_id === playerId} />
          ))}
          {myStanding && (
            <>
              <div className="font-mono text-[9px] text-slate-700 text-center py-0.5">· · ·</div>
              <Row entry={myStanding} isMe />
            </>
          )}
        </div>
      )}
    </div>
  )
}
