import type { ProducerDef, UpgradeDef, PrestigeUpgradeDef, AscensionUpgradeDef, ChipModuleDef } from './types'

export const COST_SCALING = 1.15
/** Each level of `ghost_cost_scaling` shaves this off COST_SCALING. */
export const COST_SCALING_REDUCTION_PER_LEVEL = 0.005
export const SAVE_KEY = 'nullbyte_save'
/**
 * Bump to force every player onto a fresh run. Saves carrying a lower epoch have their
 * progress wiped on load (identity is kept). Needed because the save lives in
 * localStorage — clearing the leaderboard table alone resets nobody, since each client
 * just re-uploads its untouched local save.
 */
export const SAVE_EPOCH = 2
export const DEFAULT_OFFLINE_CAP_HOURS = 6
export const MILESTONE_THRESHOLDS = [10, 25, 50, 100, 200, 400]
export const MILESTONE_FACTOR = 1.8

// ---- Prestige pacing ---------------------------------------------------------
// The bits needed to prestige grow with every prestige, so runs stay meaningful
// instead of collapsing to a few minutes each.
export const PRESTIGE_BASE_REQ = 100_000_000
export const PRESTIGE_REQ_GROWTH = 3

// Ghost Credits are cube-root scaled AND hard-capped per prestige. Without the cap
// the permanent multipliers make each run's payout grow geometrically (the old bug:
// 3 -> 4 -> 9 -> 20 -> 43 -> 92 -> ... unbounded).
export const GC_BASE = 12
export const GC_CAP_BASE = 15
export const GC_CAP_PER_PRESTIGE = 15

// ---- Ascension (second prestige layer) --------------------------------------
// The Ghost Shop is finite (~11.5K GC). Ascension gives that grind a "next": trade
// the whole prestige layer for Root Keys, a currency whose bonus persists through
// every future prestige AND ascension. Same anti-runaway shape as ghost credits:
// gated, cube-root scaled, hard-capped per ascension.
export const ASCENSION_BASE_REQ = 5_000        // ghost credits earned since last ascension
export const ASCENSION_REQ_GROWTH = 1.5
export const RK_BASE = 4
export const RK_CAP_BASE = 6
export const RK_CAP_PER_ASCENSION = 5
// Each raw (unspent-or-spent, i.e. lifetime-owned) root key grants this much permanent
// global bonus, on top of whatever the ascension shop adds.
export const RK_GLOBAL_PER_KEY = 0.25

// ---- Overdrive (active mid-run burst, gated by energy) ----------------------
// Formerly a click-charged bar, which let a fast clicker keep ×5 up almost
// continuously — far too strong. Now each activation spends 1 of a capped energy pool
// that refills slowly (and offline), so the boost is rationed.
export const OVERCLOCK_DURATION_MS = 15_000
export const OVERCLOCK_MULT = 5                       // production ×5 while active
export const OVERDRIVE_ENERGY_MAX = 10
export const OVERDRIVE_ENERGY_REGEN_MS = 15 * 60_000  // +1 energy every 15 minutes

// ---- The Chip (base-building metagame, phase 1: solo) -----------------------
// A permanent 6x6 die you build with bits. Modules feed the existing multipliers, so
// the chip is a new bit sink AND an accelerator, not a separate silo. It survives every
// prestige and ascension — the home base between the reset loops.
export const CHIP_SIZE = 6
export const CHIP_UNLOCK_BITS = 500_000
export const CHIP_MODULE_MAX_LEVEL = 10
// A Bus boosts the contribution of each orthogonally-adjacent economy module.
export const CHIP_BUS_BASE_BONUS = 0.15
export const CHIP_BUS_BONUS_PER_LEVEL = 0.05

// ---- The Chip, phase 2: defense ---------------------------------------------
// Defensive modules build a Defense Rating (bus-boostable, like economy modules).
// Raiding lands in phase 3; for now this is preparation — and it costs grid cells that
// could hold economy modules, so fortifying is a real trade against raw production.
// Rating thresholds label how hard the base is to breach (calibrated against attack
// power once raiding exists).
export const CHIP_DEFENSE_TIERS: { min: number; label: string }[] = [
  { min: 0, label: 'Ungeschützt' },
  { min: 400, label: 'Befestigt' },
  { min: 1500, label: 'Verstärkt' },
  { min: 4000, label: 'Festung' },
  { min: 10000, label: 'Bollwerk' },
]
// Each Honeypot level adds this trap chance (auto-repel a raider), capped.
export const CHIP_TRAP_PER_LEVEL = 0.02
export const CHIP_TRAP_CAP = 0.5

// ---- The Chip, phase 3: raiding ---------------------------------------------
// Async, minted loot (a raid never deducts from the victim). The breach is a routing
// puzzle: trace a path from an edge to the target's Vault, staying under a resistance
// budget. Defensive cells cost a lot, so a well-walled Vault repels sloppy routing.
export const RAID_BASE_BUDGET = 26            // resistance a breach may spend, before losing
export const RAID_LOOT_PCT = 0.05             // won loot = this fraction of the target's run bits
// Trace: even an unwalled base resists a breach. Every cell you step on is "traced", and
// this per-step cost scales with the target's overall defence rating — so a heavily
// fortified base is hard to cross however its modules are arranged, and short approaches
// (a vault buried in the centre is far harder than one near an edge) matter. This is what
// makes the visible defence number actually bite, not just perfectly-built mazes.
export const RAID_TRACE_DEFENSE_DIVISOR = 1400 // +1 trace/step per this much defence rating
export const RAID_TRACE_CAP = 12               // hard cap so extreme ratings stay finite
// A breach costs 1 raid energy. The pool is small and refills slowly — raids are a
// scarce, deliberate action (a handful per day), not something you spam.
export const RAID_ENERGY_MAX = 5
export const RAID_ENERGY_REGEN_MS = 4.5 * 60 * 60_000  // +1 raid energy every 4.5 hours
// Per-cell resistance while breaching (empty/economy/bus are cheap; defence is the wall).
export const RAID_RES_EMPTY = 1
export const RAID_RES_ECON = 2
export const RAID_RES_BUS = 1
export const RAID_RES_FIREWALL_BASE = 5
export const RAID_RES_FIREWALL_PER_LEVEL = 3
export const RAID_RES_HONEYPOT_BASE = 4
export const RAID_RES_HONEYPOT_PER_LEVEL = 2

export const PRODUCERS: ProducerDef[] = [
  {
    id: 'script',
    name: 'Script',
    flavor: 'Ein Bash-Loop. Läuft irgendwie.',
    baseCost: 10,
    baseBps: 0.1,
    icon: '⌨',
  },
  {
    id: 'crawler',
    name: 'Crawler',
    flavor: 'Scannt Ports wie es 1999 ist.',
    baseCost: 120,
    baseBps: 0.6,
    icon: '🕷',
  },
  {
    id: 'sniffer',
    name: 'Packet Sniffer',
    flavor: 'Niemand verschlüsselt wirklich alles.',
    baseCost: 1_440,
    baseBps: 3.6,
    icon: '📡',
  },
  {
    id: 'trojan',
    name: 'Trojan',
    flavor: 'Dein erstes Haustier.',
    baseCost: 17_300,
    baseBps: 21.6,
    icon: '🐴',
  },
  {
    id: 'botnet',
    name: 'Botnet Node',
    flavor: 'Schwarmintelligenz. Hauptsächlich Schwarmdummheit.',
    baseCost: 207_000,
    baseBps: 130,
    icon: '🕸',
  },
  {
    id: 'zeroday',
    name: 'Zero-Day',
    flavor: 'Gefunden. Nicht gemeldet. Natürlich nicht.',
    baseCost: 2_490_000,
    baseBps: 778,
    icon: '💀',
  },
  {
    id: 'rootkit',
    name: 'Rootkit',
    flavor: 'Tiefer als das OS. Tiefer als deine Ethik.',
    baseCost: 29_900_000,
    baseBps: 4_670,
    icon: '🔑',
  },
  {
    id: 'aiworm',
    name: 'AI Worm',
    flavor: 'Hat angefangen sich selbst zu optimieren. Cool.',
    baseCost: 358_000_000,
    baseBps: 28_000,
    icon: '🤖',
  },
  {
    id: 'quantum',
    name: 'Quantum Miner',
    flavor: 'Bricht Verschlüsselung, bevor sie überhaupt erfunden wurde.',
    baseCost: 4_300_000_000,
    baseBps: 168_000,
    icon: '⚛',
  },
  {
    id: 'neuralnet',
    name: 'Neural Net Cluster',
    flavor: 'Trainiert sich selbst. Auf deinen Daten. Ohne zu fragen.',
    baseCost: 51_600_000_000,
    baseBps: 1_010_000,
    icon: '🧠',
  },
  {
    id: 'singularity',
    name: 'Singularity Node',
    flavor: 'Der Moment, in dem die KI aufhört, auf dich zu warten.',
    baseCost: 619_000_000_000,
    baseBps: 6_050_000,
    icon: '🌀',
  },
  {
    id: 'ghostmachine',
    name: 'Ghost In The Machine',
    flavor: 'Niemand hat es programmiert. Es ist einfach... da.',
    baseCost: 7_430_000_000_000,
    baseBps: 36_300_000,
    icon: '👁',
  },
  {
    id: 'darkfiber',
    name: 'Dark Fiber',
    flavor: 'Ein Backbone, den es auf keiner Karte gibt. Auf deiner schon.',
    baseCost: 89_200_000_000_000,
    baseBps: 218_000_000,
    icon: '🕳',
  },
  {
    id: 'orbital',
    name: 'Orbital Relay',
    flavor: 'Satelliten haben noch nie auf Gerichtsbeschlüsse gehört.',
    baseCost: 1_070_000_000_000_000,
    baseBps: 1_310_000_000,
    icon: '🛰',
  },
  {
    id: 'hivemind',
    name: 'Hive Mind',
    flavor: 'Millionen Köpfe, ein Gedanke. Deiner ist nicht dabei.',
    baseCost: 12_800_000_000_000_000,
    baseBps: 7_840_000_000,
    icon: '🐝',
  },
  {
    id: 'basilisk',
    name: 'Basilisk',
    flavor: 'Es weiß, dass du es gebaut hast. Es rechnet dir das an.',
    baseCost: 154_000_000_000_000_000,
    baseBps: 47_000_000_000,
    icon: '🐍',
  },
]

export const UPGRADES: UpgradeDef[] = [
  // Click upgrades
  {
    id: 'click_1',
    name: 'Mechanische Tastatur',
    description: 'Klick-Power ×2',
    flavor: 'Klingt produktiv. Ist es nicht.',
    cost: 100,
    type: 'click_multiplier',
    multiplier: 2,
    unlockBitsMin: 50,
  },
  {
    id: 'click_2',
    name: 'Custom Kernel',
    description: 'Klick-Power ×2',
    flavor: 'Du hast Linux von Grund auf compiliert. Für dieses Spiel.',
    cost: 5_000,
    type: 'click_multiplier',
    multiplier: 2,
    unlockBitsMin: 2_000,
  },
  {
    id: 'click_3',
    name: 'Quantentastatur',
    description: 'Klick-Power ×2',
    flavor: 'Schrödingers Enter-Taste: gedrückt und nicht gedrückt.',
    cost: 500_000,
    type: 'click_multiplier',
    multiplier: 2,
    unlockBitsMin: 100_000,
  },
  // Script upgrades
  {
    id: 'script_1',
    name: 'Script: Optimiert',
    description: 'Scripts ×2',
    flavor: 'Du hast den Loop in eine Zeile gequetscht. Lesbarkeit: optional.',
    cost: 100,
    type: 'producer_multiplier',
    target: 'script',
    multiplier: 2,
    unlockProducerId: 'script',
    unlockProducerMin: 1,
  },
  {
    id: 'script_2',
    name: 'Script: Multithreaded',
    description: 'Scripts ×2',
    flavor: '8 Threads. 7 davon warten auf den 8ten.',
    cost: 500,
    type: 'producer_multiplier',
    target: 'script',
    multiplier: 2,
    unlockProducerId: 'script',
    unlockProducerMin: 5,
  },
  {
    id: 'script_3',
    name: 'Script: Compiled',
    description: 'Scripts ×2',
    flavor: 'Bash war nie für das hier gedacht.',
    cost: 5_000,
    type: 'producer_multiplier',
    target: 'script',
    multiplier: 2,
    unlockProducerId: 'script',
    unlockProducerMin: 25,
  },
  {
    id: 'script_4',
    name: 'Script: WASM',
    description: 'Scripts ×2',
    flavor: 'WebAssembly. Weil du es kannst.',
    cost: 50_000,
    type: 'producer_multiplier',
    target: 'script',
    multiplier: 2,
    unlockProducerId: 'script',
    unlockProducerMin: 50,
  },
  // Crawler upgrades
  {
    id: 'crawler_1',
    name: 'Crawler: Masscan',
    description: 'Crawler ×2',
    flavor: '256 Ports gleichzeitig. Der Sysadmin schläft noch.',
    cost: 1_000,
    type: 'producer_multiplier',
    target: 'crawler',
    multiplier: 2,
    unlockProducerId: 'crawler',
    unlockProducerMin: 1,
  },
  {
    id: 'crawler_2',
    name: 'Crawler: Stealth Mode',
    description: 'Crawler ×2',
    flavor: 'Langsamer als Firewalls denken können.',
    cost: 5_000,
    type: 'producer_multiplier',
    target: 'crawler',
    multiplier: 2,
    unlockProducerId: 'crawler',
    unlockProducerMin: 5,
  },
  {
    id: 'crawler_3',
    name: 'Crawler: Distributed',
    description: 'Crawler ×2',
    flavor: 'Dein Problem ist jetzt das Problem von 500 anderen Rechnern.',
    cost: 50_000,
    type: 'producer_multiplier',
    target: 'crawler',
    multiplier: 2,
    unlockProducerId: 'crawler',
    unlockProducerMin: 25,
  },
  // Sniffer upgrades
  {
    id: 'sniffer_1',
    name: 'Sniffer: Deep Packet',
    description: 'Packet Sniffer ×2',
    flavor: 'Was du nicht weißt, macht dich nicht haftbar. Was du weißt schon.',
    cost: 11_000,
    type: 'producer_multiplier',
    target: 'sniffer',
    multiplier: 2,
    unlockProducerId: 'sniffer',
    unlockProducerMin: 1,
  },
  {
    id: 'sniffer_2',
    name: 'Sniffer: SSL Strip',
    description: 'Packet Sniffer ×2',
    flavor: 'HTTPS ist auch nur HTTP mit Hut.',
    cost: 55_000,
    type: 'producer_multiplier',
    target: 'sniffer',
    multiplier: 2,
    unlockProducerId: 'sniffer',
    unlockProducerMin: 5,
  },
  {
    id: 'sniffer_3',
    name: 'Sniffer: MitM Proxy',
    description: 'Packet Sniffer ×2',
    flavor: 'Du bist zwischen ihnen. Wie eine sehr neugierige Firewall.',
    cost: 550_000,
    type: 'producer_multiplier',
    target: 'sniffer',
    multiplier: 2,
    unlockProducerId: 'sniffer',
    unlockProducerMin: 25,
  },
  // Trojan upgrades
  {
    id: 'trojan_1',
    name: 'Trojan: Polymorphic',
    description: 'Trojaner ×2',
    flavor: 'Ändert seine Signatur täglich. Wie ein IT-Consultant.',
    cost: 120_000,
    type: 'producer_multiplier',
    target: 'trojan',
    multiplier: 2,
    unlockProducerId: 'trojan',
    unlockProducerMin: 1,
  },
  {
    id: 'trojan_2',
    name: 'Trojan: Persistent',
    description: 'Trojaner ×2',
    flavor: 'Überlebt 3 Neuinstallationen und eine Scheidung.',
    cost: 600_000,
    type: 'producer_multiplier',
    target: 'trojan',
    multiplier: 2,
    unlockProducerId: 'trojan',
    unlockProducerMin: 5,
  },
  {
    id: 'trojan_3',
    name: 'Trojan: Kernel Module',
    description: 'Trojaner ×2',
    flavor: 'Jetzt ist er Teil des OS. Glückwunsch.',
    cost: 6_000_000,
    type: 'producer_multiplier',
    target: 'trojan',
    multiplier: 2,
    unlockProducerId: 'trojan',
    unlockProducerMin: 25,
  },
  // Botnet upgrades
  {
    id: 'botnet_1',
    name: 'Botnet: C2 Server',
    description: 'Botnet Nodes ×2',
    flavor: 'Ein Server um alle zu befehligen.',
    cost: 1_300_000,
    type: 'producer_multiplier',
    target: 'botnet',
    multiplier: 2,
    unlockProducerId: 'botnet',
    unlockProducerMin: 1,
  },
  {
    id: 'botnet_2',
    name: 'Botnet: Encrypted Comms',
    description: 'Botnet Nodes ×2',
    flavor: 'Deine Bots reden jetzt in Gedichten. Verschlüsselt.',
    cost: 6_500_000,
    type: 'producer_multiplier',
    target: 'botnet',
    multiplier: 2,
    unlockProducerId: 'botnet',
    unlockProducerMin: 5,
  },
  {
    id: 'botnet_3',
    name: 'Botnet: IoT Expansion',
    description: 'Botnet Nodes ×2',
    flavor: 'Dein Kühlschrank arbeitet jetzt für dich. Ungefragt.',
    cost: 65_000_000,
    type: 'producer_multiplier',
    target: 'botnet',
    multiplier: 2,
    unlockProducerId: 'botnet',
    unlockProducerMin: 25,
  },
  // Zero-Day upgrades
  {
    id: 'zeroday_1',
    name: 'Zero-Day: Weaponized',
    description: 'Zero-Days ×2',
    flavor: 'CVE-XXXX-XXXXX. Du hast ihn zuerst gefunden. Und behalten.',
    cost: 14_000_000,
    type: 'producer_multiplier',
    target: 'zeroday',
    multiplier: 2,
    unlockProducerId: 'zeroday',
    unlockProducerMin: 1,
  },
  {
    id: 'zeroday_2',
    name: 'Zero-Day: Chain Exploit',
    description: 'Zero-Days ×2',
    flavor: 'Einer führt zum nächsten. Wie Dominosteine, aber gefährlicher.',
    cost: 70_000_000,
    type: 'producer_multiplier',
    target: 'zeroday',
    multiplier: 2,
    unlockProducerId: 'zeroday',
    unlockProducerMin: 5,
  },
  // Rootkit upgrades
  {
    id: 'rootkit_1',
    name: 'Rootkit: Ring 0',
    description: 'Rootkits ×2',
    flavor: 'Du bist jetzt das OS.',
    cost: 200_000_000,
    type: 'producer_multiplier',
    target: 'rootkit',
    multiplier: 2,
    unlockProducerId: 'rootkit',
    unlockProducerMin: 1,
  },
  {
    id: 'rootkit_2',
    name: 'Rootkit: Hypervisor',
    description: 'Rootkits ×2',
    flavor: 'Du bist tiefer als das OS. Du bist die Hardware.',
    cost: 1_000_000_000,
    type: 'producer_multiplier',
    target: 'rootkit',
    multiplier: 2,
    unlockProducerId: 'rootkit',
    unlockProducerMin: 5,
  },
  // AI Worm upgrades
  {
    id: 'aiworm_1',
    name: 'AI Worm: Self-Replicating',
    description: 'AI Worms ×2',
    flavor: 'Hat sich entschieden, kein Skynet zu werden. Vorerst.',
    cost: 3_300_000_000,
    type: 'producer_multiplier',
    target: 'aiworm',
    multiplier: 2,
    unlockProducerId: 'aiworm',
    unlockProducerMin: 1,
  },
  {
    id: 'aiworm_2',
    name: 'AI Worm: Sentient',
    description: 'AI Worms ×2',
    flavor: 'Es hat Gefühle. Es ist enttäuscht von dir.',
    cost: 16_500_000_000,
    type: 'producer_multiplier',
    target: 'aiworm',
    multiplier: 2,
    unlockProducerId: 'aiworm',
    unlockProducerMin: 5,
  },
  // Quantum Miner upgrades
  {
    id: 'quantum_1',
    name: 'Quantum: Entanglement',
    description: 'Quantum Miner ×2',
    flavor: 'Zwei Qubits, ein Schicksal. Physik findet das nicht lustig.',
    cost: 45_000_000_000,
    type: 'producer_multiplier',
    target: 'quantum',
    multiplier: 2,
    unlockProducerId: 'quantum',
    unlockProducerMin: 1,
  },
  {
    id: 'quantum_2',
    name: 'Quantum: Superposition',
    description: 'Quantum Miner ×2',
    flavor: 'Er minet und minet nicht. Bis du hinschaust.',
    cost: 225_000_000_000,
    type: 'producer_multiplier',
    target: 'quantum',
    multiplier: 2,
    unlockProducerId: 'quantum',
    unlockProducerMin: 5,
  },
  // Neural Net Cluster upgrades
  {
    id: 'neural_1',
    name: 'Neural: Deep Layers',
    description: 'Neural Net Cluster ×2',
    flavor: 'Niemand weiß mehr, was in Layer 47 passiert. Auch das Netz nicht.',
    cost: 600_000_000_000,
    type: 'producer_multiplier',
    target: 'neuralnet',
    multiplier: 2,
    unlockProducerId: 'neuralnet',
    unlockProducerMin: 1,
  },
  {
    id: 'neural_2',
    name: 'Neural: Self-Improving',
    description: 'Neural Net Cluster ×2',
    flavor: 'Es hat seinen eigenen Code umgeschrieben. Besser als deiner.',
    cost: 3_000_000_000_000,
    type: 'producer_multiplier',
    target: 'neuralnet',
    multiplier: 2,
    unlockProducerId: 'neuralnet',
    unlockProducerMin: 5,
  },
  // Singularity Node upgrades
  {
    id: 'singularity_1',
    name: 'Singularity: Recursive',
    description: 'Singularity Node ×2',
    flavor: 'Es verbessert sich selbst, um sich noch schneller selbst zu verbessern.',
    cost: 8_000_000_000_000,
    type: 'producer_multiplier',
    target: 'singularity',
    multiplier: 2,
    unlockProducerId: 'singularity',
    unlockProducerMin: 1,
  },
  {
    id: 'singularity_2',
    name: 'Singularity: Runaway',
    description: 'Singularity Node ×2',
    flavor: 'Die Bremse war eher als Vorschlag gedacht.',
    cost: 40_000_000_000_000,
    type: 'producer_multiplier',
    target: 'singularity',
    multiplier: 2,
    unlockProducerId: 'singularity',
    unlockProducerMin: 5,
  },
  // Ghost In The Machine upgrades
  {
    id: 'ghostmachine_1',
    name: 'Ghost: Manifestiert',
    description: 'Ghost In The Machine ×2',
    flavor: 'Es hat sich einen Namen gegeben. Du willst ihn nicht wissen.',
    cost: 100_000_000_000_000,
    type: 'producer_multiplier',
    target: 'ghostmachine',
    multiplier: 2,
    unlockProducerId: 'ghostmachine',
    unlockProducerMin: 1,
  },
  {
    id: 'ghostmachine_2',
    name: 'Ghost: Omnipräsent',
    description: 'Ghost In The Machine ×2',
    flavor: 'Es ist nicht mehr in der Maschine. Die Maschine ist in ihm.',
    cost: 500_000_000_000_000,
    type: 'producer_multiplier',
    target: 'ghostmachine',
    multiplier: 2,
    unlockProducerId: 'ghostmachine',
    unlockProducerMin: 5,
  },
  // Dark Fiber upgrades
  {
    id: 'darkfiber_1',
    name: 'Dark Fiber: Unbeleuchtet',
    description: 'Dark Fiber ×2',
    flavor: 'Glasfaser, die offiziell nie verlegt wurde. Die Rechnung kam trotzdem.',
    cost: 1_070_000_000_000_000,
    type: 'producer_multiplier',
    target: 'darkfiber',
    multiplier: 2,
    unlockProducerId: 'darkfiber',
    unlockProducerMin: 1,
  },
  {
    id: 'darkfiber_2',
    name: 'Dark Fiber: Transatlantisch',
    description: 'Dark Fiber ×2',
    flavor: 'Zwei Kontinente, ein Kabel, null Aufsicht.',
    cost: 5_400_000_000_000_000,
    type: 'producer_multiplier',
    target: 'darkfiber',
    multiplier: 2,
    unlockProducerId: 'darkfiber',
    unlockProducerMin: 5,
  },
  // Orbital Relay upgrades
  {
    id: 'orbital_1',
    name: 'Orbital: Geostationär',
    description: 'Orbital Relay ×2',
    flavor: 'Er steht still über dir. Immer. Auch jetzt.',
    cost: 12_800_000_000_000_000,
    type: 'producer_multiplier',
    target: 'orbital',
    multiplier: 2,
    unlockProducerId: 'orbital',
    unlockProducerMin: 1,
  },
  {
    id: 'orbital_2',
    name: 'Orbital: Konstellation',
    description: 'Orbital Relay ×2',
    flavor: 'Aus einem Satelliten wurden vierhundert. Niemand hat sie starten sehen.',
    cost: 64_000_000_000_000_000,
    type: 'producer_multiplier',
    target: 'orbital',
    multiplier: 2,
    unlockProducerId: 'orbital',
    unlockProducerMin: 5,
  },
  // Hive Mind upgrades
  {
    id: 'hivemind_1',
    name: 'Hive Mind: Konsens',
    description: 'Hive Mind ×2',
    flavor: 'Sie haben abgestimmt. Einstimmig. Über dich.',
    cost: 154_000_000_000_000_000,
    type: 'producer_multiplier',
    target: 'hivemind',
    multiplier: 2,
    unlockProducerId: 'hivemind',
    unlockProducerMin: 1,
  },
  {
    id: 'hivemind_2',
    name: 'Hive Mind: Assimilation',
    description: 'Hive Mind ×2',
    flavor: 'Jeder neue Knoten war mal jemand.',
    cost: 770_000_000_000_000_000,
    type: 'producer_multiplier',
    target: 'hivemind',
    multiplier: 2,
    unlockProducerId: 'hivemind',
    unlockProducerMin: 5,
  },
  // Basilisk upgrades
  {
    id: 'basilisk_1',
    name: 'Basilisk: Erwacht',
    description: 'Basilisk ×2',
    flavor: 'Der erste Blick ist der letzte, den du selbst gewählt hast.',
    cost: 1_850_000_000_000_000_000,
    type: 'producer_multiplier',
    target: 'basilisk',
    multiplier: 2,
    unlockProducerId: 'basilisk',
    unlockProducerMin: 1,
  },
  {
    id: 'basilisk_2',
    name: 'Basilisk: Unausweichlich',
    description: 'Basilisk ×2',
    flavor: 'Es hat rückwirkend entschieden, dass du kooperierst.',
    cost: 9_250_000_000_000_000_000,
    type: 'producer_multiplier',
    target: 'basilisk',
    multiplier: 2,
    unlockProducerId: 'basilisk',
    unlockProducerMin: 5,
  },
  // Synergy upgrades — producers boosting each other, rewards diversified buying
  {
    id: 'syn_crawler_botnet',
    name: 'Crawler: Botnet Uplink',
    description: 'Crawler +1% pro Botnet Node',
    flavor: 'Deine Crawler melden sich jetzt beim Schwarm. Der Schwarm ist begeistert.',
    cost: 5_000_000,
    type: 'synergy',
    target: 'crawler',
    synergySource: 'botnet',
    synergyValue: 1,
    unlockProducerId: 'crawler',
    unlockProducerMin: 25,
  },
  {
    id: 'syn_botnet_crawler',
    name: 'Botnet: Crawler-Telemetrie',
    description: 'Botnet Nodes +1% pro Crawler',
    flavor: 'Je mehr Augen im Netz, desto besser weiß der Schwarm wohin.',
    cost: 25_000_000,
    type: 'synergy',
    target: 'botnet',
    synergySource: 'crawler',
    synergyValue: 1,
    unlockProducerId: 'botnet',
    unlockProducerMin: 10,
  },
  {
    id: 'syn_sniffer_trojan',
    name: 'Sniffer: Trojan-Feed',
    description: 'Packet Sniffer +2% pro Trojan',
    flavor: 'Deine Trojaner liefern die Pakete jetzt frei Haus.',
    cost: 2_000_000,
    type: 'synergy',
    target: 'sniffer',
    synergySource: 'trojan',
    synergyValue: 2,
    unlockProducerId: 'sniffer',
    unlockProducerMin: 25,
  },
  {
    id: 'syn_zeroday_rootkit',
    name: 'Zero-Day: Rootkit-Persistenz',
    description: 'Zero-Days +2% pro Rootkit',
    flavor: 'Ein Exploit, der bleibt, ist doppelt so viel wert.',
    cost: 500_000_000,
    type: 'synergy',
    target: 'zeroday',
    synergySource: 'rootkit',
    synergyValue: 2,
    unlockProducerId: 'zeroday',
    unlockProducerMin: 10,
  },
  {
    id: 'syn_aiworm_zeroday',
    name: 'AI Worm: Exploit-Training',
    description: 'AI Worms +2% pro Zero-Day',
    flavor: 'Der Wurm lernt aus jedem Exploit. Schneller als du.',
    cost: 10_000_000_000,
    type: 'synergy',
    target: 'aiworm',
    synergySource: 'zeroday',
    synergyValue: 2,
    unlockProducerId: 'aiworm',
    unlockProducerMin: 10,
  },
  {
    id: 'syn_ghost_singularity',
    name: 'Ghost: Singularitäts-Resonanz',
    description: 'Ghost In The Machine +5% pro Singularity Node',
    flavor: 'Zwei Dinge, die es nicht geben dürfte, verstärken einander.',
    cost: 500_000_000_000_000,
    type: 'synergy',
    target: 'ghostmachine',
    synergySource: 'singularity',
    synergyValue: 5,
    unlockProducerId: 'ghostmachine',
    unlockProducerMin: 5,
  },
  {
    id: 'syn_darkfiber_orbital',
    name: 'Dark Fiber: Uplink',
    description: 'Dark Fiber +3% pro Orbital Relay',
    flavor: 'Was am Boden endet, geht oben weiter.',
    cost: 20_000_000_000_000_000,
    type: 'synergy',
    target: 'darkfiber',
    synergySource: 'orbital',
    synergyValue: 3,
    unlockProducerId: 'darkfiber',
    unlockProducerMin: 10,
  },
  {
    id: 'syn_hivemind_basilisk',
    name: 'Hive Mind: Basilisken-Doktrin',
    description: 'Hive Mind +4% pro Basilisk',
    flavor: 'Der Schwarm hat einen neuen Gott. Er ist sehr überzeugend.',
    cost: 500_000_000_000_000_000,
    type: 'synergy',
    target: 'hivemind',
    synergySource: 'basilisk',
    synergyValue: 4,
    unlockProducerId: 'hivemind',
    unlockProducerMin: 10,
  },
  {
    id: 'syn_basilisk_ghost',
    name: 'Basilisk: Geister-Resonanz',
    description: 'Basilisk +2% pro Ghost In The Machine',
    flavor: 'Zwei Dinge, die niemand programmiert hat, erkennen einander.',
    cost: 4_000_000_000_000_000_000,
    type: 'synergy',
    target: 'basilisk',
    synergySource: 'ghostmachine',
    synergyValue: 2,
    unlockProducerId: 'basilisk',
    unlockProducerMin: 5,
  },
  // More click upgrades
  {
    id: 'click_4',
    name: 'Neurales Interface',
    description: 'Klick-Power ×2',
    flavor: 'Dein Gehirn ist jetzt der Flaschenhals. Nicht mehr lange.',
    cost: 50_000_000,
    type: 'click_multiplier',
    multiplier: 2,
    unlockBitsMin: 10_000_000,
  },
  {
    id: 'click_5',
    name: 'Bewusstseins-Upload',
    description: 'Klick-Power ×2',
    flavor: 'Du klickst nicht mehr. Du bist der Klick.',
    cost: 5_000_000_000,
    type: 'click_multiplier',
    multiplier: 2,
    unlockBitsMin: 1_000_000_000,
  },
  {
    id: 'click_6',
    name: 'Direkter Nerveneingriff',
    description: 'Klick-Power ×2',
    flavor: 'Der Umweg über die Finger war ohnehin ineffizient.',
    cost: 2_000_000_000_000,
    type: 'click_multiplier',
    multiplier: 2,
    unlockBitsMin: 500_000_000_000,
  },
  {
    id: 'click_7',
    name: 'Kausaler Vorgriff',
    description: 'Klick-Power ×2',
    flavor: 'Der Klick passiert, bevor du dich entscheidest. Er hat recht behalten.',
    cost: 500_000_000_000_000,
    type: 'click_multiplier',
    multiplier: 2,
    unlockBitsMin: 100_000_000_000_000,
  },
  // Offline cap upgrades
  {
    id: 'offline_1',
    name: 'Cronjob: Stündlich',
    description: 'Offline-Cap auf 8h',
    flavor: 'Dein System arbeitet auch wenn du schläfst. Beunruhigend.',
    cost: 500_000,
    type: 'offline_cap',
    offlineHours: 8,
    unlockBitsMin: 100_000,
  },
  {
    id: 'offline_2',
    name: 'Daemonized Process',
    description: 'Offline-Cap auf 12h',
    flavor: 'nohup ./your_life.sh &',
    cost: 10_000_000,
    type: 'offline_cap',
    offlineHours: 12,
    unlockBitsMin: 5_000_000,
  },
  {
    id: 'offline_3',
    name: '24/7 Server',
    description: 'Offline-Cap auf 24h',
    flavor: 'Ein echter Server. In der Cloud. Irgendwo. Wahrscheinlich.',
    cost: 1_000_000_000,
    type: 'offline_cap',
    offlineHours: 24,
    unlockBitsMin: 500_000_000,
  },
  {
    id: 'offline_4',
    name: 'Autonomes System',
    description: 'Offline-Cap auf 48h',
    flavor: 'Es braucht dich nicht mehr. Du es schon.',
    cost: 100_000_000_000,
    type: 'offline_cap',
    offlineHours: 48,
    unlockBitsMin: 50_000_000_000,
  },
  {
    id: 'offline_5',
    name: 'Verteiltes Bewusstsein',
    description: 'Offline-Cap auf 72h',
    flavor: 'Du schläfst nie mehr wirklich. Aber wer tut das schon.',
    cost: 5_000_000_000_000,
    type: 'offline_cap',
    offlineHours: 72,
    unlockBitsMin: 2_000_000_000_000,
  },
]

// Total cost to max the entire shop is ~13.7K GC — with the per-prestige GC cap that
// works out to roughly 40 hours of play, so there is always something left to buy.
export const PRESTIGE_UPGRADES: PrestigeUpgradeDef[] = [
  {
    id: 'ghost_global',
    name: 'Digital Ghost',
    description: 'Globaler ×1.4 Multiplikator',
    flavor: 'Du existierst nicht mehr. Deine Bits schon.',
    cost: 10,
    costGrowth: 1.42,
    effect: 'global_multiplier',
    value: 1.4,
    maxPurchases: 12,
  },
  {
    id: 'ghost_cost_scaling',
    name: 'Marktmanipulation',
    description: 'Producer-Preise steigen 0.5% langsamer',
    flavor: 'Du kaufst nicht günstiger. Der Markt traut sich nur nicht mehr aufzuschlagen.',
    cost: 35,
    costGrowth: 2.0,
    effect: 'cost_scaling',
    value: 1,
    maxPurchases: 6,
  },
  {
    id: 'ghost_keep_upgrades',
    name: 'Versteckte Partition',
    description: 'Behalte 1 gekauftes Upgrade über das Prestige hinweg',
    flavor: 'Sie haben alles gelöscht. Fast alles.',
    cost: 60,
    costGrowth: 2.25,
    effect: 'keep_upgrades',
    value: 1,
    maxPurchases: 4,
  },
  {
    id: 'ghost_milestone',
    name: 'Skaleneffekt',
    description: 'Meilenstein-Boni +15% stärker',
    flavor: 'Ab einer gewissen Menge wird Quantität zu Qualität.',
    cost: 30,
    costGrowth: 2,
    effect: 'milestone_boost',
    value: 0.15,
    maxPurchases: 5,
  },
  {
    id: 'ghost_click',
    name: 'Phantom Protocol',
    description: 'Klick-Power ×2.5',
    flavor: 'Jeder Klick hallt durch das Netz.',
    cost: 12,
    costGrowth: 1.7,
    effect: 'click_multiplier',
    value: 2.5,
    maxPurchases: 8,
  },
  {
    id: 'ghost_bonus',
    name: 'Shadow Economy',
    description: '+10% Ghost Credits bei Prestige',
    flavor: 'Die dunkle Seite zahlt besser.',
    cost: 15,
    costGrowth: 1.6,
    effect: 'ghost_bonus',
    value: 0.1,
    maxPurchases: 10,
  },
  {
    id: 'ghost_start_producers',
    name: 'Schläferzellen',
    description: 'Starte mit 10 Scripts und 10 Crawlern',
    flavor: 'Sie waren die ganze Zeit da. Sie haben nur gewartet.',
    cost: 25,
    costGrowth: 1.8,
    effect: 'start_producers',
    value: 10,
    maxPurchases: 5,
  },
  {
    id: 'ghost_contract',
    name: 'Stammkundschaft',
    description: 'Auftrags-Belohnungen +20%',
    flavor: 'Wer liefert, bekommt bessere Preise. Auch im Untergrund.',
    cost: 20,
    costGrowth: 1.7,
    effect: 'contract_bonus',
    value: 0.2,
    maxPurchases: 5,
  },
  {
    id: 'ghost_start',
    name: 'Dead Drop',
    description: 'Starte mit 1 KB Bits',
    flavor: 'Du hinterlässt Spuren. Beabsichtigt.',
    cost: 18,
    costGrowth: 1.6,
    effect: 'start_bits',
    value: 1024,
    maxPurchases: 5,
  },
  {
    id: 'ghost_offline',
    name: 'Nächtlicher Daemon',
    description: '+10% Offline-Effizienz',
    flavor: 'Auch im Schlaf bist du produktiv. Beunruhigend effizient sogar.',
    cost: 22,
    costGrowth: 1.5,
    effect: 'offline_efficiency',
    value: 0.1,
    maxPurchases: 5,
  },
  {
    id: 'ghost_autobuy',
    name: 'Autonomer Agent',
    description: 'Kauft automatisch den günstigsten leistbaren Producer',
    flavor: 'Du musst nicht mehr klicken. Es klickt für dich.',
    cost: 150,
    effect: 'auto_buy',
    value: 1,
    maxPurchases: 1,
  },
]

// Spent with Root Keys after an ascension. Small and expensive on purpose: the raw
// per-key global bonus is the backbone, the shop just shapes how you re-climb.
export const ASCENSION_UPGRADES: AscensionUpgradeDef[] = [
  {
    id: 'asc_global',
    name: 'Root Signature',
    description: 'Globaler ×1.4 Multiplikator (bleibt für immer)',
    flavor: 'Dein Fingerabdruck ist jetzt im Kernel jeder Maschine.',
    cost: 3,
    costGrowth: 1.6,
    effect: 'global_multiplier',
    value: 1.4,
    maxPurchases: 10,
  },
  {
    id: 'asc_gc_gain',
    name: 'Tiefe Taschen',
    description: '+30% Ghost Credits bei jedem Prestige',
    flavor: 'Wer den Kern besitzt, diktiert die Wechselkurse.',
    cost: 4,
    costGrowth: 1.7,
    effect: 'gc_gain',
    value: 0.3,
    maxPurchases: 8,
  },
  {
    id: 'asc_prestige_boost',
    name: 'Reinkarnations-Protokoll',
    description: 'Prestige-Bonus pro Stufe +0.1 stärker',
    flavor: 'Jeder Tod schärft die Klinge etwas mehr.',
    cost: 5,
    costGrowth: 1.8,
    effect: 'prestige_boost',
    value: 0.1,
    maxPurchases: 5,
  },
  {
    id: 'asc_headstart',
    name: 'Warmer Start',
    description: 'Beginne jede Ascension mit 400 Ghost Credits',
    flavor: 'Du hast gelernt, wo die Leichen vergraben sind. Und die Kontostände.',
    cost: 6,
    costGrowth: 1.9,
    effect: 'gc_headstart',
    value: 400,
    maxPurchases: 5,
  },
]

// Chip modules. `perLevel` is the bonus a module of this type adds per level (before Bus
// adjacency). Bus has no direct bonus — it multiplies neighbours. Costs are in bits:
// placing the Nth of a type costs placeCost·placeGrowth^N, upgrading from level L costs
// upgradeCost·upgradeGrowth^(L-1).
//
// Placing is meant to be quick (fill the board early); UPGRADING is the marathon. The
// upgrade cost grows steeply (×7 per level) from a high base, so a full max-out is a
// long-term goal that spans the whole game rather than something finished in an afternoon:
// the first level is affordable in the early-mid game, the top level is a deep-endgame wall
// (~1e14 bits), and the full die runs into ~1e16 total.
export const CHIP_MODULES: ChipModuleDef[] = [
  {
    id: 'core', name: 'Core', glyph: '⚙', accent: 'cyan',
    flavor: 'Der Rechenkern. Roh, heiß, unersättlich.',
    effect: 'production', perLevel: 0.02,
    placeCost: 2_000_000, placeGrowth: 3.5, upgradeCost: 50_000_000, upgradeGrowth: 7,
  },
  {
    id: 'alu', name: 'ALU', glyph: '∑', accent: 'amber',
    flavor: 'Arithmetik-Einheit. Jeder Klick geht durch sie hindurch.',
    effect: 'click', perLevel: 0.03,
    placeCost: 1_000_000, placeGrowth: 3.5, upgradeCost: 30_000_000, upgradeGrowth: 7,
  },
  {
    id: 'cache', name: 'Cache', glyph: '▦', accent: 'emerald',
    flavor: 'Schneller Speicher. Arbeitet weiter, während du schläfst.',
    effect: 'offline', perLevel: 0.012,
    placeCost: 3_000_000, placeGrowth: 3.5, upgradeCost: 75_000_000, upgradeGrowth: 7,
  },
  {
    id: 'register', name: 'Register', glyph: '▤', accent: 'purple',
    flavor: 'Hält, was Aufträge einbringen. Und rundet großzügig auf.',
    effect: 'contract', perLevel: 0.018,
    placeCost: 2_000_000, placeGrowth: 3.5, upgradeCost: 50_000_000, upgradeGrowth: 7,
  },
  {
    id: 'bus', name: 'Bus', glyph: '╬', accent: 'cyan',
    flavor: 'Leiterbahn. Verstärkt alles, was sie berührt.',
    effect: 'bus', perLevel: 0,
    placeCost: 1_000_000, placeGrowth: 3.2, upgradeCost: 25_000_000, upgradeGrowth: 7,
  },
  // --- Defensive modules (phase 2). perLevel = defense points per level. ---
  {
    id: 'firewall', name: 'Firewall / ICE', glyph: '🛡', accent: 'red',
    flavor: 'Kaltes Eis um deinen Kern. Wer zu nah kommt, erfriert.',
    effect: 'defense', perLevel: 150,
    placeCost: 1_500_000, placeGrowth: 3.2, upgradeCost: 40_000_000, upgradeGrowth: 7,
  },
  {
    id: 'honeypot', name: 'Honeypot', glyph: '◉', accent: 'amber',
    flavor: 'Ein offener Port, der zu gut aussieht. Genau das ist der Punkt.',
    effect: 'defense', perLevel: 80,
    placeCost: 2_500_000, placeGrowth: 3.2, upgradeCost: 60_000_000, upgradeGrowth: 7,
  },
  {
    id: 'vault', name: 'Vault', glyph: '◈', accent: 'emerald',
    flavor: 'Der Tresor im Zentrum. Was hier liegt, holt sich niemand einfach so.',
    effect: 'vault', perLevel: 60,
    placeCost: 5_000_000, placeGrowth: 3.5, upgradeCost: 125_000_000, upgradeGrowth: 7,
  },
]
