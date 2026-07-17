import { useEffect, useState, useRef } from 'react'
import { useGameStore } from './game/store'
import { saveGame, loadGame, calcOfflineEarnings } from './game/save'
import type { OfflineResult } from './game/save'
import type { GameState } from './game/types'
import { ResourceDisplay } from './components/ResourceDisplay'
import { ClickArea } from './components/ClickArea'
import { ProducerList } from './components/ProducerList'
import { UpgradePanel } from './components/UpgradePanel'
import { PrestigeModal } from './components/PrestigeModal'
import { OfflineModal } from './components/OfflineModal'

type MobileTab = 'run' | 'shop' | 'upgrades'

export default function App() {
  const tick = useGameStore(s => s.tick)
  const loadState = useGameStore(s => s.loadState)
  const updateLastActive = useGameStore(s => s.updateLastActive)

  const [mobileTab, setMobileTab] = useState<MobileTab>('run')
  const [showPrestige, setShowPrestige] = useState(false)
  const [offlineResult, setOfflineResult] = useState<{ result: OfflineResult; state: GameState } | null>(null)
  const initialized = useRef(false)

  // Load save & calc offline on mount
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const saved = loadGame()
    if (saved) {
      const offlineRes = calcOfflineEarnings(saved)
      loadState(saved)

      if (offlineRes.earnings > 0) {
        // Apply offline earnings
        useGameStore.setState(s => ({
          bits: s.bits + offlineRes.earnings,
          totalBitsEarned: s.totalBitsEarned + offlineRes.earnings,
          lastActive: Date.now(),
        }))
        setOfflineResult({ result: offlineRes, state: saved })
      }
    }
  }, [loadState])

  // Game loop
  useEffect(() => {
    const interval = setInterval(() => {
      tick(0.1)
    }, 100)
    return () => clearInterval(interval)
  }, [tick])

  // Auto-save every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      saveGame()
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  // Save on tab close
  useEffect(() => {
    const handler = () => {
      updateLastActive()
      saveGame()
    }
    window.addEventListener('beforeunload', handler)
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') handler()
    })
    return () => {
      window.removeEventListener('beforeunload', handler)
    }
  }, [updateLastActive])

  return (
    <div className="min-h-dvh bg-[#050508] flex flex-col">
      <ResourceDisplay />

      {/* Desktop Layout */}
      <div className="hidden md:flex flex-1 mx-auto w-full max-w-6xl gap-0 overflow-hidden">
        {/* Left: Upgrades */}
        <div className="w-72 border-r border-slate-800/50 overflow-y-auto">
          <UpgradePanel />
        </div>

        {/* Center: Click */}
        <div className="flex-1 flex items-start justify-center overflow-y-auto pt-4">
          <ClickArea onPrestigeClick={() => setShowPrestige(true)} />
        </div>

        {/* Right: Producers */}
        <div className="w-80 border-l border-slate-800/50 overflow-y-auto">
          <ProducerList />
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden flex-1 overflow-hidden flex flex-col">
        {/* Tab content */}
        <div className="flex-1 overflow-y-auto pb-16">
          {mobileTab === 'run' && (
            <ClickArea onPrestigeClick={() => setShowPrestige(true)} />
          )}
          {mobileTab === 'shop' && <ProducerList />}
          {mobileTab === 'upgrades' && <UpgradePanel />}
        </div>

        {/* Bottom Tab Bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#080810]/95 backdrop-blur-sm border-t border-slate-800/70 flex">
          {([
            { id: 'run' as MobileTab, label: 'EXECUTE', icon: '⌨' },
            { id: 'shop' as MobileTab, label: 'SHOP', icon: '🕸' },
            { id: 'upgrades' as MobileTab, label: 'UPGRADES', icon: '⚡' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={`
                flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5
                font-mono text-[10px] tracking-widest transition-colors
                ${mobileTab === tab.id
                  ? 'text-cyan-400 bg-cyan-950/20'
                  : 'text-slate-600 hover:text-slate-400'
                }
              `}
            >
              <span className="text-base">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Modals */}
      {showPrestige && <PrestigeModal onClose={() => setShowPrestige(false)} />}
      {offlineResult && (
        <OfflineModal
          result={offlineResult.result}
          state={offlineResult.state}
          onClose={() => setOfflineResult(null)}
        />
      )}
    </div>
  )
}
