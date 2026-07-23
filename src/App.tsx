import { useEffect, useState, useRef } from 'react'
import { useGameStore } from './game/store'
import { saveGame, loadGame, calcOfflineEarnings } from './game/save'
import { submitScore, isLegacySyncCode, rotateSyncCode, claimBounty } from './game/supabase'
import { emitToast } from './game/toastBus'
import { generateSyncCode } from './game/store'

import type { OfflineResult } from './game/save'
import type { GameState } from './game/types'
import { ResourceDisplay } from './components/ResourceDisplay'
import { ClickArea } from './components/ClickArea'
import { ProducerList } from './components/ProducerList'
import { UpgradePanel } from './components/UpgradePanel'
import { PrestigeModal } from './components/PrestigeModal'
import { GhostShopModal } from './components/GhostShopModal'
import { AscensionModal } from './components/AscensionModal'
import { DailyModal } from './components/DailyModal'
import { OfflineModal } from './components/OfflineModal'
import { NameModal } from './components/NameModal'
import { Leaderboard, type LeaderboardEntry } from './components/Leaderboard'
import { AccountPanel } from './components/AccountPanel'
import { OnboardingHint } from './components/OnboardingHint'
import { EventPopup, type GameEvent, type GameEventType } from './components/EventPopup'
import { AchievementToastQueue } from './components/AchievementToast'
import { AchievementsPanel } from './components/AchievementsPanel'
import { ChipPanel } from './components/ChipPanel'
import { RaidModal } from './components/RaidModal'
import { DataPacketLayer } from './components/DataPacketLayer'
import { StatsPanel } from './components/StatsPanel'
import { MatrixRain } from './components/MatrixRain'
import { DilemmaModal } from './components/DilemmaModal'
import { rollDilemma } from './game/dilemmas'
import { initAudio } from './game/sound'
import { isUpgradeUnlocked, isChipUnlocked, dailyStreakInfo, formatBits } from './game/utils'
import { UPGRADES } from './game/constants'

type MobileTab = 'run' | 'shop' | 'upgrades' | 'chip' | 'rank'
type DesktopTab = 'shop' | 'mods' | 'chip' | 'agent'

/**
 * Upgrades a pre-lockdown 6-char sync code to the current 12-char one. The new code is
 * only adopted locally once the server confirms the swap — otherwise the client would
 * hold a code the stored row does not have and every later save would be rejected.
 */
async function upgradeLegacySyncCode(saved: GameState) {
  if (!saved.syncCode || !isLegacySyncCode(saved.syncCode)) return
  const fresh = generateSyncCode()
  const ok = await rotateSyncCode(saved.playerId, saved.syncCode, fresh)
  if (!ok) return
  useGameStore.setState({ syncCode: fresh })
  saveGame()
}

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
  const [showGhostShop, setShowGhostShop] = useState(false)
  const [showAscension, setShowAscension] = useState(false)
  const [showDaily, setShowDaily] = useState(false)
  const [showNameModal, setShowNameModal] = useState(false)
  const [showRaid, setShowRaid] = useState(false)
  const [offlineResult, setOfflineResult] = useState<{ result: OfflineResult; state: GameState } | null>(null)
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([])
  const [activeEvent, setActiveEvent] = useState<GameEvent | null>(null)
  const [pendingDilemma, setPendingDilemma] = useState<{ id: string; dilemmaId: string } | null>(null)
  const [dilemmaOpen, setDilemmaOpen] = useState(false)
  const eventIdRef = useRef(0)
  const dilemmaIdRef = useRef(0)
  const lastDilemmaRef = useRef<string | undefined>(undefined)
  const initialized = useRef(false)

  // Available upgrade count for badge
  const upgradeCount = UPGRADES.filter(u =>
    !purchasedUpgrades.includes(u.id) && isUpgradeUnlocked(u.id, state)
  ).length

  // Load save & calc offline on mount
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // Arm background music to start on the first user gesture (if it was left on)
    initAudio()

    const saved = loadGame()
    if (saved) {
      const offlineRes = calcOfflineEarnings(saved)
      loadState(saved)
      saveGame()
      void upgradeLegacySyncCode(saved)
      setTimeout(() => submitScore(useGameStore.getState()), 500)
      // Defence bounties earned while offline: a raid your base repelled minted bits for you.
      if (saved.playerName && saved.syncCode) {
        void claimBounty(saved.playerId, saved.syncCode).then(bounty => {
          if (bounty > 0) {
            useGameStore.setState(s => ({
              bits: s.bits + bounty,
              totalBitsEarned: s.totalBitsEarned + bounty,
            }))
            emitToast({ kind: 'info', icon: '🛡', title: 'Basis verteidigt', text: `+${formatBits(bounty)} Bounty kassiert` })
          }
        })
      }
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

    // Assign the first story operation right away
    useGameStore.getState().syncQuest()

    // Daily streak — shown as an active check-in prompt on the first login of the day,
    // once any welcome/offline modal has cleared. Claiming persists immediately.
    setTimeout(() => {
      if (dailyStreakInfo(useGameStore.getState()).claimable) setShowDaily(true)
    }, 1400)
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

  // Decision dilemmas — anonymous contacts with risk/reward choices, every ~8–12 min
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const scheduleNext = (first: boolean) => {
      const fast = localStorage.getItem('nullbyte_fast_dilemmas') === '1'
      const delay = fast ? 4_000 : (first ? 90 + Math.random() * 120 : 480 + Math.random() * 240) * 1000
      timer = setTimeout(() => {
        const cur = useGameStore.getState()
        // Don't stack on top of an active event or an already-pending dilemma
        if (!activeEvent && !pendingDilemma) {
          const rolled = rollDilemma(cur, lastDilemmaRef.current)
          if (rolled) {
            lastDilemmaRef.current = rolled.id
            setPendingDilemma({ id: `d${++dilemmaIdRef.current}`, dilemmaId: rolled.id })
          }
        }
        scheduleNext(false)
      }, delay)
    }
    scheduleNext(true)
    return () => clearTimeout(timer)
  }, [activeEvent, pendingDilemma])

  // Auto-dismiss an ignored dilemma after 90s (counts as decline, no side effects)
  useEffect(() => {
    if (!pendingDilemma || dilemmaOpen) return
    const t = setTimeout(() => setPendingDilemma(null), 90_000)
    return () => clearTimeout(t)
  }, [pendingDilemma, dilemmaOpen])

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

  const chipUnlocked = isChipUnlocked(state)
  // The CHIP tab is always shown — locked with a 🔒 until unlocked — so new players
  // discover the mechanic exists instead of it appearing out of nowhere.
  const desktopTabs: { id: DesktopTab; label: string; icon: string; badge?: number; locked?: boolean }[] = [
    { id: 'shop', label: 'SHOP', icon: '⬡' },
    { id: 'mods', label: 'MODS', icon: '⚡', badge: upgradeCount },
    { id: 'chip', label: 'CHIP', icon: '▦', locked: !chipUnlocked },
    { id: 'agent', label: 'AGENT', icon: '◈' },
  ]

  // Visual tier (0-5): grows with progress within a run and permanently with prestige count —
  // the world gets visibly more intense the further you push.
  const visualTier = Math.min(
    5,
    Math.floor(Math.log10(Math.max(1, totalBitsEarned)) / 3) + prestigeCount
  )
  const tierHue = 190 - visualTier * 28 // cyan → purple/red as tier rises
  const scanlineOpacity = 0.02 + visualTier * 0.012

  return (
    <div className="h-dvh bg-[#050508] flex flex-col overflow-hidden">
      {/* Ambient glow that intensifies and shifts hue with progress tier */}
      <div
        className="fixed inset-0 pointer-events-none z-0 transition-[background] duration-1000"
        style={{
          background: `radial-gradient(ellipse at 50% 25%, hsla(${tierHue}, 85%, 55%, ${0.02 + visualTier * 0.018}) 0%, transparent 65%)`,
        }}
      />
      <ResourceDisplay />

      {/* Desktop Layout */}
      <div className="hidden md:flex flex-1 min-h-0 overflow-hidden">

        {/* Left: Gameplay — click area takes full focus */}
        <div className="flex-1 min-h-0 flex flex-col items-center overflow-y-auto relative">
          {/* ambient background: code rain + scanlines + vignette, intensify with progress tier */}
          <MatrixRain hue={tierHue} opacity={0.05 + visualTier * 0.014} />
          <div className="scanline pointer-events-none absolute inset-0 transition-opacity duration-1000" style={{ opacity: scanlineOpacity }} />
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.4) 100%)' }} />
          <ClickArea onPrestigeClick={() => setShowPrestige(true)} onGhostShopClick={() => setShowGhostShop(true)} onAscensionClick={() => setShowAscension(true)} />
          <DataPacketLayer />
        </div>

        {/* Right: Tabbed management panel */}
        <div className="w-[380px] min-h-0 border-l border-slate-800/50 flex flex-col overflow-hidden bg-[#06060a]">

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
                <span className={`text-base leading-none ${tab.locked ? 'opacity-40' : ''}`}>{tab.icon}</span>
                <span className={tab.locked ? 'opacity-50' : ''}>{tab.label}</span>
                {tab.locked && <span className="absolute top-1.5 right-3 text-[9px] opacity-60">🔒</span>}
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
          <div className="flex-1 min-h-0 overflow-y-auto">
            {desktopTab === 'shop' && <ProducerList />}
            {desktopTab === 'mods' && <UpgradePanel />}
            {desktopTab === 'chip' && <ChipPanel onRaid={() => setShowRaid(true)} />}
            {desktopTab === 'agent' && (
              <div className="flex flex-col gap-0">
                <div className="p-2">
                  <AccountPanel entries={leaderboardEntries} />
                </div>
                <div className="border-t border-slate-800/50">
                  <Leaderboard onEntriesChange={setLeaderboardEntries} />
                </div>
                <div className="border-t border-slate-800/50">
                  <StatsPanel />
                </div>
                <div className="border-t border-slate-800/50">
                  <AchievementsPanel />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto pb-16">
          {mobileTab === 'run' && (
            <div className="relative min-h-full flex flex-col items-center">
              <MatrixRain hue={tierHue} opacity={0.05 + visualTier * 0.014} />
              <ClickArea onPrestigeClick={() => setShowPrestige(true)} onGhostShopClick={() => setShowGhostShop(true)} onAscensionClick={() => setShowAscension(true)} />
              <DataPacketLayer />
            </div>
          )}
          {mobileTab === 'shop' && <ProducerList />}
          {mobileTab === 'upgrades' && <UpgradePanel />}
          {mobileTab === 'chip' && <ChipPanel onRaid={() => setShowRaid(true)} />}
          {mobileTab === 'rank' && (
            <div className="space-y-2 p-2">
              <AccountPanel entries={leaderboardEntries} />
              <Leaderboard onEntriesChange={setLeaderboardEntries} />
              <StatsPanel />
              <AchievementsPanel />
            </div>
          )}
        </div>

        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#080810]/95 backdrop-blur-sm border-t border-slate-800/70 flex">
          {([
            { id: 'run' as MobileTab, label: 'RUN', icon: '⌨' },
            { id: 'shop' as MobileTab, label: 'SHOP', icon: '⬡' },
            { id: 'upgrades' as MobileTab, label: 'MODS', icon: '⚡', badge: upgradeCount },
            { id: 'chip' as MobileTab, label: 'CHIP', icon: '▦', locked: !chipUnlocked },
            { id: 'rank' as MobileTab, label: 'AGENT', icon: '◈' },
          ] as { id: MobileTab; label: string; icon: string; badge?: number; locked?: boolean }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={`
                relative flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5
                font-mono text-[10px] tracking-widest transition-colors
                ${mobileTab === tab.id ? 'text-cyan-400 bg-cyan-950/20' : 'text-slate-600 hover:text-slate-400'}
              `}
            >
              <span className={`text-base ${tab.locked ? 'opacity-40' : ''}`}>{tab.icon}</span>
              <span className={tab.locked ? 'opacity-50' : ''}>{tab.label}</span>
              {tab.locked && <span className="absolute top-1 right-2 text-[8px] opacity-60">🔒</span>}
              {tab.badge != null && tab.badge > 0 && (
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
      <AchievementToastQueue />
      {activeEvent && (
        <EventPopup
          event={activeEvent}
          onClaim={() => setActiveEvent(null)}
          onExpire={() => setActiveEvent(null)}
        />
      )}

      {/* Incoming-transmission indicator — click to open the decision */}
      {pendingDilemma && !dilemmaOpen && (
        <button
          onClick={() => setDilemmaOpen(true)}
          className="
            fixed top-16 left-1/2 -translate-x-1/2 z-50 slide-in
            flex items-center gap-2.5 px-4 py-2.5 rounded
            border border-purple-600/60 bg-[#0a060d]/95 backdrop-blur-sm
            shadow-[0_0_28px_rgba(168,85,247,0.14)]
            font-mono text-xs text-purple-300 hover:bg-purple-950/40 transition-all
            animate-pulse
          "
        >
          <span className="text-base">📡</span>
          <span className="tracking-widest">EINGEHENDE ÜBERTRAGUNG</span>
          <span className="text-purple-500/70">▸ öffnen</span>
        </button>
      )}
      {pendingDilemma && dilemmaOpen && (
        <DilemmaModal
          dilemmaId={pendingDilemma.dilemmaId}
          decideMs={45_000}
          onClose={() => { setDilemmaOpen(false); setPendingDilemma(null) }}
        />
      )}
      {showPrestige && (
        <PrestigeModal
          onClose={() => setShowPrestige(false)}
          onOpenGhostShop={() => { setShowPrestige(false); setShowGhostShop(true) }}
        />
      )}
      {showGhostShop && <GhostShopModal onClose={() => setShowGhostShop(false)} />}
      {showAscension && <AscensionModal onClose={() => setShowAscension(false)} />}
      {showRaid && <RaidModal onClose={() => setShowRaid(false)} />}
      {/* Daily waits behind any welcome/name/offline modal so they never stack — once
          those clear (setShowNameModal(false) / setOfflineResult(null)) it appears. */}
      {showDaily && !showNameModal && !offlineResult && (
        <DailyModal onClose={() => setShowDaily(false)} />
      )}
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
