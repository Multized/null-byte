import { useEffect, useRef, useState, useCallback } from 'react'
import { useGameStore } from '../game/store'
import { formatBits } from '../game/utils'
import { artifactPacketLifetimeMs } from '../game/quests'
import { playSound } from '../game/sound'

interface Packet {
  id: number
  fromX: number
  fromY: number
  toX: number
  toY: number
  lifetime: number
}

interface FloatReward {
  id: number
  x: number
  y: number
  text: string
}

const LIFETIME_MS = 12_000
let packetIdCounter = 0

// 'nullbyte_fast_packets' = '1' in localStorage shortens spawn timers for manual/E2E testing
function spawnDelayMs(first: boolean): number {
  if (localStorage.getItem('nullbyte_fast_packets') === '1') return first ? 2_000 : 6_000
  return first ? (25 + Math.random() * 20) * 1000 : (60 + Math.random() * 120) * 1000
}

export function DataPacketLayer() {
  const [packet, setPacket] = useState<Packet | null>(null)
  const [inFlight, setInFlight] = useState(false)
  const [floats, setFloats] = useState<FloatReward[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }

  const scheduleSpawn = useCallback((first: boolean) => {
    clearTimer()
    timerRef.current = setTimeout(() => {
      const goingRight = Math.random() < 0.5
      const lifetime = LIFETIME_MS + artifactPacketLifetimeMs(useGameStore.getState())
      setPacket({
        id: ++packetIdCounter,
        fromX: goingRight ? 5 : 80,
        fromY: 15 + Math.random() * 55,
        toX: goingRight ? 80 : 5,
        toY: 15 + Math.random() * 55,
        lifetime,
      })
      setInFlight(false)
      // double rAF so the browser paints the start position before the transition kicks in
      requestAnimationFrame(() => requestAnimationFrame(() => setInFlight(true)))
      timerRef.current = setTimeout(() => {
        setPacket(null)
        scheduleSpawn(false)
      }, lifetime)
    }, spawnDelayMs(first))
  }, [])

  useEffect(() => {
    scheduleSpawn(true)
    return clearTimer
  }, [scheduleSpawn])

  const handleCatch = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!packet) return

    const store = useGameStore.getState()
    const bps = store.bitsPerSecond
    const r = Math.random()
    let text: string
    if (r < 0.5) {
      const amount = Math.max(25, bps * (90 + Math.random() * 150))
      store.addInstantBits(amount)
      text = `+${formatBits(amount)}`
    } else if (r < 0.75) {
      store.activateEventBps(2, 45_000)
      text = '2× BPS · 45s'
    } else if (r < 0.95) {
      store.activateEventClick(3, 30_000)
      text = '3× Click · 30s'
    } else if (store.prestigeCount > 0) {
      useGameStore.setState(s => ({
        ghostCredits: s.ghostCredits + 1,
        totalGhostCreditsEarned: s.totalGhostCreditsEarned + 1,
      }))
      text = '+1 Ghost Credit'
    } else {
      const amount = Math.max(50, bps * 300)
      store.addInstantBits(amount)
      text = `+${formatBits(amount)}`
    }
    store.recordPacketCaught()
    playSound('event')

    const id = ++packetIdCounter
    setFloats(prev => [...prev, { id, x: e.clientX, y: e.clientY, text }])
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 1200)

    setPacket(null)
    scheduleSpawn(false)
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {packet && (
        <button
          key={packet.id}
          onClick={handleCatch}
          title="Data Packet abfangen!"
          className="absolute pointer-events-auto cursor-pointer select-none"
          style={{
            left: `${inFlight ? packet.toX : packet.fromX}%`,
            top: `${inFlight ? packet.toY : packet.fromY}%`,
            transition: `left ${packet.lifetime}ms linear, top ${packet.lifetime}ms linear`,
          }}
        >
          <span
            className="block text-2xl packet-bob"
            style={{ filter: 'drop-shadow(0 0 8px rgba(57, 255, 20, 0.8))' }}
          >
            📦
          </span>
        </button>
      )}
      {floats.map(f => (
        <div key={f.id} className="float-text" style={{ left: f.x, top: f.y, color: '#39ff14', textShadow: '0 0 8px rgba(57,255,20,0.8)' }}>
          {f.text}
        </div>
      ))}
    </div>
  )
}
