import { useState } from 'react'
import { useGameStore } from '../game/store'
import { loadFromSyncCode, submitScore, type LeaderboardEntry } from '../game/supabase'
import { saveGame } from '../game/save'

interface Props {
  entries: LeaderboardEntry[]
}

export function AccountPanel({ entries }: Props) {
  const playerId = useGameStore(s => s.playerId)
  const playerName = useGameStore(s => s.playerName)
  const playerTag = useGameStore(s => s.playerTag)
  const syncCode = useGameStore(s => s.syncCode)
  const loadState = useGameStore(s => s.loadState)

  const [syncInput, setSyncInput] = useState('')
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [copied, setCopied] = useState(false)
  const [showSyncImport, setShowSyncImport] = useState(false)
  const [syncCodeVisible, setSyncCodeVisible] = useState(false)

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
    submitScore(useGameStore.getState())
    setSyncStatus('idle')
    setSyncInput('')
    setShowSyncImport(false)
  }

  return (
    <div className="card border-cyan-900/30 p-3 space-y-2">
      {/* Identity */}
      <div className="flex items-center justify-between">
        <div className="font-mono text-sm">
          <span className="text-cyan-400">{playerName || '???'}</span>
          <span className="text-purple-400/70">#{playerTag || '????'}</span>
          {myRank && (
            <span className="text-slate-600 text-xs ml-2">#{myRank}</span>
          )}
        </div>
        <div className="font-mono text-[10px] text-slate-600 uppercase tracking-widest">agent</div>
      </div>

      {/* Sync Code */}
      {syncCode && (
        <div className="flex items-center justify-between bg-[#060609] rounded px-2.5 py-1.5 border border-slate-800/50">
          <div>
            <div className="font-mono text-[10px] text-slate-600 mb-0.5">sync code</div>
            <div
              className={`font-mono text-base font-semibold tracking-widest text-cyan-400/80 transition-all duration-200 cursor-pointer select-none ${syncCodeVisible ? '' : 'blur-sm'}`}
              onClick={() => setSyncCodeVisible(v => !v)}
              title={syncCodeVisible ? 'verbergen' : 'anzeigen'}
            >
              {syncCode}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={copySyncCode}
              className="font-mono text-[10px] text-slate-500 hover:text-cyan-400 transition-colors px-2"
            >
              {copied ? '✓ copied' : 'copy'}
            </button>
            <button
              onClick={() => setSyncCodeVisible(v => !v)}
              className="font-mono text-[10px] text-slate-600 hover:text-slate-400 transition-colors px-2"
            >
              {syncCodeVisible ? '◉ hide' : '◎ show'}
            </button>
          </div>
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
            Code vom anderen Gerät — überschreibt aktuellen Save!
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
  )
}
