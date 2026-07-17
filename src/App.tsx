import { useEffect, useState, useRef } from 'react'
import { useGameStore } from './game/store'
import { saveGame, loadGame, calcOfflineEarnings } from './game/save'
import { submitScore } from './game/supabase'

import type { OfflineResult } from './game/save'
import type { GameState } from './game/types'
import { ResourceDisplay } from './components/ResourceDisplay'
import { ClickArea } from './components/ClickArea'
import { ProducerList } from './components/ProducerList'
import { UpgradePanel } from './components/UpgradePanel'
import { PrestigeModal } from './components/PrestigeModal'
import { OfflineModal } from './components/OfflineModal'
import { NameModal } from './components/NameModal'
import { Leaderboard, type LeaderboardEntry } from './components/Leaderboard'
import { AccountPanel } from './components/AccountPanel'

type MobileTab = 'run' | 'shop' | 'upgrades' | 'rank'

export default function App() {
  const tick = useGameStore(s => s.tick)
  const loadState = useGameStore(s => s.loadState)
  const updateLastActive = useGameStore(s => s.updateLastActive)
  const playerId = useGameStore(s => s.playerId)
  const playerName = useGameStore(s => s.playerName)
  const totalBitsEarned = useGameStore(s => s.totalBitsEarned)
  const prestigeCount = useGameStore(s => s.prestigeCount)
  const getState = () => useGameStore.getState()

  const [mobileTab, setMobileTab] = useState<MobileTab>('run')
  const [showPrestige, setShowPrestige] = useState(false)
  const [showNameModal, setShowNameModal] = useState(false)
  const [offlineResult, setOfflineResult] = useState<{ result: OfflineResult; state: GameState } | null>(null)
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([])
  const initialized = useRef(false)

  // Load save & calc offline on mount
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const saved = loadGame()
    if (saved) {
      const offlineRes = calcOfflineEarnings(saved)
      loadState(saved)
      saveGame() // persist any newly generated syncCode/playerTag
      setTimeout(() => submitScore(useGameStore.getState()), 500) // ensure syncCode lands in Supabase
      if (offlineRes.earnings > 0) {
        useGameStore.setState(s => ({
          bits: s.bits + offlineRes.earnings,
          totalBitsEarned: s.totalBitsEarned + offlineRes.earnings,
          lastActive: Date.now(),
        }))
        setOfflineResult({ result: offlineRes, state: saved })
      }
      // Ask for name if not set yet
      if (!saved.playerName) setShowNameModal(true)
    } else {
      setShowNameModal(true)
    }
  }, [loadState])

  // Game loop
  useEffect(() => {
    const interval = setInterval(() => tick(0.1), 100)
    return () => clearInterval(interval)
  }, [tick])

  // Auto-save + leaderboard submit every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      saveGame()
      if (playerName && playerId) {
        submitScore(getState())
      }
    }, 30_000)
    return () => clearInterval(interval)
  }, [playerId, playerName, totalBitsEarned, prestigeCount])

  // Submit score immediately after name is set or prestige
  useEffect(() => {
    if (playerName && playerId && totalBitsEarned > 0) {
      submitScore(useGameStore.getState())
    }
  }, [playerName, prestigeCount])

  // Save on tab close
  useEffect(() => {
    const handler = () => {
      updateLastActive()
      saveGame()
      if (playerName && playerId) {
        submitScore(useGameStore.getState())
      }
    }
    window.addEventListener('beforeunload', handler)
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') handler()
    })
    return () => window.removeEventListener('beforeunload', handler)
  }, [updateLastActive, playerId, playerName, totalBitsEarned, prestigeCount])

  return (
    <div className="min-h-dvh bg-[#050508] flex flex-col">
      <ResourceDisplay />

      {/* Desktop Layout */}
      <div className="hidden md:flex flex-1 mx-auto w-full max-w-6xl gap-0 overflow-hidden">
        <div className="w-72 border-r border-slate-800/50 overflow-y-auto">
          <UpgradePanel />
        </div>
        <div className="flex-1 flex items-start justify-center overflow-y-auto pt-4">
          <ClickArea onPrestigeClick={() => setShowPrestige(true)} />
        </div>
        <div className="w-80 border-l border-slate-800/50 overflow-y-auto flex flex-col">
          <div className="p-2">
            <AccountPanel entries={leaderboardEntries} />
          </div>
          <div className="border-t border-slate-800/50">
            <ProducerList />
          </div>
          <div className="border-t border-slate-800/50 mt-2">
            <Leaderboard onEntriesChange={setLeaderboardEntries} />
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto pb-16">
          {mobileTab === 'run' && <ClickArea onPrestigeClick={() => setShowPrestige(true)} />}
          {mobileTab === 'shop' && <ProducerList />}
          {mobileTab === 'upgrades' && <UpgradePanel />}
          {mobileTab === 'rank' && (
            <div className="space-y-2 p-2">
              <AccountPanel entries={leaderboardEntries} />
              <Leaderboard onEntriesChange={setLeaderboardEntries} />
            </div>
          )}
        </div>

        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#080810]/95 backdrop-blur-sm border-t border-slate-800/70 flex">
          {([
            { id: 'run' as MobileTab, label: 'RUN', icon: '⌨' },
            { id: 'shop' as MobileTab, label: 'SHOP', icon: '🕸' },
            { id: 'upgrades' as MobileTab, label: 'MODS', icon: '⚡' },
            { id: 'rank' as MobileTab, label: 'RANK', icon: '📊' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={`
                flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5
                font-mono text-[10px] tracking-widest transition-colors
                ${mobileTab === tab.id ? 'text-cyan-400 bg-cyan-950/20' : 'text-slate-600 hover:text-slate-400'}
              `}
            >
              <span className="text-base">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {showPrestige && <PrestigeModal onClose={() => setShowPrestige(false)} />}
      {showNameModal && <NameModal onClose={() => setShowNameModal(false)} />}
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
