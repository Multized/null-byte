import { useEffect, useRef, useState } from 'react'

/**
 * Smoothly interpolates a displayed number toward `target` every frame instead of
 * snapping instantly. Uses frame-rate-independent exponential smoothing, so it keeps
 * up cleanly with a value that changes continuously (like bits ticking every 100ms).
 */
export function useTweenedNumber(target: number, speed = 10): number {
  const [display, setDisplay] = useState(target)
  const displayRef = useRef(target)
  const targetRef = useRef(target)
  const lastFrameRef = useRef<number | null>(null)
  const rafRef = useRef<number>(0)

  targetRef.current = target

  useEffect(() => {
    const step = (now: number) => {
      const last = lastFrameRef.current ?? now
      const dt = Math.min(0.1, (now - last) / 1000)
      lastFrameRef.current = now

      const diff = targetRef.current - displayRef.current
      if (Math.abs(diff) < Math.max(0.01, Math.abs(targetRef.current) * 0.0005)) {
        displayRef.current = targetRef.current
      } else {
        const factor = 1 - Math.exp(-speed * dt)
        displayRef.current += diff * factor
      }
      setDisplay(displayRef.current)
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [speed])

  return display
}
