import { useEffect, useState } from 'react'
import { fetchLeaderboard, type LeaderboardEntry } from '../game/supabase'
import { useGameStore } from '../game/store'
import { formatBits } from '../game/utils'

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'gerade eben'
  if (diff < 3600) return `vor ${Math.floor(diff / 60)}m`
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)}h`
  return `vor ${Math.floor(diff / 86400)}d`
}

export function Leaderboard() {
  const playerId = useGameStore(s => s.playerId)
  const playerName = useGameStore(s => s.playerName)
  const setPlayerName = useGameStore(s => s.setPlayerName)

  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  const load = async () => {
    setLoading(true)
    const data = await fetchLeaderboard()
    setEntries(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const myEntry = entries.find(e => e.player_id === playerId)
  const myRank = myEntry?.rank ?? null

  const handleRename = () => {
    const trimmed = nameInput.trim().slice(0, 24)
    if (trimmed) setPlayerName(trimmed)
    setEditingName(false)
    setNameInput('')
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex items-center justify-between px-1 mb-1">
        <div className="font-mono text-xs text-slate-600 uppercase tracking-widest">
          &gt; leaderboard
        </div>
        <button
          onClick={load}
          className="font-mono text-[10px] text-slate-600 hover:text-cyan-400 transition-colors"
        >
          ↻ refresh
        </button>
      </div>

      {/* Own position */}
      <div className="card border-cyan-900/30 p-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-500">Du:</span>
            {editingName ? (
              <input
                type="text"
                maxLength={24}
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditingName(false) }}
                autoFocus
                className="bg-transparent border-b border-cyan-600 font-mono text-sm text-slate-200 focus:outline-none w-32"
              />
            ) : (
              <span className="font-mono text-sm text-cyan-400">{playerName}</span>
            )}
          </div>
          {editingName ? (
            <button onClick={handleRename} className="font-mono text-[10px] text-cyan-400 hover:text-cyan-300">ok</button>
          ) : (
            <button onClick={() => { setEditingName(true); setNameInput(playerName) }} className="font-mono text-[10px] text-slate-600 hover:text-slate-400">umbenennen</button>
          )}
        </div>
        {myRank && (
          <div className="font-mono text-xs text-slate-500">
            Rang <span className="text-cyan-400 font-semibold">#{myRank}</span> von {entries.length}
          </div>
        )}
      </div>

      {/* Table */}
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
                  flex items-center gap-2 rounded px-2.5 py-2 border transition-all
                  ${isMe
                    ? 'border-cyan-800/50 bg-cyan-950/20'
                    : 'border-slate-800/30 bg-[#0a0a10]'
                  }
                `}
              >
                {/* Rank */}
                <div className={`font-mono text-xs w-6 text-right shrink-0 ${
                  entry.rank === 1 ? 'text-yellow-400' :
                  entry.rank === 2 ? 'text-slate-300' :
                  entry.rank === 3 ? 'text-orange-400' :
                  'text-slate-600'
                }`}>
                  {entry.rank === 1 ? '👑' : entry.rank === 2 ? '2' : entry.rank === 3 ? '3' : `${entry.rank}`}
                </div>

                {/* Name */}
                <div className={`font-mono text-sm flex-1 truncate ${isMe ? 'text-cyan-400' : 'text-slate-300'}`}>
                  {entry.name}
                  {isMe && <span className="text-[10px] text-slate-600 ml-1">(du)</span>}
                </div>

                {/* Prestige */}
                {entry.prestige_count > 0 && (
                  <span className="font-mono text-[10px] text-purple-400/70 shrink-0">
                    v{entry.prestige_count}
                  </span>
                )}

                {/* Score */}
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
