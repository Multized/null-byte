import { useEffect, useState } from 'react'
import { fetchLeaderboard, loadFromSyncCode, submitScore, type LeaderboardEntry } from '../game/supabase'
import { useGameStore } from '../game/store'
import { formatBits } from '../game/utils'
import { saveGame } from '../game/save'

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
  const playerTag = useGameStore(s => s.playerTag)
  const syncCode = useGameStore(s => s.syncCode)
  const loadState = useGameStore(s => s.loadState)

  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [syncInput, setSyncInput] = useState('')
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [copied, setCopied] = useState(false)
  const [showSyncImport, setShowSyncImport] = useState(false)

  const load = async () => {
    setLoading(true)
    const data = await fetchLeaderboard()
    setEntries(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // Ensure sync code is always in Supabase when user opens leaderboard
    submitScore(useGameStore.getState())
  }, [])

  const myEntry = entries.find(e => e.player_id === playerId)
  const myRank = myEntry?.rank ?? null

  const copySyncCode = () => {
    navigator.clipboard.writeText(syncCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSyncImport = async () => {
    if (!syncInput.trim()) return
    setSyncStatus('loading')
    const state = await loadFromSyncCode(syncInput.trim())
    if (!state) {
      setSyncStatus('error')
      setTimeout(() => setSyncStatus('idle'), 3000)
      return
    }
    loadState(state)
    saveGame()
    setSyncStatus('idle')
    setSyncInput('')
    setShowSyncImport(false)
    await load()
  }

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

      {/* Own identity card */}
      <div className="card border-cyan-900/30 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-mono text-sm">
            <span className="text-cyan-400">{playerName || '???'}</span>
            <span className="text-purple-400/70">#{playerTag || '????'}</span>
            {myRank && (
              <span className="text-slate-600 text-xs ml-2">#{myRank}</span>
            )}
          </div>
        </div>

        {/* Sync Code */}
        {syncCode && (
          <div className="flex items-center justify-between bg-[#060609] rounded px-2.5 py-1.5 border border-slate-800/50">
            <div>
              <div className="font-mono text-[10px] text-slate-600 mb-0.5">sync code</div>
              <div className="font-mono text-base font-semibold tracking-widest text-cyan-400/80">
                {syncCode}
              </div>
            </div>
            <button
              onClick={copySyncCode}
              className="font-mono text-[10px] text-slate-500 hover:text-cyan-400 transition-colors px-2"
            >
              {copied ? '✓ copied' : 'copy'}
            </button>
          </div>
        )}

        {/* Import sync code */}
        <button
          onClick={() => setShowSyncImport(v => !v)}
          className="font-mono text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
        >
          {showSyncImport ? '▲ schließen' : '▼ anderen device syncen'}
        </button>

        {showSyncImport && (
          <div className="space-y-2">
            <div className="font-mono text-[10px] text-slate-600">
              Code vom anderen Gerät eingeben — überschreibt deinen aktuellen Save!
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={syncInput}
                onChange={e => setSyncInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleSyncImport()}
                placeholder="XXX-XXX"
                maxLength={9}
                className="
                  flex-1 bg-[#0a0a12] border border-slate-700 rounded px-2 py-1.5
                  font-mono text-sm text-slate-200 placeholder:text-slate-600
                  focus:outline-none focus:border-cyan-600 tracking-widest
                "
              />
              <button
                onClick={handleSyncImport}
                disabled={syncStatus === 'loading'}
                className="font-mono text-xs px-3 py-1.5 rounded border border-cyan-700/50 text-cyan-400 hover:bg-cyan-900/20 disabled:opacity-40 transition-all"
              >
                {syncStatus === 'loading' ? '...' : 'load'}
              </button>
            </div>
            {syncStatus === 'error' && (
              <div className="font-mono text-[10px] text-red-400">Code nicht gefunden.</div>
            )}
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
