import { useState, useEffect, useRef } from 'react'
import { useGameStore, randomAnonName } from '../game/store'
import { findFreeTag } from '../game/supabase'

interface Props {
  onClose: () => void
}

type Status = 'idle' | 'checking' | 'available' | 'taken'

export function NameModal({ onClose }: Props) {
  const setPlayerName = useGameStore(s => s.setPlayerName)
  const playerId = useGameStore(s => s.playerId)
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [resolvedTag, setResolvedTag] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    checkName(input)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [input])

  const handleSubmit = async (overrideName?: string) => {
    const raw = (overrideName ?? input).trim().slice(0, 24) || randomAnonName()
    const tag = await findFreeTag(raw, playerId)
    setPlayerName(raw, tag)
    onClose()
  }

  const displayName = input.trim() || '...'
  const tagDisplay = resolvedTag ?? '????'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm card border-cyan-800/30 p-5 space-y-4 slide-in">
        <div>
          <div className="font-mono text-base font-semibold neon-cyan">&gt; identify.sh</div>
          <div className="font-mono text-xs text-slate-500 mt-1">
            Dein Handle im Leaderboard. Wird einmalig vergeben.
          </div>
        </div>

        <div className="space-y-2">
          <input
            type="text"
            maxLength={24}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && status === 'available' && handleSubmit()}
            placeholder="dein_handle"
            autoFocus
            className="
              w-full bg-[#0a0a12] border border-slate-700 rounded px-3 py-2
              font-mono text-sm text-slate-200 placeholder:text-slate-600
              focus:outline-none focus:border-cyan-600 transition-colors
            "
          />

          {/* Preview + status */}
          <div className="flex items-center justify-between px-1">
            <div className="font-mono text-sm">
              <span className="text-slate-300">{displayName}</span>
              <span className="text-purple-400/70">#{tagDisplay}</span>
            </div>
            <div className="font-mono text-[10px]">
              {status === 'checking' && <span className="text-slate-500">checking...</span>}
              {status === 'available' && <span className="text-green-400">✓ verfügbar</span>}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleSubmit(randomAnonName())}
            className="flex-1 font-mono text-xs py-2 rounded border border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600 transition-all"
          >
            random
          </button>
          <button
            onClick={() => handleSubmit()}
            disabled={status === 'checking' || status === 'idle'}
            className="flex-1 font-mono text-sm py-2 rounded border border-cyan-700/50 text-cyan-400 bg-cyan-900/10 hover:bg-cyan-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            &gt; confirm
          </button>
        </div>
      </div>
    </div>
  )
}
