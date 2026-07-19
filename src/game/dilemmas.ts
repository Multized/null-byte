import type { GameState } from './types'
import { calcBitsPerSecond } from './utils'

export interface DilemmaOutcome {
  /** Result flavor shown after the choice resolves. */
  message: string
  /** Instant bits delta (can be negative). */
  bits?: number
  ghostCredits?: number
  bpsBuff?: { mult: number; durationMs: number }
  clickBuff?: { mult: number; durationMs: number }
  /** Temporary passive-production penalty, e.g. { mult: 0.7, durationMs: 300000 } = −30% for 5min. */
  penalty?: { mult: number; durationMs: number }
  /** Whether this counts as a won gamble (for stats/achievements). Undefined = not a gamble. */
  won?: boolean
  /** Visual tone of the outcome reveal. */
  tone: 'good' | 'bad' | 'neutral'
}

export type ChoiceKind = 'safe' | 'gamble' | 'sacrifice' | 'decline'

export interface DilemmaChoice {
  label: string
  detail: string
  kind: ChoiceKind
  /** True if the player can't afford this choice right now (e.g. not enough bits/gc). */
  disabled?: (state: GameState) => boolean
  resolve: (state: GameState) => DilemmaOutcome
}

export interface DilemmaDef {
  id: string
  contact: string
  scenario: string
  unlock: (state: GameState) => boolean
  choices: DilemmaChoice[]
}

const DECLINE: DilemmaChoice = {
  label: 'Ablehnen',
  detail: 'Finger weg. Kein Risiko, keine Belohnung.',
  kind: 'decline',
  resolve: () => ({ message: 'Du kappst die Verbindung. Manchmal ist Nichtstun die klügste Wahl.', tone: 'neutral' }),
}

export const DILEMMAS: DilemmaDef[] = [
  {
    id: 'broker',
    contact: 'der_broker',
    scenario: '"Ich hab einen frischen Zero-Day. Kostet dich 40% deiner liquiden Bits — dafür läuft dein System für 2 Minuten mit doppeltem Durchsatz. Deal?"',
    unlock: () => true,
    choices: [
      {
        label: 'Kaufen',
        detail: '−40% aktuelle Bits, dafür 2min ×2 BPS',
        kind: 'safe',
        disabled: s => s.bits < 10,
        resolve: s => ({
          message: 'Der Exploit ist echt. Dein Durchsatz explodiert.',
          bits: -Math.floor(s.bits * 0.4),
          bpsBuff: { mult: 2, durationMs: 120_000 },
          tone: 'good',
        }),
      },
      DECLINE,
    ],
  },
  {
    id: 'coinflip',
    contact: 'anon',
    scenario: '"Neuer Coin, geht gleich durch die Decke. Wirf 30% deiner Bits rein. Über die Hälfte Chance, dass du es verdreifachst. Der Rest... naja."',
    unlock: () => true,
    choices: [
      {
        label: 'Investieren',
        detail: '−30% Bits · 55%: ×3 zurück, 45%: weg',
        kind: 'gamble',
        disabled: s => s.bits < 100,
        resolve: s => {
          const stake = Math.floor(s.bits * 0.3)
          if (Math.random() < 0.55) {
            return { message: `Der Coin pumpt. Du ziehst ${stake * 3} Bits raus.`, bits: stake * 2, won: true, tone: 'good' }
          }
          return { message: 'Rugpull. Der Dev ist über alle Berge — und dein Einsatz mit ihm.', bits: -stake, won: false, tone: 'bad' }
        },
      },
      DECLINE,
    ],
  },
  {
    id: 'whistleblower',
    contact: 'V',
    scenario: '"Ich brauche Rechenzeit für ein Leak, das die Richtigen treffen wird. Leih mir deine Kapazität — 5 Minuten gedrosselt. Die Gegenleistung ist es wert. Sauber."',
    unlock: () => true,
    choices: [
      {
        label: 'Kapazität leihen',
        detail: '5min −20% BPS · dafür eine sichere Bits-Auszahlung',
        kind: 'sacrifice',
        resolve: s => {
          const payout = Math.max(200, Math.floor(calcBitsPerSecond(s) * 720))
          return {
            message: `Das Leak ist live. Als Dank landen ${payout} Bits in deinem Wallet.`,
            bits: payout,
            penalty: { mult: 0.8, durationMs: 300_000 },
            tone: 'good',
          }
        },
      },
      DECLINE,
    ],
  },
  {
    id: 'rival',
    contact: '???',
    scenario: '"Ein Konkurrent sitzt auf einem fetten Datensatz. Ich kann dich reinschleusen — gratis. Aber wenn ihre Gegenmaßnahmen greifen, trifft es dein Setup."',
    unlock: () => true,
    choices: [
      {
        label: 'Einbrechen',
        detail: 'Gratis · 50%: dicker Bits-Batzen, 50%: −30% BPS 5min',
        kind: 'gamble',
        resolve: s => {
          const bps = calcBitsPerSecond(s)
          if (Math.random() < 0.5) {
            const loot = Math.max(200, Math.floor(bps * 480))
            return { message: `Rein, kopiert, raus. Du sackst ${loot} Bits ein, bevor jemand was merkt.`, bits: loot, won: true, tone: 'good' }
          }
          return { message: 'Ihre IDS war wach. Gegenschlag — dein Durchsatz bricht ein.', penalty: { mult: 0.7, durationMs: 300_000 }, won: false, tone: 'bad' }
        },
      },
      DECLINE,
    ],
  },
  {
    id: 'honeypot',
    contact: 'ghost0x',
    scenario: '"Ungeschützter Server, randvoll mit Daten. Sieht fast zu einfach aus. Willst du das Risiko?"',
    unlock: () => true,
    choices: [
      {
        label: 'Zugreifen',
        detail: '70%: 10min Produktion sofort · 30%: Falle −40% BPS 8min',
        kind: 'gamble',
        resolve: s => {
          const bps = calcBitsPerSecond(s)
          if (Math.random() < 0.7) {
            const jackpot = Math.max(500, Math.floor(bps * 600))
            return { message: `Kein Honeypot — echtes Gold. ${jackpot} Bits auf einen Schlag.`, bits: jackpot, won: true, tone: 'good' }
          }
          return { message: 'Es war eine Falle. Deine Prozesse werden gedrosselt, während sie dich tracen.', penalty: { mult: 0.6, durationMs: 480_000 }, won: false, tone: 'bad' }
        },
      },
      DECLINE,
    ],
  },
  {
    id: 'insider',
    contact: 'insider_07',
    scenario: '"Vorabinfo über den nächsten großen Move. Kostet dich Ghost Credits — aber danach läuft dein Laden 10 Minuten auf Anschlag. Garantiert."',
    unlock: s => s.ghostCredits >= 2,
    choices: [
      {
        label: 'Info kaufen (2 gc)',
        detail: '−2 gc · sichere 10min ×2 BPS',
        kind: 'safe',
        disabled: s => s.ghostCredits < 2,
        resolve: () => ({
          message: 'Die Info stimmt auf die Sekunde. Volle Kraft voraus.',
          ghostCredits: -2,
          bpsBuff: { mult: 2, durationMs: 600_000 },
          tone: 'good',
        }),
      },
      DECLINE,
    ],
  },
  {
    id: 'collector',
    contact: 'der_sammler',
    scenario: '"Du hast dir einen Namen gemacht. Ich mache große Deals — aber nur mit Leuten, die alles riskieren. 80% deiner Bits. Gewinnst du, zahlt es sich vierfach aus."',
    unlock: s => s.decisionsMade >= 5 && s.bits >= 1000,
    choices: [
      {
        label: 'All in',
        detail: '−80% Bits · 50%: ×5 zurück, 50%: alles weg',
        kind: 'gamble',
        disabled: s => s.bits < 1000,
        resolve: s => {
          const stake = Math.floor(s.bits * 0.8)
          if (Math.random() < 0.5) {
            return { message: `Der Sammler nickt anerkennend. ${stake * 5} Bits fließen zurück.`, bits: stake * 4, won: true, tone: 'good' }
          }
          return { message: 'Der Deal platzt. Der Sammler zuckt mit den Schultern. Dein Einsatz ist weg.', bits: -stake, won: false, tone: 'bad' }
        },
      },
      DECLINE,
    ],
  },
]

export function dilemmaById(id: string): DilemmaDef | undefined {
  return DILEMMAS.find(d => d.id === id)
}

/** Picks a random unlocked dilemma, avoiding an immediate repeat of `lastId` when possible. */
export function rollDilemma(state: GameState, lastId?: string): DilemmaDef | undefined {
  const unlocked = DILEMMAS.filter(d => d.unlock(state))
  if (unlocked.length === 0) return undefined
  const pool = unlocked.length > 1 && lastId ? unlocked.filter(d => d.id !== lastId) : unlocked
  return pool[Math.floor(Math.random() * pool.length)]
}
