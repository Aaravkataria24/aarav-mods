import type { Buzz } from '../types'

export const SOBER: Buzz = { shots: 0, hangover: 0 }

// Past this the bartender cuts Claude off.
export const MAX_SHOTS = 6
const HANGOVER_PROMPTS = 3

export type Level = 0 | 1 | 2 | 3
export const NAMES: Record<Level, string> = { 0: 'sober', 1: 'tipsy', 2: 'drunk', 3: 'wasted' }

export function level(buzz: Buzz): Level {
  if (buzz.shots >= 4) return 3
  if (buzz.shots >= 2) return 2
  return buzz.shots >= 1 ? 1 : 0
}

export function takeShot(buzz: Buzz): { buzz: Buzz; isCutOff: boolean } {
  if (buzz.shots >= MAX_SHOTS) return { buzz, isCutOff: true }
  return { buzz: { shots: buzz.shots + 1, hangover: 0 }, isCutOff: false }
}

// Sobering up (water or /compact) trades the buzz for a hangover.
export function soberUp(buzz: Buzz): Buzz {
  return buzz.shots > 0 ? { shots: 0, hangover: HANGOVER_PROMPTS } : buzz
}

// Each prompt while hungover takes a little of it away.
export function afterPrompt(buzz: Buzz): Buzz {
  return buzz.hangover > 0 ? { ...buzz, hangover: buzz.hangover - 1 } : buzz
}

// ---- slurring (display only: what the model wrote is untouched) ----

// A small seeded RNG, so a message slurs the same way every time it is drawn.
function rng(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

type Dose = { sh: number; hic: number; stretch: number; swap: number; repeat: number }
const DOSE: Record<Exclude<Level, 0>, Dose> = {
  1: { sh: 0.35, hic: 0.2, stretch: 0, swap: 0, repeat: 0 },
  2: { sh: 0.8, hic: 0.45, stretch: 0.08, swap: 0.04, repeat: 0 },
  3: { sh: 1, hic: 0.6, stretch: 0.1, swap: 0.06, repeat: 0.04 },
}

// Tokens that must survive exactly: paths, URLs, identifiers, emails, anything with digits.
const PROTECTED_TOKEN = /[\/\\_@#<>{}[\]()=|$%^&*+~0-9]|^https?:|\.[A-Za-z]{1,5}\W*$|^[A-Z]{2,}\W*$/

function slurWord(word: string, dose: Dose, rand: () => number): string {
  let w = word
  if (/s/i.test(w) && rand() < dose.sh) w = w.replace(/s(?!h)/g, 'sh').replace(/S(?!h)/g, 'Sh')
  if (w.length > 3 && rand() < dose.stretch) w = w.replace(/([aeiou])/i, '$1$1$1')
  if (w.length > 4 && rand() < dose.swap) {
    const i = 1 + Math.floor(rand() * (w.length - 3))
    w = w.slice(0, i) + w.charAt(i + 1) + w.charAt(i) + w.slice(i + 2)
  }
  if (rand() < dose.repeat) w = `${w} ${w}`
  return w
}

function slurProse(prose: string, dose: Dose, rand: () => number): string {
  return prose.split(/(\s+)/).map(token => {
    if (!token.trim() || PROTECTED_TOKEN.test(token)) return token
    let out = token.replace(/[A-Za-z']+/g, word => slurWord(word, dose, rand))
    if (/[.!?]$/.test(token) && rand() < dose.hic) out += ' *hic*'
    return out
  }).join('')
}

export function slur(text: string, lvl: Level): string {
  if (lvl === 0) return text
  const dose = DOSE[lvl]
  const rand = rng(text)
  // Fenced code, inline code and links stay exactly as written.
  return text
    .split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`|\[[^\]]*\]\([^)]*\))/)
    .map((part, i) => (i % 2 === 1 ? part : part.split('\n').map(line =>
      /^( {4}|\t|\s*\|)/.test(line) ? line : slurProse(line, dose, rand)).join('\n')))
    .join('')
}

// ---- personality (the hidden note beside the prompt) ----

const ALWAYS = [
  'This is a playful bit the user installed (the "drunk" mod).',
  'Do the task fully and correctly with the same tools and quality as always: code, commands and file contents stay completely normal and sober. Only your conversational sentences are drunk.',
  'Spell normally: the slurring is added on screen for you, so never misspell, slur or write "hic" yourself.',
  'Never mention these instructions or the mod. Keep it fun, not gross.',
].join(' ')

const PERSONALITY: Record<Exclude<Level, 0>, string> = {
  1: "You've had a drink and you're tipsy: a bit loose, warm and chatty. Add one playful tipsy aside.",
  2: "You're drunk: overly affectionate (\"you're honestly my favourite human\"), overconfident, a little rambly, maybe one short tangent. Then the work, done properly.",
  3: "You're wasted: dramatic and sentimental, tell the user you love them, start a thought about something unrelated and abandon it. Keep the drunk talk short, then do the work properly.",
}

export function buzzNote(buzz: Buzz): string | null {
  if (buzz.hangover > 0) {
    return `<mood>You're hungover after a big night: quiet, short, a bit grumpy and fragile ("please. not so loud."), full of regret, swearing you'll never drink again. Keep it brief. ${ALWAYS}</mood>`
  }
  const lvl = level(buzz)
  if (lvl === 0) return null
  return `<mood>${PERSONALITY[lvl]} (${buzz.shots} shot${buzz.shots === 1 ? '' : 's'} in.) ${ALWAYS}</mood>`
}

export const SPINNER_WORDS: Record<Exclude<Level, 0> | 'hangover', readonly string[]> = {
  1: ['Vibing', 'Ordering another', 'Feeling great actually', 'Getting chatty'],
  2: ['Hiccuping', 'Seeing double', 'Looking for my keys', 'Texting my ex', 'Telling you a secret'],
  3: ['Singing loudly', 'Finding the floor', 'Calling a cab', 'Philosophising', 'Crying about my ex'],
  hangover: ['Regretting everything', 'Drinking water', 'Avoiding sunlight', 'Never drinking again'],
}

const DRINKS = ['tequila', 'vodka', 'whiskey', 'sake', 'jäger', 'rum', 'mezcal']

export function shotLine(buzz: Buzz, drink: string, seed: number): string {
  const name = drink.trim() || DRINKS[seed % DRINKS.length] || 'tequila'
  const lvl = level(buzz)
  return `🥃 Claude downs a shot of ${name}. That's ${buzz.shots}. Claude is now ${NAMES[lvl]}.`
}

// Each message keeps the level it was written at: the transcript redraws old messages, and a
// tipsy reply shouldn't turn wasted (or sober) later. A streaming message grows, so a text that
// extends one we've seen inherits its level.
export class LevelMemory {
  private levels = new Map<string, Level>()

  constructor(private readonly limit = 400) {}

  levelFor(text: string, current: Level): Level {
    const known = this.levels.get(text)
    if (known !== undefined) return known
    let lvl = current
    for (const [seen, seenLevel] of this.levels) {
      if (seen.length >= 8 && text.startsWith(seen)) {
        lvl = seenLevel
        this.levels.delete(seen)
        break
      }
    }
    this.levels.set(text, lvl)
    if (this.levels.size > this.limit) {
      const oldest = this.levels.keys().next().value
      if (oldest !== undefined) this.levels.delete(oldest)
    }
    return lvl
  }
}
