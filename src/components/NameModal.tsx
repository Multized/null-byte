import { useState } from 'react'
import { useGameStore, randomAnonName } from '../game/store'

interface Props {
  onClose: () => void
}

export function NameModal({ onClose }: Props) {
  const setPlayerName = useGameStore(s => s.setPlayerName)
  const [input, setInput] = useState('')

  const handleSubmit = (name: string) => {
    const trimmed = name.trim().slice(0, 24)
    setPlayerName(trimmed || randomAnonName())
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm card border-cyan-800/30 p-5 space-y-4 slide-in">
        <div>
          <div className="font-mono text-base font-semibold neon-cyan">&gt; identify.sh</div>
          <div className="font-mono text-xs text-slate-500 mt-1">
            Wie willst du im Leaderboard heißen?
          </div>
        </div>

        <input
          type="text"
          maxLength={24}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit(input)}
          placeholder="dein_handle"
          autoFocus
          className="
            w-full bg-[#0a0a12] border border-slate-700 rounded px-3 py-2
            font-mono text-sm text-slate-200 placeholder:text-slate-600
            focus:outline-none focus:border-cyan-600 transition-colors
          "
        />

        <div className="flex gap-2">
          <button
            onClick={() => handleSubmit(randomAnonName())}
            className="flex-1 font-mono text-xs py-2 rounded border border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600 transition-all"
          >
            random
          </button>
          <button
            onClick={() => handleSubmit(input)}
            className="flex-1 font-mono text-sm py-2 rounded border border-cyan-700/50 text-cyan-400 bg-cyan-900/10 hover:bg-cyan-900/20 transition-all"
          >
            &gt; confirm
          </button>
        </div>
      </div>
    </div>
  )
}
