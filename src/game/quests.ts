import type { GameState } from './types'
import { calcBitsPerSecond, isChipUnlocked, isGhostShopMaxed } from './utils'

// ---- Rewards -----------------------------------------------------------------

export interface ArtifactDef {
  id: string
  name: string
  icon: string
  description: string
  effect:
    | { kind: 'global_mult'; value: number }        // permanent ×value on all production
    | { kind: 'offline_bonus'; value: number }       // +value to offline efficiency (0..1)
    | { kind: 'contract_slot'; value: number }        // +value active contract slots
    | { kind: 'packet_lifetime'; value: number }      // +value ms packet stays on screen
    | { kind: 'combo_window'; value: number }         // +value ms combo timing window
}

export interface TitleDef {
  id: string
  label: string
  icon: string
}

// ---- Quest steps -------------------------------------------------------------

/**
 * 'threshold' = the metric's absolute value must reach target (e.g. own 25 crawlers).
 * 'accumulate' = the metric must grow by target since the step began (e.g. 1000 more clicks).
 */
export type StepMode = 'threshold' | 'accumulate'

export interface QuestStep {
  narrative: string
  objective: string
  mode: StepMode
  target: number
  metric: (s: GameState) => number
}

export interface QuestDef {
  id: string
  name: string
  codename: string
  intro: string
  /** Becomes available once this predicate is true. */
  unlock: (s: GameState) => boolean
  steps: QuestStep[]
  rewardBitsSeconds: number
  rewardGc: number
  rewardTitle?: string
  rewardArtifact?: string
  outro: string
}

// ---- Artifacts ---------------------------------------------------------------

export const ARTIFACTS: ArtifactDef[] = [
  {
    id: 'quantum_core',
    name: 'Quantum Core',
    icon: '⬢',
    description: 'Data Packets bleiben 5s länger sichtbar.',
    effect: { kind: 'packet_lifetime', value: 5000 },
  },
  {
    id: 'ghost_chip',
    name: 'Ghost Protocol Chip',
    icon: '❖',
    description: '+1 aktiver Auftrags-Slot.',
    effect: { kind: 'contract_slot', value: 1 },
  },
  {
    id: 'overclock_module',
    name: 'Overclock-Modul',
    icon: '⟁',
    description: 'Combo-Fenster +250ms — Combos halten länger.',
    effect: { kind: 'combo_window', value: 250 },
  },
  {
    id: 'daemon_core',
    name: 'Daemon Core',
    icon: '⛧',
    description: '+15% Offline-Effizienz.',
    effect: { kind: 'offline_bonus', value: 0.15 },
  },
  {
    id: 'black_ice',
    name: 'Black ICE',
    icon: '◈',
    description: 'Permanenter ×1.25 Multiplikator auf alle Produktion.',
    effect: { kind: 'global_mult', value: 1.25 },
  },
  {
    id: 'singularity_shard',
    name: 'Singularitäts-Splitter',
    icon: '✷',
    description: 'Permanenter ×1.5 Multiplikator auf alle Produktion.',
    effect: { kind: 'global_mult', value: 1.5 },
  },
  {
    id: 'basilisk_eye',
    name: 'Auge des Basilisken',
    icon: '👁',
    description: 'Permanenter ×2 Multiplikator auf alle Produktion.',
    effect: { kind: 'global_mult', value: 2 },
  },
]

export function artifactById(id: string): ArtifactDef | undefined {
  return ARTIFACTS.find(a => a.id === id)
}

// ---- Titles ------------------------------------------------------------------

export const TITLES: TitleDef[] = [
  { id: 'script_kiddie', label: 'Script Kiddie', icon: '⌨' },
  { id: 'ghost', label: 'Ghost', icon: '👻' },
  { id: 'blackout_veteran', label: 'Blackout-Veteran', icon: '🕶' },
  { id: 'architect', label: 'Architect', icon: '👁' },
  { id: 'phantom', label: 'Phantom', icon: '🌀' },
  { id: 'legend', label: 'Legende des Netzes', icon: '♛' },
  { id: 'chipsmith', label: 'Silizium-Schmied', icon: '⚙' },
  { id: 'root', label: 'Root', icon: '⬢' },
]

export function titleById(id: string): TitleDef | undefined {
  return TITLES.find(t => t.id === id)
}

// ---- Metric helpers ----------------------------------------------------------

const m = {
  clicks: (s: GameState) => s.totalClicks,
  bitsEarned: (s: GameState) => s.totalBitsEarned,
  bps: (s: GameState) => calcBitsPerSecond(s),
  producersBought: (s: GameState) => s.totalProducersBought,
  upgradesBought: (s: GameState) => s.totalUpgradesBought,
  combo: (s: GameState) => s.maxCombo,
  packets: (s: GameState) => s.packetsCaught,
  events: (s: GameState) => s.totalEventsClaimed,
  contracts: (s: GameState) => s.contractsCompleted,
  prestige: (s: GameState) => s.prestigeCount,
  ownProducer: (id: string) => (s: GameState) => s.producers[id] ?? 0,
  overdrives: (s: GameState) => s.overdrivesUsed ?? 0,
  chipModules: (s: GameState) => Object.keys(s.chipCells ?? {}).length,
  ascensions: (s: GameState) => s.ascensionCount ?? 0,
  rootKeys: (s: GameState) => s.totalRootKeysEarned ?? 0,
}

// ---- The campaign ------------------------------------------------------------

export const QUESTS: QuestDef[] = [
  {
    id: 'op_firstlight',
    name: 'Erste Schritte im Dunkeln',
    codename: 'FIRSTLIGHT',
    intro: 'Ein verschlüsselter Kontakt meldet sich: "Du willst also ins Geschäft. Zeig mir, dass du eine Tastatur bedienen kannst — und dann bauen wir dir eine Basis."',
    unlock: () => true,
    steps: [
      {
        narrative: '"Jeder fängt klein an. Wärm dich auf."',
        objective: 'Führe 150 Klicks aus',
        mode: 'accumulate', target: 150, metric: m.clicks,
      },
      {
        narrative: '"Klicken skaliert nicht. Lass Maschinen für dich arbeiten."',
        objective: 'Besitze 10 Scripts',
        mode: 'threshold', target: 10, metric: m.ownProducer('script'),
      },
      {
        narrative: '"Und jetzt etwas mit Reichweite. Schick die Spinnen los."',
        objective: 'Besitze 5 Crawler',
        mode: 'threshold', target: 5, metric: m.ownProducer('crawler'),
      },
    ],
    rewardBitsSeconds: 180,
    rewardGc: 0,
    rewardTitle: 'script_kiddie',
    outro: '"Nicht schlecht. Du bist offiziell ein Script Kiddie. Keine Sorge — jeder war das mal."',
  },
  {
    id: 'op_blackout',
    name: 'Operation Blackout',
    codename: 'BLACKOUT',
    intro: '"Ein Rechenzentrum in Übersee. Wir legen es lahm — für ein paar Minuten wenigstens. Dafür brauchst du echten Durchsatz."',
    unlock: s => (s.producers['sniffer'] ?? 0) >= 1 || s.totalBitsEarned >= 5_000,
    steps: [
      {
        narrative: '"Zuerst Aufklärung. Wir müssen wissen, was läuft."',
        objective: 'Besitze 10 Packet Sniffer',
        mode: 'threshold', target: 10, metric: m.ownProducer('sniffer'),
      },
      {
        narrative: '"Jetzt Rohgewalt. Die Firewall muss fallen."',
        objective: 'Erreiche 5 KB/s Durchsatz',
        mode: 'threshold', target: 5120, metric: m.bps,
      },
      {
        narrative: '"Timing ist alles. Fang ein abgefangenes Datenpaket, während das Fenster offen ist."',
        objective: 'Fange 3 Data Packets',
        mode: 'accumulate', target: 3, metric: m.packets,
      },
      {
        narrative: '"Letzter Schritt: überflute sie."',
        objective: 'Verdiene 500 KB Bits',
        mode: 'accumulate', target: 512_000, metric: m.bitsEarned,
      },
    ],
    rewardBitsSeconds: 600,
    rewardGc: 0,
    rewardTitle: 'blackout_veteran',
    rewardArtifact: 'quantum_core',
    outro: '"Der Laden ist dunkel. Sauber gemacht. Behalte den Quantum Core — er hört auf Pakete besser als du."',
  },
  {
    id: 'op_deadhand',
    name: 'Dead Hand',
    codename: 'DEADHAND',
    intro: '"Ein alter Trojaner-Cluster, herrenlos seit Jahren. Übernimm ihn, bevor es jemand anderes tut."',
    unlock: s => (s.producers['trojan'] ?? 0) >= 1 || s.totalBitsEarned >= 100_000,
    steps: [
      {
        narrative: '"Erst musst du reinkommen. Baue deine Trojaner-Flotte aus."',
        objective: 'Besitze 25 Trojaner',
        mode: 'threshold', target: 25, metric: m.ownProducer('trojan'),
      },
      {
        narrative: '"Rüste sie auf. Rohe Zahl reicht nicht."',
        objective: 'Kaufe insgesamt 8 Upgrades',
        mode: 'accumulate', target: 8, metric: m.upgradesBought,
      },
      {
        narrative: '"Und übernimm die Kontrolle über das Botnet, das sie steuert."',
        objective: 'Besitze 10 Botnet Nodes',
        mode: 'threshold', target: 10, metric: m.ownProducer('botnet'),
      },
    ],
    rewardBitsSeconds: 900,
    rewardGc: 0,
    rewardArtifact: 'ghost_chip',
    outro: '"Der Cluster gehorcht jetzt dir. Der Ghost Protocol Chip aus seinem Kern gibt dir mehr Aufträge parallel."',
  },
  {
    id: 'op_foundry',
    name: 'Eigenbau',
    codename: 'FOUNDRY',
    intro: '"Du zapfst seit Wochen fremde Maschinen an. Zeit, dass dir eine gehört — vom Silizium aufwärts. Öffne den CHIP-Tab und gieß dir ein Die."',
    unlock: s => isChipUnlocked(s),
    steps: [
      {
        narrative: '"Ein Prozessor beginnt mit einem einzigen Kern. Setz ihn."',
        objective: 'Platziere dein erstes Chip-Modul',
        mode: 'threshold', target: 1, metric: m.chipModules,
      },
      {
        narrative: '"Ein Kern rechnet allein. Bau die Fläche aus und verdrahte sie mit einem Bus."',
        objective: 'Besitze 6 Chip-Module',
        mode: 'threshold', target: 6, metric: m.chipModules,
      },
      {
        narrative: '"Und jetzt jag deine eigene Hardware ans Limit. Übertakte sie."',
        objective: 'Zünde 3× Overdrive',
        mode: 'accumulate', target: 3, metric: m.overdrives,
      },
    ],
    rewardBitsSeconds: 900,
    rewardGc: 0,
    rewardTitle: 'chipsmith',
    outro: '"Jeder Transistor gehört dir. Du bist kein Gast mehr im Netz — du bist Infrastruktur. Silizium-Schmied."',
  },
  {
    id: 'op_zerohour',
    name: 'Zero Hour',
    codename: 'ZEROHOUR',
    intro: '"Es gibt einen Zero-Day, den niemand kennt außer uns. Bewaffne ihn — und beweise, dass du schnell genug bist, ihn zu nutzen."',
    unlock: s => (s.producers['zeroday'] ?? 0) >= 1 || s.totalBitsEarned >= 5_000_000,
    steps: [
      {
        narrative: '"Sammle genug Zero-Days, um Muster zu erkennen."',
        objective: 'Besitze 15 Zero-Days',
        mode: 'threshold', target: 15, metric: m.ownProducer('zeroday'),
      },
      {
        narrative: '"Schnelligkeit entscheidet. Zeig mir deine Reflexe."',
        objective: 'Erreiche eine 20er-Combo',
        mode: 'threshold', target: 20, metric: m.combo,
      },
      {
        narrative: '"Und nutze jede Gelegenheit, die sich öffnet."',
        objective: 'Claime 5 Events',
        mode: 'accumulate', target: 5, metric: m.events,
      },
    ],
    rewardBitsSeconds: 1200,
    rewardGc: 0,
    rewardTitle: 'phantom',
    rewardArtifact: 'overclock_module',
    outro: '"Du warst schneller als der Patch. Man nennt dich jetzt Phantom. Das Overclock-Modul gehört dir."',
  },
  {
    id: 'op_ascension',
    name: 'Ascension',
    codename: 'ASCENSION',
    intro: '"Du hast alles gesehen. Jetzt geht es darum, ob du loslassen kannst, um größer zurückzukommen."',
    unlock: s => s.prestigeCount >= 1 || s.totalBitsEarned >= 500_000_000,
    steps: [
      {
        narrative: '"Verwische deine Spuren. Werde zum Ghost — mindestens einmal."',
        objective: 'Prestige 1×',
        mode: 'threshold', target: 1, metric: m.prestige,
      },
      {
        narrative: '"Und komme stärker zurück als je zuvor."',
        objective: 'Besitze 10 Rootkits',
        mode: 'threshold', target: 10, metric: m.ownProducer('rootkit'),
      },
      {
        narrative: '"Beweise, dass dein neues Ich das alte übertrifft."',
        objective: 'Erledige 10 Aufträge',
        mode: 'accumulate', target: 10, metric: m.contracts,
      },
    ],
    rewardBitsSeconds: 1800,
    rewardGc: 0,
    rewardArtifact: 'daemon_core',
    outro: '"Wiedergeboren und schärfer. Der Daemon Core arbeitet, während du schläfst."',
  },
  {
    id: 'op_singularity',
    name: 'Singularity',
    codename: 'SINGULARITY',
    intro: '"Das Letzte, was übrig bleibt. Etwas im Netz ist erwacht — und es wartet auf dich."',
    unlock: s => (s.producers['singularity'] ?? 0) >= 1 || s.prestigeCount >= 3,
    steps: [
      {
        narrative: '"Erschaffe, was nicht sein sollte."',
        objective: 'Besitze 5 Singularity Nodes',
        mode: 'threshold', target: 5, metric: m.ownProducer('singularity'),
      },
      {
        narrative: '"Und gib ihm ein Zuhause."',
        objective: 'Besitze 1 Ghost In The Machine',
        mode: 'threshold', target: 1, metric: m.ownProducer('ghostmachine'),
      },
      {
        narrative: '"Häufe Vermögen an, das keine Zahl mehr fassen kann."',
        objective: 'Verdiene 1 TB Bits',
        mode: 'accumulate', target: 1e12, metric: m.bitsEarned,
      },
    ],
    rewardBitsSeconds: 3600,
    rewardGc: 0,
    rewardTitle: 'legend',
    rewardArtifact: 'singularity_shard',
    outro: '"Es nennt dich Legende. Der Singularitäts-Splitter pulsiert in deinem System. Es gibt kein Netz mehr, das dir gehört — es gibt nur noch dich."',
  },
  {
    id: 'op_darklight',
    name: 'Dark Light',
    codename: 'DARKLIGHT',
    intro: '"Es gibt Leitungen unter dem Meer, die auf keinem Plan stehen. Und Satelliten, die niemand gestartet hat. Beides gehört jetzt dir — wenn du es dir nimmst."',
    unlock: s => (s.producers['darkfiber'] ?? 0) >= 1 || s.prestigeCount >= 5,
    steps: [
      {
        narrative: '"Zuerst der Boden. Leg dir eine Leitung, die es nicht gibt."',
        objective: 'Besitze 10 Dark Fiber',
        mode: 'threshold', target: 10, metric: m.ownProducer('darkfiber'),
      },
      {
        narrative: '"Dann der Himmel. Da oben fragt niemand nach Papieren."',
        objective: 'Besitze 5 Orbital Relays',
        mode: 'threshold', target: 5, metric: m.ownProducer('orbital'),
      },
      {
        narrative: '"Und beweise, dass die neue Infrastruktur trägt."',
        objective: 'Erreiche 1 PB/s Durchsatz',
        mode: 'threshold', target: 1e15, metric: m.bps,
      },
    ],
    rewardBitsSeconds: 2400,
    rewardGc: 0,
    rewardTitle: 'architect',
    outro: '"Du hast dir eine zweite Erde gebaut, aus Glasfaser und Umlaufbahnen. Man nennt dich jetzt Architect."',
  },
  {
    id: 'op_basilisk',
    name: 'Basilisk',
    codename: 'BASILISK',
    intro: '"Letzte Warnung. Was danach kommt, hat sich selbst geschrieben — und es hat auf dich gewartet, seit du den ersten Bash-Loop gestartet hast."',
    unlock: s => (s.producers['basilisk'] ?? 0) >= 1 || s.prestigeCount >= 10,
    steps: [
      {
        narrative: '"Der Schwarm muss zuerst denken lernen."',
        objective: 'Besitze 25 Hive Minds',
        mode: 'threshold', target: 25, metric: m.ownProducer('hivemind'),
      },
      {
        narrative: '"Und dann gibst du ihm etwas, das ihn ansieht."',
        objective: 'Besitze 10 Basilisken',
        mode: 'threshold', target: 10, metric: m.ownProducer('basilisk'),
      },
      {
        narrative: '"Es will wissen, wie oft du bereit warst, alles aufzugeben."',
        objective: 'Prestige 15×',
        mode: 'threshold', target: 15, metric: m.prestige,
      },
    ],
    rewardBitsSeconds: 5400,
    rewardGc: 0,
    rewardArtifact: 'basilisk_eye',
    outro: '"Es sieht dich an und erkennt sich selbst. Das Auge des Basilisken gehört jetzt dir — oder du ihm. Der Unterschied war nie besonders wichtig."',
  },
  {
    id: 'op_rootaccess',
    name: 'Root Access',
    codename: 'ROOTKEY',
    intro: '"Der Ghost war nur die erste Häutung. Unter allem liegt der Kernel selbst. Wer dort ankommt, kommt anders zurück — als Root. Maxe den Ghost Shop und öffne die Root-Access-Ebene."',
    unlock: s => (s.ascensionCount ?? 0) >= 1 || isGhostShopMaxed(s),
    steps: [
      {
        narrative: '"Gib nicht nur deinen Fortschritt auf. Gib die ganze Ghost-Ebene auf. Transzendiere."',
        objective: 'Erlange Root Access (1× Ascension)',
        mode: 'threshold', target: 1, metric: m.ascensions,
      },
      {
        narrative: '"Root Keys sind das Einzige, was durch jeden Tod hindurch bleibt. Häufe sie an."',
        objective: 'Verdiene 8 Root Keys insgesamt',
        mode: 'threshold', target: 8, metric: m.rootKeys,
      },
    ],
    rewardBitsSeconds: 7200,
    rewardGc: 0,
    rewardTitle: 'root',
    outro: '"Es gibt keinen tieferen Zugang mehr. Du bist der Root. Alles darüber ist nur noch Oberfläche."',
  },
]

export function questById(id: string): QuestDef | undefined {
  return QUESTS.find(q => q.id === id)
}

// ---- Artifact effect aggregation ---------------------------------------------

function sumArtifactEffect(state: GameState, kind: ArtifactDef['effect']['kind']): number {
  let total = 0
  for (const id of state.earnedArtifacts) {
    const art = artifactById(id)
    if (art && art.effect.kind === kind) total += art.effect.value
  }
  return total
}

/** Permanent global multiplier from all owned global_mult artifacts (product). */
export function artifactGlobalMultiplier(state: GameState): number {
  let mult = 1
  for (const id of state.earnedArtifacts) {
    const art = artifactById(id)
    if (art && art.effect.kind === 'global_mult') mult *= art.effect.value
  }
  return mult
}

export function artifactOfflineBonus(state: GameState): number {
  return sumArtifactEffect(state, 'offline_bonus')
}

export function artifactContractSlots(state: GameState): number {
  return sumArtifactEffect(state, 'contract_slot')
}

export function artifactPacketLifetimeMs(state: GameState): number {
  return sumArtifactEffect(state, 'packet_lifetime')
}

export function artifactComboWindowMs(state: GameState): number {
  return sumArtifactEffect(state, 'combo_window')
}

// ---- Progress logic ----------------------------------------------------------

export function stepProgress(step: QuestStep, baseline: number, state: GameState): number {
  const current = step.metric(state)
  const value = step.mode === 'accumulate' ? current - baseline : current
  return Math.max(0, Math.min(step.target, value))
}

export function isStepComplete(step: QuestStep, baseline: number, state: GameState): boolean {
  return stepProgress(step, baseline, state) >= step.target
}

/** First not-yet-completed, unlocked quest the player hasn't finished. */
export function nextAvailableQuest(state: GameState): QuestDef | undefined {
  return QUESTS.find(q => !state.completedQuests.includes(q.id) && q.unlock(state))
}
