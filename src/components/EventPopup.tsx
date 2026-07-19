import { useEffect, useState, useRef } from 'react'
import { useGameStore } from '../game/store'
import { formatBits } from '../game/utils'
import { playSound } from '../game/sound'

export type GameEventType = 'zero_day' | 'data_exfil' | 'overclock'

export interface GameEvent {
  id: number
  type: GameEventType
}

interface Props {
  event: GameEvent
  onClaim: () => void
  onExpire: () => void
}

const WINDOW_MS = 20_000

const EVENT_CONFIG = {
  zero_day: {
    icon: '🔓',
    title: 'Zero-Day Window',
    description: 'Kritische Schwachstelle entdeckt. Exploit-Fenster offen — maximaler Durchsatz für 60s.',
    action: 'EXPLOIT',
    color: 'green',
  },
  data_exfil: {
    icon: '💾',
    title: 'Data Exfiltration',
    description: 'Unverschlüsseltes Datenpaket abgefangen. Einmaliger Payload verfügbar.',
    action: 'EXFILTRATE',
    color: 'green',
  },
  overclock: {
    icon: '⚡',
    title: 'System Overclock',
    description: 'CPU-Spike erkannt. Manueller Input jetzt maximal effektiv für 30s.',
    action: 'OVERCLOCK',
    color: 'green',
  },
} as const

export function EventPopup({ event, onClaim, onExpire }: Props) {
  const bitsPerSecond = useGameStore(s => s.bitsPerSecond)
  const activateEventBps = useGameStore(s => s.activateEventBps)
  const activateEventClick = useGameStore(s => s.activateEventClick)
  const addInstantBits = useGameStore(s => s.addInstantBits)
  const recordEventClaim = useGameStore(s => s.recordEventClaim)

  const [progress, setProgress] = useState(1) // 1 → 0
  const startRef = useRef(Date.now())
  const frameRef = useRef<number>(0)

  useEffect(() => {
    playSound('event')
    const animate = () => {
      const elapsed = Date.now() - startRef.current
      const p = Math.max(0, 1 - elapsed / WINDOW_MS)
      setProgress(p)
      if (p <= 0) {
        onExpire()
        return
      }
      frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [])

  const handleClaim = () => {
    if (event.type === 'zero_day') {
      activateEventBps(3, 60_000)
    } else if (event.type === 'overclock') {
      activateEventClick(5, 30_000)
    } else if (event.type === 'data_exfil') {
      const reward = Math.max(bitsPerSecond * 120, 10)
      addInstantBits(reward)
    }
    playSound('buy')
    recordEventClaim()
    onClaim()
  }

  const cfg = EVENT_CONFIG[event.type]
  const reward =
    event.type === 'zero_day' ? '3× BPS · 60s' :
    event.type === 'overclock' ? '5× Click · 30s' :
    `+${formatBits(Math.max(bitsPerSecond * 120, 10))}`

  return (
    <div className="
      fixed top-16 left-1/2 -translate-x-1/2 z-50
      w-80 slide-in
      rounded border border-green-700/50 bg-[#040d06]/95 backdrop-blur-sm
      shadow-[0_0_32px_rgba(57,255,20,0.08)]
    ">
      {/* Countdown bar */}
      <div className="h-0.5 bg-slate-800 rounded-t overflow-hidden">
        <div
          className="h-full bg-green-500/60 transition-none"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <span className="text-2xl">{cfg.icon}</span>
          <div>
            <div className="font-mono text-xs font-semibold text-green-400 tracking-widest">
              &gt; {cfg.title.toLowerCase().replace(/ /g, '_')}.sh
            </div>
            <div className="font-mono text-[10px] text-slate-600">
              {Math.ceil(progress * WINDOW_MS / 1000)}s verbleibend
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="font-mono text-xs text-slate-400 leading-relaxed">
          {cfg.description}
        </p>

        {/* Reward + CTA */}
        <div className="flex items-center justify-between gap-3">
          <div className="font-mono text-sm font-semibold text-green-300">
            {reward}
          </div>
          <button
            onClick={handleClaim}
            className="
              font-mono text-xs px-4 py-1.5 rounded
              border border-green-600/60 text-green-400
              bg-green-900/10 hover:bg-green-900/25
              transition-all duration-100 tracking-widest
            "
          >
            &gt; {cfg.action}
          </button>
        </div>
      </div>
    </div>
  )
}
