import { describe, expect, test } from 'claude-code/testing'

import { LevelMemory, MAX_SHOTS, SOBER, afterPrompt, buzzNote, level, slur, soberUp, takeShot } from './buzz'

describe('shots and levels', () => {
  test('1 shot tipsy, 2–3 drunk, 4+ wasted', () => {
    expect(level({ shots: 0, hangover: 0 })).toBe(0)
    expect(level({ shots: 1, hangover: 0 })).toBe(1)
    expect(level({ shots: 3, hangover: 0 })).toBe(2)
    expect(level({ shots: 4, hangover: 0 })).toBe(3)
  })

  test('the bartender cuts Claude off', () => {
    const r = takeShot({ shots: MAX_SHOTS, hangover: 0 })
    expect(r.isCutOff).toBe(true)
    expect(r.buzz.shots).toBe(MAX_SHOTS)
  })

  test('sobering up trades the buzz for a 3-prompt hangover', () => {
    let b = soberUp({ shots: 4, hangover: 0 })
    expect(b).toEqual({ shots: 0, hangover: 3 })
    b = afterPrompt(afterPrompt(afterPrompt(b)))
    expect(b.hangover).toBe(0)
    expect(soberUp(SOBER)).toEqual(SOBER)
  })

  test('a shot during a hangover cures it', () => {
    expect(takeShot({ shots: 0, hangover: 2 }).buzz).toEqual({ shots: 1, hangover: 0 })
  })
})

describe('slur', () => {
  test('sober text is untouched', () => {
    expect(slur('Sure, this is simple.', 0)).toBe('Sure, this is simple.')
  })

  test('drunk text slurs', () => {
    expect(slur('Sure, this is simple and it works.', 3)).toContain('sh')
  })

  test('code, paths, urls and identifiers survive exactly', () => {
    const text = 'Fixed it in `src/sessions.ts` and set SESSION_SECRET.\n```ts\nconst sessions = new Set()\n```\nSee https://docs.example.com/sessions and [the docs](https://x.com/s).'
    const out = slur(text, 3)
    expect(out).toContain('`src/sessions.ts`')
    expect(out).toContain('SESSION_SECRET')
    expect(out).toContain('const sessions = new Set()')
    expect(out).toContain('https://docs.example.com/sessions')
    expect(out).toContain('[the docs](https://x.com/s)')
  })

  test('the same message slurs the same way every time (no flicker)', () => {
    const text = 'So this is the session store. It saves sessions. Simple stuff.'
    expect(slur(text, 2)).toBe(slur(text, 2))
  })
})

describe('buzzNote', () => {
  test('nothing when sober', () => {
    expect(buzzNote(SOBER)).toBe(null)
  })

  test('drunk notes protect the work and tell the model not to slur', () => {
    const note = buzzNote({ shots: 3, hangover: 0 }) ?? ''
    expect(note).toContain('drunk')
    expect(note).toContain('code, commands and file contents stay completely normal')
    expect(note).toContain('never misspell')
  })

  test('hangover has its own note', () => {
    expect(buzzNote({ shots: 0, hangover: 2 }) ?? '').toContain('hungover')
  })
})

describe('LevelMemory', () => {
  test('a message keeps the level it was written at', () => {
    const m = new LevelMemory()
    expect(m.levelFor('A tipsy reply.', 1)).toBe(1)
    expect(m.levelFor('A tipsy reply.', 3)).toBe(1)
    expect(m.levelFor('A tipsy reply.', 0)).toBe(1)
  })

  test('a streaming message inherits the level it started at', () => {
    const m = new LevelMemory()
    expect(m.levelFor('Sure, here is', 2)).toBe(2)
    expect(m.levelFor('Sure, here is the answer.', 0)).toBe(2)
  })

  test('new messages take the current level', () => {
    const m = new LevelMemory()
    m.levelFor('old one, written sober', 0)
    expect(m.levelFor('a brand new message', 3)).toBe(3)
  })
})
