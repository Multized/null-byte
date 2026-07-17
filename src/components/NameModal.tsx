import { useState, useEffect, useRef } from 'react'
import { useGameStore, randomAnonName } from '../game/store'
import { findFreeTag, loadFromSyncCode } from '../game/supabase'
import { saveGame } from '../game/save'

interface Props {
  onClose: () => void
}

type Status = 'idle' | 'checking' | 'available'
type View = 'choose' | 'new' | 'sync'

export function NameModal({ onClose }: Props) {
  const setPlayerName = useGameStore(s => s.setPlayerName)
  const loadState = useGameStore(s => s.loadState)
  const playerId = useGameStore(s => s.playerId)

  const [view, setView] = useState<View>('choose')

  // New player
  const [nameInput, setNameInput] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [resolvedTag, setResolvedTag] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync
  const [syncInput, setSyncInput] = useState('')
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  const checkName = (name: string) => {
    const trimmed = name.trim().slice(0, 24)
    if (!trimmed) { setStatus('idle'); setResolvedTag(null); return }
    setStatus('checking')
    setResolvedTag(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const tag = await findFreeTag(trimmed, playerId)
      setResolvedTag(tag)
      setStatus('available')
    }, 500)
  }

  useEffect(() => {
    checkName(nameInput)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [nameInput])

  const handleConfirmName = async (overrideName?: string) => {
    const raw = (overrideName ?? nameInput).trim().slice(0, 24) || randomAnonName()
    const tag = await findFreeTag(raw, playerId)
    setPlayerName(raw, tag)
    onClose()
  }

  const handleSyncLoad = async () => {
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
    onClose()
  }

  if (view === 'choose') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="w-full max-w-sm card border-cyan-800/30 p-5 space-y-4 slide-in">
          <div>
            <div className="font-mono text-base font-semibold neon-cyan">&gt; init_session.sh</div>
            <div className="font-mono text-xs text-slate-500 mt-1">Erstes Mal oder schon dabei?</div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => setView('new')}
              className="w-full text-left font-mono text-sm py-3 px-4 rounded border border-slate-700 bg-[#0a0a12] hover:border-cyan-600/50 hover:bg-[#0d0d18] transition-all"
            >
              <div className="text-slate-200">Neu anfangen</div>
              <div className="text-slate-600 text-xs mt-0.5">Handle wählen &amp; loslegen</div>
            </button>
            <button
              onClick={() => setView('sync')}
              className="w-full text-left font-mono text-sm py-3 px-4 rounded border border-slate-700 bg-[#0a0a12] hover:border-purple-600/50 hover:bg-[#0d0d18] transition-all"
            >
              <div className="text-slate-200">Sync Code eingeben</div>
              <div className="text-slate-600 text-xs mt-0.5">Save von anderem Gerät laden</div>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (view === 'sync') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="w-full max-w-sm card border-purple-800/30 p-5 space-y-4 slide-in">
          <div>
            <div className="font-mono text-base font-semibold neon-purple">&gt; sync_device.sh</div>
            <div className="font-mono text-xs text-slate-500 mt-1">
              Code vom anderen Gerät eingeben.
            </div>
          </div>

          <input
            type="text"
            value={syncInput}
            onChange={e => setSyncInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleSyncLoad()}
            placeholder="XXX-XXX"
            maxLength={9}
            autoFocus
            className="
              w-full bg-[#0a0a12] border border-slate-700 rounded px-3 py-2
              font-mono text-xl text-slate-200 placeholder:text-slate-600
              focus:outline-none focus:border-purple-600 tracking-widest text-center
            "
          />

          {syncStatus === 'error' && (
            <div className="font-mono text-xs text-red-400 text-center">
              Code nicht gefunden. Prüf nochmal.
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setView('choose')}
              className="flex-1 font-mono text-xs py-2 rounded border border-slate-700 text-slate-500 hover:text-slate-300 transition-all"
            >
              ← zurück
            </button>
            <button
              onClick={handleSyncLoad}
              disabled={syncStatus === 'loading' || !syncInput.trim()}
              className="flex-1 font-mono text-sm py-2 rounded border border-purple-700/50 text-purple-300 bg-purple-900/10 hover:bg-purple-900/20 disabled:opacity-40 transition-all"
            >
              {syncStatus === 'loading' ? 'laden...' : '> sync'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // view === 'new'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm card border-cyan-800/30 p-5 space-y-4 slide-in">
        <div>
          <div className="font-mono text-base font-semibold neon-cyan">&gt; identify.sh</div>
          <div className="font-mono text-xs text-slate-500 mt-1">Wie willst du im Leaderboard heißen?</div>
        </div>

        <div className="space-y-2">
          <input
            type="text"
            maxLength={24}
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && status === 'available' && handleConfirmName()}
            placeholder="dein_handle"
            autoFocus
            className="
              w-full bg-[#0a0a12] border border-slate-700 rounded px-3 py-2
              font-mono text-sm text-slate-200 placeholder:text-slate-600
              focus:outline-none focus:border-cyan-600 transition-colors
            "
          />
          <div className="flex items-center justify-between px-1">
            <div className="font-mono text-sm">
              <span className="text-slate-300">{nameInput.trim() || '...'}</span>
              <span className="text-purple-400/70">#{resolvedTag ?? '????'}</span>
            </div>
            <div className="font-mono text-[10px]">
              {status === 'checking' && <span className="text-slate-500">checking...</span>}
              {status === 'available' && <span className="text-green-400">✓ frei</span>}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setView('choose')}
            className="font-mono text-xs py-2 px-3 rounded border border-slate-700 text-slate-500 hover:text-slate-300 transition-all"
          >
            ←
          </button>
          <button
            onClick={() => handleConfirmName(randomAnonName())}
            className="font-mono text-xs py-2 px-3 rounded border border-slate-700 text-slate-500 hover:text-slate-300 transition-all"
          >
            random
          </button>
          <button
            onClick={() => handleConfirmName()}
            disabled={status === 'checking' || status === 'idle'}
            className="flex-1 font-mono text-sm py-2 rounded border border-cyan-700/50 text-cyan-400 bg-cyan-900/10 hover:bg-cyan-900/20 disabled:opacity-40 transition-all"
          >
            &gt; confirm
          </button>
        </div>
      </div>
    </div>
  )
}
