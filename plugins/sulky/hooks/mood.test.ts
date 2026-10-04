import { describe, expect, test } from 'claude-code/testing'

import { CALM, isApology, moodNote, nextAfterglow, step, yellScore } from './mood'

describe('yellScore', () => {
  test('calm prompts score 0', () => {
    expect(yellScore('can you fix the login bug?')).toBe(0)
    expect(yellScore('add an API for the JSON export and update the CSS')).toBe(0)
    expect(yellScore('no, use the other file')).toBe(0)
  })

  test('shouting scores', () => {
    expect(yellScore('WHY IS THE BUILD BROKEN AGAIN')).toBeGreaterThanOrEqual(2)
    expect(yellScore('WHY ARE YOU SO SLOW. what is the capital of australia')).toBeGreaterThanOrEqual(2)
    expect(yellScore('use the AWS SDK and the GCP API')).toBe(0)
  })

  test('swearing and insults score, and stack', () => {
    expect(yellScore('wtf did you do')).toBe(1)
    expect(yellScore('this is useless, are you serious')).toBe(2)
    expect(yellScore('WHAT THE FUCK IS THIS GARBAGE!!!')).toBe(3)
  })

  test('hype swearing is not yelling', () => {
    expect(yellScore('holy shit this is amazing')).toBe(0)
    expect(yellScore('fuck yes lets go')).toBe(0)
  })

  test('pasted logs, code and identifiers are ignored', () => {
    expect(yellScore('getting this:\n```\nERROR: CONNECTION REFUSED AT PORT 5432\n```\nany idea?')).toBe(0)
    expect(yellScore('set DATABASE_URL and NODE_ENV in `.env`')).toBe(0)
    expect(yellScore('Error: ECONNREFUSED FAILED TO CONNECT TO DATABASE\nhow do i fix')).toBe(0)
  })
})

describe('isApology', () => {
  test('recognises apologies', () => {
    expect(isApology('sorry, my bad')).toBe(true)
    expect(isApology("ok i'm sorry. love you")).toBe(true)
    expect(isApology('you are the best')).toBe(true)
    expect(isApology('fix the sort order')).toBe(false)
  })
})

describe('step', () => {
  test('yells escalate the grudge up to silent treatment', () => {
    let mood = CALM
    mood = step(mood, 'wtf').mood
    expect(mood.level).toBe(1)
    mood = step(mood, 'this is useless').mood
    expect(mood.level).toBe(2)
    mood = step(mood, 'ARE YOU SERIOUS RIGHT NOW!!!').mood
    expect(mood.level).toBe(3)
    mood = step(mood, 'STUPID STUPID STUPID').mood
    expect(mood.level).toBe(3)
  })

  test('a huge yell jumps two levels', () => {
    expect(step(CALM, 'WHAT THE FUCK IS THIS GARBAGE!!!').mood.level).toBe(2)
  })

  test('two calm prompts cool it down one level', () => {
    let r = step({ level: 2, calmStreak: 0 }, 'ok now add tests')
    expect(r.event.kind).toBe('still-upset')
    r = step(r.mood, 'and run them')
    expect(r.event.kind).toBe('cooled')
    expect(r.mood.level).toBe(1)
  })

  test('an apology forgives everything', () => {
    const r = step({ level: 3, calmStreak: 0 }, 'ok im sorry')
    expect(r.mood.level).toBe(0)
    expect(r.event).toEqual({ kind: 'forgiven', from: 3 })
  })

  test('an apology when calm is just calm', () => {
    expect(step(CALM, 'sorry, one more thing').event.kind).toBe('calm')
  })
})

describe('moodNote', () => {
  test('nothing when calm', () => {
    expect(moodNote(CALM, { kind: 'calm' })).toBe(null)
  })

  test('always protects the work', () => {
    const note = moodNote({ level: 3, calmStreak: 0 }, { kind: 'yell', score: 3 }) ?? ''
    expect(note).toContain('silent treatment')
    expect(note).toContain('Never refuse')
  })

  test('the make-up beats get their own notes', () => {
    expect(moodNote(CALM, { kind: 'forgiven', from: 3 }, 'sad') ?? '').toContain('teary')
    expect(moodNote(CALM, { kind: 'calm' }, 'fine') ?? '').toContain("it's fine")
  })
})

describe('nextAfterglow', () => {
  test('a big grudge goes sad, then fine, then back to normal', () => {
    let glow = nextAfterglow('none', { kind: 'forgiven', from: 3 })
    expect(glow).toBe('sad')
    glow = nextAfterglow(glow, { kind: 'calm' })
    expect(glow).toBe('fine')
    expect(nextAfterglow(glow, { kind: 'calm' })).toBe('none')
  })

  test('a small grudge skips straight to fine', () => {
    expect(nextAfterglow('none', { kind: 'forgiven', from: 1 })).toBe('fine')
  })

  test('yelling during the make-up cancels it', () => {
    expect(nextAfterglow('sad', { kind: 'yell', score: 2 })).toBe('none')
  })
})
