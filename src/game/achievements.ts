import type { GameState } from './types'
import { PRODUCERS, UPGRADES } from './constants'

export interface AchievementDef {
  id: string
  name: string
  description: string
  flavor: string
  icon: string
  check: (state: GameState) => boolean
}

function ownedCount(state: GameState, producerId: string): number {
  return state.producers[producerId] ?? 0
}

const clickAchievements: AchievementDef[] = [
  {
    id: 'click_1',
    name: 'Hello World',
    description: 'Ersten Klick ausgeführt',
    flavor: 'Jede Karriere im Cybercrime beginnt mit einem einzigen Tastendruck.',
    icon: '⌨',
    check: s => s.totalClicks >= 1,
  },
  {
    id: 'click_100',
    name: 'RSI in Ausbildung',
    description: '100 Klicks',
    flavor: 'Dein Handgelenk meldet sich zu Wort.',
    icon: '⌨',
    check: s => s.totalClicks >= 100,
  },
  {
    id: 'click_1000',
    name: 'Tastatur-Veteran',
    description: '1.000 Klicks',
    flavor: 'Die Enter-Taste hat schon bessere Tage gesehen.',
    icon: '⌨',
    check: s => s.totalClicks >= 1_000,
  },
  {
    id: 'click_10000',
    name: 'Menschlicher Loop',
    description: '10.000 Klicks',
    flavor: 'Du bist effizienter geworden als manches deiner Scripts.',
    icon: '⌨',
    check: s => s.totalClicks >= 10_000,
  },
  {
    id: 'click_100000',
    name: 'Karpaltunnel-Champion',
    description: '100.000 Klicks',
    flavor: 'Ein Arzt würde jetzt eingreifen. Du klickst weiter.',
    icon: '⌨',
    check: s => s.totalClicks >= 100_000,
  },
]

const wealthAchievements: AchievementDef[] = [
  {
    id: 'wealth_1k',
    name: 'Erste Kilobyte',
    description: '1 KB insgesamt verdient',
    flavor: 'Der bescheidene Anfang jedes Imperiums.',
    icon: '💾',
    check: s => s.totalBitsEarned >= 1_000,
  },
  {
    id: 'wealth_1m',
    name: 'Millionär in Bits',
    description: '1 MB insgesamt verdient',
    flavor: 'In echtem Geld wäre das ungefähr nichts wert.',
    icon: '💾',
    check: s => s.totalBitsEarned >= 1_000_000,
  },
  {
    id: 'wealth_1b',
    name: 'Datenbaron',
    description: '1 GB insgesamt verdient',
    flavor: 'Dein Netzwerkverkehr fällt jetzt auf.',
    icon: '💾',
    check: s => s.totalBitsEarned >= 1_000_000_000,
  },
  {
    id: 'wealth_1t',
    name: 'Terabyte-Tyrann',
    description: '1 TB insgesamt verdient',
    flavor: 'Selbst die NSA hat jetzt einen Ordner für dich.',
    icon: '💾',
    check: s => s.totalBitsEarned >= 1e12,
  },
  {
    id: 'wealth_1qa',
    name: 'Petabyte-Phantom',
    description: '1 PB insgesamt verdient',
    flavor: 'Rechenzentren fürchten deinen Namen.',
    icon: '💾',
    check: s => s.totalBitsEarned >= 1e15,
  },
  {
    id: 'wealth_1qi',
    name: 'Exabyte-Entität',
    description: '1 EB insgesamt verdient',
    flavor: 'Das Internet in Gänze wiegt weniger als du.',
    icon: '💾',
    check: s => s.totalBitsEarned >= 1e18,
  },
  {
    id: 'wealth_1sx',
    name: 'Zettabyte-Gottheit',
    description: '1 ZB insgesamt verdient',
    flavor: 'Physiker sind sich nicht mehr sicher, ob das erlaubt ist.',
    icon: '💾',
    check: s => s.totalBitsEarned >= 1e21,
  },
]

const producerMasteryAchievements: AchievementDef[] = PRODUCERS.map(def => ({
  id: `mastery_${def.id}`,
  name: `${def.name}-Meister`,
  description: `25× ${def.name} besessen`,
  flavor: def.flavor,
  icon: def.icon,
  check: s => ownedCount(s, def.id) >= 25,
}))

const collectionAchievements: AchievementDef[] = [
  {
    id: 'collect_all',
    name: 'Full Stack',
    description: 'Von jedem Producer mindestens einen besitzen',
    flavor: 'Ein Generalist. Meister von nichts, Herr über alles.',
    icon: '⬡',
    check: s => PRODUCERS.every(def => ownedCount(s, def.id) > 0),
  },
  {
    id: 'collect_endgame',
    name: 'An der Spitze der Nahrungskette',
    description: `Mindestens einen ${PRODUCERS[PRODUCERS.length - 1].name} besitzen`,
    flavor: 'Ganz oben ist es einsam. Und profitabel.',
    icon: PRODUCERS[PRODUCERS.length - 1].icon,
    check: s => ownedCount(s, PRODUCERS[PRODUCERS.length - 1].id) > 0,
  },
]

const prestigeAchievements: AchievementDef[] = [
  {
    id: 'prestige_1',
    name: 'Go Dark',
    description: 'Zum ersten Mal prestiged',
    flavor: 'Du existierst nicht mehr. Offiziell.',
    icon: '👻',
    check: s => s.prestigeCount >= 1,
  },
  {
    id: 'prestige_5',
    name: 'Serienphantom',
    description: '5× prestiged',
    flavor: 'Fünf Identitäten verbrannt. Null Reue.',
    icon: '👻',
    check: s => s.prestigeCount >= 5,
  },
  {
    id: 'prestige_10',
    name: 'Digitale Wiedergeburt',
    description: '10× prestiged',
    flavor: 'Der Kreislauf von Tod und Neustart wird zur Routine.',
    icon: '👻',
    check: s => s.prestigeCount >= 10,
  },
  {
    id: 'prestige_25',
    name: 'Der Ewige Ghost',
    description: '25× prestiged',
    flavor: 'Manche Menschen meditieren. Du löschst dich selbst.',
    icon: '👻',
    check: s => s.prestigeCount >= 25,
  },
  {
    id: 'prestige_50',
    name: 'Jenseits von Gut und Böse',
    description: '50× prestiged',
    flavor: 'Es gibt kein Netzwerk mehr, das dich nicht kennt. Und trotzdem kennt dich niemand.',
    icon: '👻',
    check: s => s.prestigeCount >= 50,
  },
]

const eventAchievements: AchievementDef[] = [
  {
    id: 'events_1',
    name: 'Zur richtigen Zeit',
    description: '1 Event geclaimt',
    flavor: 'Timing ist alles. Glück auch.',
    icon: '⚡',
    check: s => s.totalEventsClaimed >= 1,
  },
  {
    id: 'events_10',
    name: 'Opportunist',
    description: '10 Events geclaimt',
    flavor: 'Du bist immer da, wenn die Firewall kurz schwächelt.',
    icon: '⚡',
    check: s => s.totalEventsClaimed >= 10,
  },
  {
    id: 'events_50',
    name: 'Never Miss a Beat',
    description: '50 Events geclaimt',
    flavor: 'Deine Reflexe sind jetzt schneller als der Exploit selbst.',
    icon: '⚡',
    check: s => s.totalEventsClaimed >= 50,
  },
]

const upgradeAchievements: AchievementDef[] = [
  {
    id: 'upgrades_10',
    name: 'Modder',
    description: '10 Upgrades gekauft',
    flavor: 'Jedes System lässt sich verbessern. Auch dieses.',
    icon: '⚡',
    check: s => s.purchasedUpgrades.length >= 10,
  },
  {
    id: 'upgrades_script_maxed',
    name: 'Script Kiddie No More',
    description: 'Alle Script-Upgrades gekauft',
    flavor: 'Vom Copy-Paste-Anfänger zum Compiler-Flüsterer.',
    icon: '⌨',
    check: s =>
      UPGRADES.filter(u => u.target === 'script').every(u => s.purchasedUpgrades.includes(u.id)),
  },
  {
    id: 'upgrades_offline_4',
    name: 'Autonomes System',
    description: 'Höchste Offline-Cap-Stufe erreicht',
    flavor: 'Es braucht dich nicht mehr. Du es schon.',
    icon: '🌐',
    check: s => s.purchasedUpgrades.includes('offline_4'),
  },
]

const comboAchievements: AchievementDef[] = [
  {
    id: 'combo_10',
    name: 'Im Rhythmus',
    description: '10er-Combo erreicht',
    flavor: 'Deine Finger bewegen sich schneller als dein Verstand.',
    icon: '🔥',
    check: s => s.maxCombo >= 10,
  },
  {
    id: 'combo_25',
    name: 'Menschliche Turbine',
    description: '25er-Combo erreicht',
    flavor: 'Selbst dein Trackpad braucht danach eine Pause.',
    icon: '🔥',
    check: s => s.maxCombo >= 25,
  },
]

const miscAchievements: AchievementDef[] = [
  {
    id: 'misc_broke',
    name: 'Alles verzockt',
    description: 'Fast alle Bits auf einmal ausgegeben',
    flavor: 'Finanzielle Disziplin war noch nie deine Stärke.',
    icon: '💸',
    check: s => s.totalBitsEarned >= 10_000 && s.bits < 1 && s.prestigeCount === 0,
  },
  {
    id: 'misc_ghost_shop',
    name: 'Schattenwirtschaft',
    description: 'Ein Ghost-Upgrade auf Maximalstufe gebracht',
    flavor: 'Die dunkle Seite zahlt besser. Hat man dir gesagt.',
    icon: '👻',
    check: s => Object.values(s.purchasedPrestigeUpgrades).some(count => count >= 5),
  },
]

const activityAchievements: AchievementDef[] = [
  {
    id: 'packet_1',
    name: 'Abgefangen',
    description: '1 Data Packet gefangen',
    flavor: 'Unverschlüsselt und herrenlos. Jetzt deins.',
    icon: '📦',
    check: s => s.packetsCaught >= 1,
  },
  {
    id: 'packet_25',
    name: 'Paketdieb',
    description: '25 Data Packets gefangen',
    flavor: 'DHL hasst diesen Trick.',
    icon: '📦',
    check: s => s.packetsCaught >= 25,
  },
  {
    id: 'contracts_5',
    name: 'Auftragnehmer',
    description: '5 Aufträge abgeschlossen',
    flavor: 'Zuverlässig, diskret, bezahlbar in Bits.',
    icon: '📋',
    check: s => s.contractsCompleted >= 5,
  },
  {
    id: 'contracts_50',
    name: 'Söldner des Netzes',
    description: '50 Aufträge abgeschlossen',
    flavor: 'Dein Ruf eilt dir durch jeden Backbone voraus.',
    icon: '📋',
    check: s => s.contractsCompleted >= 50,
  },
  {
    id: 'streak_7',
    name: 'Stammgast',
    description: '7 Tage Daily Streak',
    flavor: 'Eine Woche ohne Ausfall. Dein System auch.',
    icon: '🔥',
    check: s => s.dailyStreak >= 7,
  },
  {
    id: 'playtime_10h',
    name: 'Terminal-Bewohner',
    description: '10 Stunden Spielzeit',
    flavor: 'Sonnenlicht ist auch nur ein weiterer ungepatchter Exploit.',
    icon: '⏱',
    check: s => s.totalPlaytimeSeconds >= 36_000,
  },
  {
    id: 'quest_1',
    name: 'Operativ',
    description: 'Erste Operation abgeschlossen',
    flavor: 'Vom Auftrag zur Legende ist es ein langer Weg. Der erste Schritt zählt.',
    icon: '✦',
    check: s => s.completedQuests.length >= 1,
  },
  {
    id: 'quest_3',
    name: 'Feldagent',
    description: '3 Operationen abgeschlossen',
    flavor: 'Man kennt deinen Codenamen in Kreisen, die es offiziell nicht gibt.',
    icon: '✦',
    check: s => s.completedQuests.length >= 3,
  },
  {
    id: 'artifact_collector',
    name: 'Sammler',
    description: '3 Artefakte erhalten',
    flavor: 'Manche Dinge lassen sich nicht kaufen. Nur verdienen.',
    icon: '◈',
    check: s => s.earnedArtifacts.length >= 3,
  },
]

export const ACHIEVEMENTS: AchievementDef[] = [
  ...clickAchievements,
  ...wealthAchievements,
  ...producerMasteryAchievements,
  ...collectionAchievements,
  ...prestigeAchievements,
  ...eventAchievements,
  ...upgradeAchievements,
  ...comboAchievements,
  ...activityAchievements,
  ...miscAchievements,
]

/** Small permanent reward for completionism: +0.1% global mult per unlocked achievement, capped. */
const PER_ACHIEVEMENT_BONUS = 0.001
const MAX_ACHIEVEMENT_BONUS = 0.5

export function calcAchievementMultiplier(state: GameState): number {
  return 1 + Math.min(MAX_ACHIEVEMENT_BONUS, state.unlockedAchievements.length * PER_ACHIEVEMENT_BONUS)
}

/** Returns newly-unlocked achievement defs (does not mutate state). */
export function findNewlyUnlocked(state: GameState): AchievementDef[] {
  return ACHIEVEMENTS.filter(
    a => !state.unlockedAchievements.includes(a.id) && a.check(state)
  )
}
