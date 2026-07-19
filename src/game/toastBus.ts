import type { AchievementDef } from './achievements'

export type ToastEvent =
  | { kind: 'achievement'; def: AchievementDef }
  | { kind: 'milestone'; producerName: string; producerIcon: string; threshold: number }
  | { kind: 'info'; icon: string; title: string; text: string }

type Listener = (e: ToastEvent) => void

const listeners = new Set<Listener>()

export function emitToast(e: ToastEvent): void {
  listeners.forEach(l => l(e))
}

export function subscribeToast(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}
