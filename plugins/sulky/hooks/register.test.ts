import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

// An in-memory store, and a bottom for prompt.submit that records what reached it.
function harness(on: On) {
  mock.store(on)
  const seen: { context?: readonly string[] }[] = []
  on('prompt.submit', async (_$, e) => {
    seen.push({ context: e.context })
    return { text: e.text }
  })
  return { last: () => seen[seen.length - 1]?.context }
}

const typed = (text: string) => ({ text, wait: false, origin: { kind: 'composer' } } as const)


describe('prompt.submit', () => {
  test('a calm prompt passes through untouched', async ($, on) => {
    const h = harness(on)
    await $.prompt.submit(typed('please add a test'))
    expect(h.last()).toBe(undefined)
  })

  test('a yell attaches a hidden mood note', async ($, on) => {
    const h = harness(on)
    await $.prompt.submit(typed('WHY IS THIS STILL BROKEN!!!'))
    expect(h.last()?.length).toBe(1)
    expect(h.last()?.[0]).toContain('The user just yelled at you')
  })

  test('an apology after a yell forgives', async ($, on) => {
    const h = harness(on)
    await $.prompt.submit(typed('WHY IS THIS SO BROKEN, wtf'))
    await $.prompt.submit(typed('sorry, my bad'))
    expect(h.last()?.[0]).toContain('apologised')
    await $.prompt.submit(typed('ok what next'))
    expect(h.last()?.[0]).toContain('made up')
  })
})

describe('/grudge', () => {
  test('reports the stats', async ($, on) => {
    harness(on)
    await $.prompt.submit(typed('wtf'))
    const out = await $.command.run({ command: 'grudge', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
    expect(out.text ?? '').toContain("Times you've yelled at Claude: 1")
  })
})
