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
import { OnboardingHint } from './components/OnboardingHint'
import { EventPopup, type GameEvent, type GameEventType } from './components/EventPopup'
import { isUpgradeUnlocked } from './game/utils'
import { UPGRADES } from './game/constants'

type MobileTab = 'run' | 'shop' | 'upgrades' | 'rank'
type DesktopTab = 'shop' | 'mods' | 'agent'

export default function App() {
  const tick = useGameStore(s => s.tick)
  const loadState = useGameStore(s => s.loadState)
  const updateLastActive = useGameStore(s => s.updateLastActive)
  const playerId = useGameStore(s => s.playerId)
  const playerName = useGameStore(s => s.playerName)
  const totalBitsEarned = useGameStore(s => s.totalBitsEarned)
  const prestigeCount = useGameStore(s => s.prestigeCount)
  const purchasedUpgrades = useGameStore(s => s.purchasedUpgrades)
  const state = useGameStore(s => s)
  const getState = () => useGameStore.getState()

  const [mobileTab, setMobileTab] = useState<MobileTab>('run')
  const [desktopTab, setDesktopTab] = useState<DesktopTab>('shop')
  const [showPrestige, setShowPrestige] = useState(false)
  const [showNameModal, setShowNameModal] = useState(false)
  const [offlineResult, setOfflineResult] = useState<{ result: OfflineResult; state: GameState } | null>(null)
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([])
  const [activeEvent, setActiveEvent] = useState<GameEvent | null>(null)
  const eventIdRef = useRef(0)
  const initialized = useRef(false)

  // Available upgrade count for badge
  const upgradeCount = UPGRADES.filter(u =>
    !purchasedUpgrades.includes(u.id) && isUpgradeUnlocked(u.id, state)
  ).length

  // Load save & calc offline on mount
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const saved = loadGame()
    if (saved) {
      const offlineRes = calcOfflineEarnings(saved)
      loadState(saved)
      saveGame()
      setTimeout(() => submitScore(useGameStore.getState()), 500)
      if (offlineRes.earnings > 0) {
        useGameStore.setState(s => ({
          bits: s.bits + offlineRes.earnings,
          totalBitsEarned: s.totalBitsEarned + offlineRes.earnings,
          lastActive: Date.now(),
        }))
        setOfflineResult({ result: offlineRes, state: saved })
      }
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
      if (playerName && playerId) submitScore(getState())
    }, 30_000)
    return () => clearInterval(interval)
  }, [playerId, playerName, totalBitsEarned, prestigeCount])

  // Submit score on name set or prestige
  useEffect(() => {
    if (playerName && playerId && totalBitsEarned > 0) {
      submitScore(useGameStore.getState())
    }
  }, [playerName, prestigeCount])

  // Random quicktime events — spawn every 3–8 minutes
  useEffect(() => {
    const EVENT_TYPES: GameEventType[] = ['zero_day', 'data_exfil', 'overclock']
    const scheduleNext = () => {
      const delay = (180 + Math.random() * 300) * 1000 // 3–8 min
      return setTimeout(() => {
        if (!activeEvent) {
          const type = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)]
          setActiveEvent({ id: ++eventIdRef.current, type })
        }
        scheduleNext()
      }, delay)
    }
    const t = scheduleNext()
    return () => clearTimeout(t)
  }, [])

  // Save on tab close
  useEffect(() => {
    const handler = () => {
      updateLastActive()
      saveGame()
      if (playerName && playerId) submitScore(useGameStore.getState())
    }
    window.addEventListener('beforeunload', handler)
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') handler()
    })
    return () => window.removeEventListener('beforeunload', handler)
  }, [updateLastActive, playerId, playerName, totalBitsEarned, prestigeCount])

  const desktopTabs = [
    { id: 'shop' as DesktopTab, label: 'SHOP', icon: '⬡' },
    { id: 'mods' as DesktopTab, label: 'MODS', icon: '⚡', badge: upgradeCount },
    { id: 'agent' as DesktopTab, label: 'AGENT', icon: '◈' },
  ]

  return (
    <div className="min-h-dvh bg-[#050508] flex flex-col">
      <ResourceDisplay />

      {/* Desktop Layout */}
      <div className="hidden md:flex flex-1 overflow-hidden">

        {/* Left: Gameplay — click area takes full focus */}
        <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto relative">
          {/* subtle scanline bg */}
          <div className="scanline pointer-events-none absolute inset-0 opacity-[0.03]" />
          <ClickArea onPrestigeClick={() => setShowPrestige(true)} />
        </div>

        {/* Right: Tabbed management panel */}
        <div className="w-[380px] border-l border-slate-800/50 flex flex-col overflow-hidden bg-[#06060a]">

          {/* Tab bar */}
          <div className="flex border-b border-slate-800/50 shrink-0">
            {desktopTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setDesktopTab(tab.id)}
                className={`
                  relative flex-1 flex flex-col items-center justify-center py-3 gap-0.5
                  font-mono text-[10px] tracking-widest transition-all duration-150
                  ${desktopTab === tab.id
                    ? 'text-cyan-400 bg-cyan-950/20 border-b border-cyan-500/50'
                    : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800/20 border-b border-transparent'
                  }
                `}
              >
                <span className="text-base leading-none">{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute top-1.5 right-3 min-w-[16px] h-4 px-1 rounded-full
                    bg-cyan-500 text-[#050508] font-mono font-bold text-[9px]
                    flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {desktopTab === 'shop' && <ProducerList />}
            {desktopTab === 'mods' && <UpgradePanel />}
            {desktopTab === 'agent' && (
              <div className="flex flex-col gap-0">
                <div className="p-2">
                  <AccountPanel entries={leaderboardEntries} />
                </div>
                <div className="border-t border-slate-800/50">
                  <Leaderboard onEntriesChange={setLeaderboardEntries} />
                </div>
              </div>
            )}
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
            { id: 'shop' as MobileTab, label: 'SHOP', icon: '⬡' },
            { id: 'upgrades' as MobileTab, label: 'MODS', icon: '⚡', badge: upgradeCount },
            { id: 'rank' as MobileTab, label: 'AGENT', icon: '◈' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={`
                relative flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5
                font-mono text-[10px] tracking-widest transition-colors
                ${mobileTab === tab.id ? 'text-cyan-400 bg-cyan-950/20' : 'text-slate-600 hover:text-slate-400'}
              `}
            >
              <span className="text-base">{tab.icon}</span>
              <span>{tab.label}</span>
              {'badge' in tab && tab.badge > 0 && (
                <span className="absolute top-1.5 right-3 min-w-[16px] h-4 px-1 rounded-full
                  bg-cyan-500 text-[#050508] font-mono font-bold text-[9px]
                  flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      <OnboardingHint />
      {activeEvent && (
        <EventPopup
          event={activeEvent}
          onClaim={() => setActiveEvent(null)}
          onExpire={() => setActiveEvent(null)}
        />
      )}
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
