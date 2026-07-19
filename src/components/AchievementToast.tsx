import { useEffect, useState, useRef } from 'react'
import { subscribeToast, type ToastEvent } from '../game/toastBus'
import { playSound } from '../game/sound'

interface QueuedToast {
  id: number
  event: ToastEvent
}

let idCounter = 0
const DISPLAY_MS = 5000

export function AchievementToastQueue() {
  const [queue, setQueue] = useState<QueuedToast[]>([])
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    return subscribeToast(event => {
      const id = ++idCounter
      setQueue(prev => [...prev, { id, event }])
      playSound(event.kind === 'achievement' ? 'achievement' : 'milestone')
      const t = setTimeout(() => {
        setQueue(prev => prev.filter(q => q.id !== id))
        timersRef.current.delete(id)
      }, DISPLAY_MS)
      timersRef.current.set(id, t)
    })
  }, [])

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach(t => clearTimeout(t))
    }
  }, [])

  if (queue.length === 0) return null

  return (
    <div className="fixed top-16 right-3 z-[60] flex flex-col gap-2 w-72 pointer-events-none">
      {queue.map(({ id, event }) => (
        <div
          key={id}
          className={`
            slide-in rounded border backdrop-blur-sm p-3 shadow-lg pointer-events-auto
            ${event.kind === 'achievement'
              ? 'border-amber-600/50 bg-[#0d0a04]/95 shadow-[0_0_24px_rgba(251,191,36,0.1)]'
              : 'border-cyan-600/50 bg-[#040a0d]/95 shadow-[0_0_24px_rgba(0,245,255,0.1)]'
            }
          `}
        >
          {event.kind === 'achievement' ? (
            <>
              <div className="font-mono text-[10px] text-amber-500 tracking-widest uppercase mb-1">
                &gt; achievement_unlocked.sh
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-xl shrink-0">{event.def.icon}</span>
                <div className="min-w-0">
                  <div className="font-mono text-sm font-semibold text-amber-300 truncate">
                    {event.def.name}
                  </div>
                  <div className="font-mono text-[10px] text-slate-500 truncate">
                    {event.def.description}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="font-mono text-[10px] text-cyan-500 tracking-widest uppercase mb-1">
                &gt; milestone_reached.sh
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-xl shrink-0">{event.producerIcon}</span>
                <div className="min-w-0">
                  <div className="font-mono text-sm font-semibold text-cyan-300 truncate">
                    {event.threshold}× {event.producerName}
                  </div>
                  <div className="font-mono text-[10px] text-slate-500">
                    Output-Bonus ×2
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
