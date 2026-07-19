import { useState } from 'react'
import { useGameStore } from '../game/store'
import { loadFromSyncCode, submitScore, type LeaderboardEntry } from '../game/supabase'
import { saveGame } from '../game/save'
import { titleById, artifactById } from '../game/quests'

interface Props {
  entries: LeaderboardEntry[]
}

export function AccountPanel({ entries }: Props) {
  const playerId = useGameStore(s => s.playerId)
  const playerName = useGameStore(s => s.playerName)
  const playerTag = useGameStore(s => s.playerTag)
  const syncCode = useGameStore(s => s.syncCode)
  const loadState = useGameStore(s => s.loadState)
  const earnedTitles = useGameStore(s => s.earnedTitles)
  const earnedArtifacts = useGameStore(s => s.earnedArtifacts)
  const activeTitle = useGameStore(s => s.activeTitle)
  const setActiveTitle = useGameStore(s => s.setActiveTitle)

  const [syncInput, setSyncInput] = useState('')
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [copied, setCopied] = useState(false)
  const [showSyncImport, setShowSyncImport] = useState(false)
  const [syncCodeVisible, setSyncCodeVisible] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetInput, setResetInput] = useState('')

  const myEntry = entries.find(e => e.player_id === playerId)
  const myRank = myEntry?.rank ?? null

  const handleResetAll = () => {
    useGameStore.getState().resetAll()
    // Truly start from zero: let the tutorial reappear
    localStorage.removeItem('null_byte_onboarding_step')
    saveGame()
    // Push the wiped state (0 progress) to the leaderboard under the kept name
    submitScore(useGameStore.getState())
    setShowResetConfirm(false)
    setResetInput('')
  }

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
          {activeTitle && titleById(activeTitle) && (
            <span className="text-amber-400/80 mr-1" title={titleById(activeTitle)!.label}>
              {titleById(activeTitle)!.icon}
            </span>
          )}
          <span className="text-cyan-400">{playerName || '???'}</span>
          <span className="text-purple-400/70">#{playerTag || '????'}</span>
          {myRank && (
            <span className="text-slate-600 text-xs ml-2">#{myRank}</span>
          )}
        </div>
        <div className="font-mono text-[10px] text-slate-600 uppercase tracking-widest">agent</div>
      </div>

      {/* Titles — earned via story operations, one can be shown on the leaderboard */}
      {earnedTitles.length > 0 && (
        <div>
          <div className="font-mono text-[10px] text-slate-600 uppercase tracking-widest mb-1">Titel</div>
          <div className="flex flex-wrap gap-1.5">
            {earnedTitles.map(id => {
              const t = titleById(id)
              if (!t) return null
              const active = activeTitle === id
              return (
                <button
                  key={id}
                  onClick={() => setActiveTitle(active ? null : id)}
                  className={`font-mono text-[10px] px-2 py-1 rounded border transition-all ${
                    active
                      ? 'border-amber-600/60 text-amber-300 bg-amber-950/20'
                      : 'border-slate-700/50 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Artifacts — permanent quest rewards */}
      {earnedArtifacts.length > 0 && (
        <div>
          <div className="font-mono text-[10px] text-slate-600 uppercase tracking-widest mb-1">Artefakte</div>
          <div className="flex flex-wrap gap-1.5">
            {earnedArtifacts.map(id => {
              const a = artifactById(id)
              if (!a) return null
              return (
                <span
                  key={id}
                  title={`${a.name} — ${a.description}`}
                  className="font-mono text-[10px] px-2 py-1 rounded border border-purple-800/40 text-purple-300 bg-purple-950/10"
                >
                  {a.icon} {a.name}
                </span>
              )
            })}
          </div>
        </div>
      )}

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

      {/* Danger zone — full progress wipe, keeps only the name#tag */}
      <div className="pt-1 border-t border-slate-800/50">
        <button
          onClick={() => { setResetInput(''); setShowResetConfirm(true) }}
          className="font-mono text-[10px] text-red-500/60 hover:text-red-400 transition-colors"
        >
          ⚠ alles zurücksetzen
        </button>
      </div>

      {showResetConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) { setShowResetConfirm(false); setResetInput('') } }}
        >
          <div className="w-full max-w-sm card border-red-800/50 p-5 space-y-4 slide-in">
            <div>
              <div className="font-mono text-base font-semibold text-red-400">
                &gt; factory_reset.sh
              </div>
              <div className="font-mono text-xs text-slate-500 mt-1">
                Löscht deinen gesamten Fortschritt und startet bei 0.
              </div>
            </div>

            <div className="card bg-[#100808] border-red-900/40 p-3 space-y-2">
              <div className="font-mono text-[10px] text-red-500/80 uppercase tracking-widest">
                ↺ Wird gelöscht
              </div>
              <div className="font-mono text-[11px] text-slate-400 leading-relaxed">
                Bits, Producer, Upgrades, Prestiges, Ghost Credits, Achievements,
                Quests, Artefakte, Titel &amp; alle Statistiken.
              </div>
              <div className="font-mono text-[10px] text-green-500/80 uppercase tracking-widest pt-1">
                ✓ Bleibt erhalten
              </div>
              <div className="font-mono text-[11px] text-slate-400">
                Nur dein Name <span className="text-cyan-400">{playerName || '???'}</span>
                <span className="text-purple-400/70">#{playerTag}</span> und dein Sync-Code.
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="font-mono text-[10px] text-slate-500">
                Tippe <span className="text-red-400 font-semibold">RESET</span> zum Bestätigen:
              </div>
              <input
                type="text"
                value={resetInput}
                onChange={e => setResetInput(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter' && resetInput === 'RESET') handleResetAll() }}
                placeholder="RESET"
                autoFocus
                className="
                  w-full bg-[#0a0a12] border border-slate-700 rounded px-3 py-2
                  font-mono text-sm text-slate-200 placeholder:text-slate-700
                  focus:outline-none focus:border-red-600 tracking-widest text-center
                "
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setShowResetConfirm(false); setResetInput('') }}
                className="flex-1 font-mono text-sm py-2 rounded border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-all"
              >
                Abbrechen
              </button>
              <button
                onClick={handleResetAll}
                disabled={resetInput !== 'RESET'}
                className="flex-1 font-mono text-sm py-2 rounded border border-red-600 text-red-300 bg-red-900/20 hover:bg-red-900/40 hover:border-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-semibold"
              >
                Endgültig löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
