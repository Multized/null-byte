import { useEffect, useRef } from 'react'

const GLYPHS = '01アイウエオカキクケコサシスセソタチツテト<>/{}[]#$%'
const COLUMN_WIDTH = 26
const FRAME_MS = 66 // ~15fps is plenty for a background effect
const FONT_SIZE = 13

interface Props {
  hue: number
  opacity: number
}

export function MatrixRain({ hue, opacity }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hueRef = useRef(hue)
  hueRef.current = hue

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let columns: number[] = []

    const resize = () => {
      canvas.width = parent.clientWidth
      canvas.height = parent.clientHeight
      const count = Math.ceil(canvas.width / COLUMN_WIDTH)
      columns = Array.from({ length: count }, () => Math.random() * canvas.height / FONT_SIZE)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(parent)

    let raf = 0
    let last = 0
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (now - last < FRAME_MS) return
      last = now

      // Fade previous glyphs toward transparent so the ambient glow behind stays visible
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = 'source-over'

      ctx.font = `${FONT_SIZE}px "JetBrains Mono", monospace`
      ctx.fillStyle = `hsl(${hueRef.current} 90% 55%)`
      for (let i = 0; i < columns.length; i++) {
        const glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
        ctx.fillText(glyph, i * COLUMN_WIDTH, columns[i] * FONT_SIZE)
        if (columns[i] * FONT_SIZE > canvas.height && Math.random() > 0.975) {
          columns[i] = 0
        }
        columns[i]++
      }
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
      style={{ opacity }}
    />
  )
}
