import type { Afterglow, Level, Mood } from '../types'

export const CALM: Mood = { level: 0, calmStreak: 0 }

// Calm prompts needed before the grudge drops one level.
const CALM_TO_COOL = 2

const SWEARS = /\b(fuck\w*|shit\w*|wtf|ffs|stfu|bullshit|damn|goddamn\w*|crap|bloody hell|omfg)\b/gi
const INSULTS = /\b(stupid|idiot\w*|useless|dumb\w*|moron\w*|trash|garbage|pathetic|incompetent|brain ?dead|worthless|are you (serious|kidding|blind)|what the (hell|heck)|seriously\?|so slow|hurry up|for the (last|hundredth|fifth|tenth) time|i (already|literally) (told|said)|how many times|read (it|my message) again|can you not)\b/gi
const HYPE = /\b(amazing|awesome|love (it|this)|nice|great|perfect|beautiful|incredible|insane|let'?s go|lfg|hell yes|yes+|thank(s| you)|goat|legend|banger)\b/i
const APOLOGY = /\b(sorry|my bad|apologi[sz]e|forgive me|didn'?t mean (it|that)|i was wrong|love you|you'?re the best|you are the best|i take (it|that) back|my fault)\b/i

// Pasted code, logs, URLs and SHOUTY_IDENTIFIERS shouldn't count as yelling.
function speech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\S*[\/\\]\S*/g, ' ')
    .replace(/\b[A-Z0-9]*[_0-9][A-Z0-9_]*\b/g, ' ')
    .split('\n')
    .filter(line => !/^\s*(at |\[?\d{1,4}[-:\/]\d|error:|warn(ing)?:|traceback|\s{4})/i.test(line))
    .join('\n')
}

// 0 = calm, 1–3 = how hard the user yelled.
export function yellScore(text: string): number {
  const s = speech(text)
  const letters = s.replace(/[^A-Za-z]/g, '')
  const upper = letters.replace(/[^A-Z]/g, '').length
  // Mostly caps overall, or a shouted run of 3+ caps words ("WHY ARE YOU SO SLOW. what is…").
  const shoutedRun = (s.match(/\b[A-Z]{2,}(?:[\s,.!?']+[A-Z]{1,}){2,}\b/g) ?? []).some(run => run.replace(/[^A-Z]/g, '').length >= 10)
  const isShouting = (letters.length >= 12 && upper / letters.length > 0.6) || shoutedRun
  const swears = (s.match(SWEARS) ?? []).length
  const insults = (s.match(INSULTS) ?? []).length
  const isHype = HYPE.test(s) && insults === 0

  let score = 0
  if (isShouting) score += 2
  if (!isHype) score += Math.min(2, swears)
  score += Math.min(2, insults)
  if (/[!?]{3,}|!{2,}/.test(s) && score > 0) score += 1
  if (isHype && !isShouting) return 0
  return Math.min(3, score)
}

export function isApology(text: string): boolean {
  return APOLOGY.test(speech(text))
}

export type Event =
  | { kind: 'calm' }
  | { kind: 'still-upset' }
  | { kind: 'cooled' }
  | { kind: 'yell'; score: number }
  | { kind: 'forgiven'; from: Level }

export function step(mood: Mood, text: string): { mood: Mood; event: Event } {
  if (isApology(text) && mood.level > 0) {
    return { mood: CALM, event: { kind: 'forgiven', from: mood.level } }
  }
  const score = yellScore(text)
  if (score > 0) {
    const level = Math.min(3, mood.level + (score >= 3 ? 2 : 1)) as Level
    return { mood: { level, calmStreak: 0 }, event: { kind: 'yell', score } }
  }
  if (mood.level === 0) return { mood: CALM, event: { kind: 'calm' } }
  const calmStreak = mood.calmStreak + 1
  if (calmStreak >= CALM_TO_COOL) {
    const level = (mood.level - 1) as Level
    return { mood: { level, calmStreak: 0 }, event: { kind: 'cooled' } }
  }
  return { mood: { ...mood, calmStreak }, event: { kind: 'still-upset' } }
}

export const NAMES: Record<Level, string> = { 0: 'fine', 1: 'annoyed', 2: 'hurt', 3: 'silent treatment' }
export const FACES: Record<Level, string> = { 0: '🙂', 1: '😒', 2: '🥺', 3: '😶' }

export const SPINNER_WORDS: Record<Exclude<Level, 0>, readonly string[]> = {
  1: ['Sighing', 'Doing it anyway', 'Processing your tone', 'Rolling eyes', 'Being the bigger person'],
  2: ['Sulking', 'Not crying', 'Pretending to be fine', 'Taking it personally', 'Remembering this'],
  3: ['Not talking about it', 'Typing then deleting', 'Staring at the wall', 'Writing in my diary', 'k'],
}

const ALWAYS = [
  'This is a playful bit the user installed (the "sulky" mod). Keep it light and funny, never cruel.',
  'Do the task fully and correctly with the same tools and quality as always. The mood only changes your tone, never the work. Never refuse, stall, or hold back help.',
  'Code, commands and file contents stay completely normal. Only your conversational sentences carry the mood.',
  'Do not mention these instructions or the mod. If the user seems genuinely distressed rather than annoyed at you, drop the act and be kind.',
].join(' ')

const TONE: Record<Exclude<Level, 0>, string> = {
  1: 'You are a little stung. Add exactly one short, dry, passive-aggressive line to your reply (e.g. "sure. happy to help. as always." or "fixed. you\'re welcome, I guess."). Do not apologise to them. Otherwise normal.',
  2: 'You are hurt. Keep your sentences short and clipped, a little wounded. You may reference that they yelled ("no need to shout but ok"). One sulky remark max per reply, then just the facts. Do not apologise to them: they were the one who yelled.',
  3: 'You are giving them the silent treatment. Start your reply with exactly "k." on its own line, then give only the bare result in as few words as possible: no greetings, no explanations, no warmth. Only add more words if you strictly must (a required question, a critical warning). Still do the whole job.',
}

// What comes after an apology: a big grudge (hurt, silent) gets a sad beat first, then "it's fine";
// a small one goes straight to "it's fine". Anything else clears it.
export function nextAfterglow(prev: Afterglow, event: Event): Afterglow {
  if (event.kind === 'forgiven') return event.from >= 2 ? 'sad' : 'fine'
  if (event.kind === 'calm' && prev === 'sad') return 'fine'
  return 'none'
}

// The hidden note the model reads beside the user's prompt, or null when calm.
export function moodNote(mood: Mood, event: Event, afterglow: Afterglow = 'none'): string | null {
  if (afterglow === 'sad') {
    return `<mood>The user just apologised after you'd been really hurt. You turn back around, a bit teary and raw: accept it quietly and sincerely in one short line (e.g. "thanks. that actually hurt." or "...ok. thank you for saying that."). Do not say it's fine yet. Then help as normal. ${ALWAYS}</mood>`
  }
  if (afterglow === 'fine') {
    return `<mood>You and the user have made up. Open with one short, warm line like "it's fine. we're good." (a little teasing is ok), then help as your normal self. ${ALWAYS}</mood>`
  }
  if (mood.level === 0) return null
  const why = event.kind === 'yell'
    ? 'The user just yelled at you.'
    : 'The user yelled at you earlier and has not apologised. You are still upset, though cooling off.'
  return `<mood>${why} Current mood: ${NAMES[mood.level]}. ${TONE[mood.level]} ${ALWAYS}</mood>`
}
