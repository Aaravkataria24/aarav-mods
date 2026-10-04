import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { BOARD_COLUMNS, BOARD_ROWS, DEFAULT_SWITCH, SWITCHES, boardCells, boardSvg, isSwitch, keyFor, keyForEdit } from './keys'
import type { BoardKey, Lit, Switch } from './keys'
import type { ClackSettings } from '../types'

const DEFAULTS: ClackSettings = { switch: DEFAULT_SWITCH, volume: 0.8, isMuted: false, isHidden: false }
const settings = atom({ plugin: 'clack', key: 'settings' } as const, DEFAULTS)
// Bumped to redraw the board as keys light up and fade.
const tick = atom({ plugin: 'clack', key: 'tick' } as const, 0)
const isHelperUp = atom({ plugin: 'clack', key: 'isHelperUp' } as const, false)

// Claude "types" at a human pace rather than at token speed.
const CLAUDE_KEY_MS = 55
// Past this, Claude's backlog is trimmed so the clacking keeps up with what's on screen.
const MAX_BACKLOG = 80
const LIT_MS = 180

export const register: Register = on => {
  const socketPath = `/tmp/clack-${crypto.randomUUID().slice(0, 8)}.sock`
  let isReady = false
  let backlog = ''
  const lit = new Map<BoardKey, { by: 'you' | 'claude'; at: number }>()

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    const saved = (await $.store.get('settings')) as Partial<ClackSettings> | undefined
    await update($, settings, () => ({ ...DEFAULTS, ...saved }))
    await $.command.register({ name: 'keyboard', description: 'Switch keyboard sound (/keyboard holypanda), volume (/keyboard volume 50), off/on, hide/show' })

    // The sound helper lives as long as the session; it preloads every switch and plays each
    // keystroke in a few milliseconds (spawning a player per sound would lag ~half a second).
    void (async () => {
      try {
        const helper = $.process.spawn({ argv: [`${$.plugin.root}/bin/clackd`, `${$.plugin.root}/sounds`, socketPath] })
        for await (const piece of helper) {
          if ('text' in piece && piece.text.includes('clackd ready')) {
            isReady = true
            await update($, isHelperUp, () => true)
          }
        }
      } catch {
        // Not macOS (or the helper couldn't start): the board still lights up, silently.
      }
      isReady = false
      await update($, isHelperUp, () => false)
    })()

    // One clock drives Claude's typing and fades the lit keys.
    $.clock.every(CLAUDE_KEY_MS, async () => {
      const char = backlog.charAt(0)
      if (char) {
        backlog = backlog.slice(1)
        // Runs of whitespace are one keystroke.
        while (/\s/.test(char) && /^\s/.test(backlog)) backlog = backlog.slice(1)
        const { sound, board } = keyFor(char)
        await press(sound, board, 'claude')
      }
      const now = performance.now()
      let changed = Boolean(char)
      for (const [key, l] of lit) if (now - l.at > LIT_MS) { lit.delete(key); changed = true }
      if (changed) await update($, tick, n => n + 1)
    })

    async function press(sound: string, board: BoardKey | null, by: 'you' | 'claude') {
      // Synchronous, so the key is lit before the redraw this keystroke triggers.
      if (board) lit.set(board, { by, at: performance.now() })
      const s = await read($, settings)
      if (!isReady || s.isMuted) return
      const gain = (s.volume * (0.85 + Math.random() * 0.2) * (by === 'claude' ? 0.8 : 1)).toFixed(2)
      const play = (kind: 'press' | 'release', name: string) =>
        $.http.fetch(`http://clack/play/${s.switch}/${kind}/${name}?gain=${gain}`, { socketPath }).catch(() => undefined)
      void play('press', sound)
      const release = sound.startsWith('GENERIC') ? 'GENERIC' : sound
      $.clock.after(60 + Math.random() * 40, () => void play('release', release))
    }
    pressFor = press
    return started
  })

  // Set once the session starts; the hooks below play through it.
  let pressFor: ((sound: string, board: BoardKey | null, by: 'you' | 'claude') => Promise<void>) | null = null

  // Your keystrokes in the prompt box. Fire and forget: typing never waits on a sound.
  on('prompt.edit', async ($, e, next) => {
    if (e.key && !e.key.ctrl && !e.key.meta) {
      const { sound, board } = keyForEdit(e.key.key)
      void pressFor?.(sound, board, 'you')
      await update($, tick, n => n + 1)
    }
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind === 'composer') void pressFor?.('ENTER', 'enter', 'you')
    return next(e)
  })

  // Claude's words as they stream in, typed out at a human pace.
  on('turn.step', async function* ($, e, next) {
    for await (const chunk of next(e)) {
      if (chunk.kind === 'text') backlog += chunk.text
      // Tool input (a file Claude is writing, a command) is typing too.
      if (chunk.kind === 'input') backlog += chunk.json.replace(/\\n/g, '\n').replace(/\\[t"\\]/g, ' ')
      if (backlog.length > MAX_BACKLOG) backlog = backlog.slice(-MAX_BACKLOG)
      yield chunk
    }
  })

  on('command.run', { command: 'keyboard' }, async ($, e) => {
    const [word = '', value = ''] = e.args.trim().toLowerCase().split(/\s+/)
    const current = await read($, settings)
    let changed: ClackSettings | null = null
    let reply = ''
    if (word === '') {
      const list = (Object.keys(SWITCHES) as Switch[])
        .map(k => `${k === current.switch ? '▸' : ' '} ${k.padEnd(10)} ${SWITCHES[k]}`).join('\n')
      reply = `⌨  ${SWITCHES[current.switch as Switch] ?? current.switch} · volume ${Math.round(current.volume * 100)}${current.isMuted ? ' · muted' : ''}\n\n${list}\n\n/keyboard <switch> · /keyboard volume 0-100 · /keyboard off|on · /keyboard hide|show`
    } else if (isSwitch(word)) {
      changed = { ...current, switch: word, isMuted: false }
      reply = `⌨  Now clacking on ${SWITCHES[word]}.`
    } else if (word === 'volume' && /^\d+$/.test(value)) {
      const volume = Math.min(100, Number(value)) / 100
      changed = { ...current, volume }
      reply = `⌨  Volume ${Math.round(volume * 100)}.`
    } else if (word === 'off' || word === 'mute') {
      changed = { ...current, isMuted: true }
      reply = '⌨  Muted. /keyboard on to clack again.'
    } else if (word === 'on' || word === 'unmute') {
      changed = { ...current, isMuted: false }
      reply = '⌨  Clacking.'
    } else if (word === 'hide' || word === 'show') {
      changed = { ...current, isHidden: word === 'hide' }
      reply = word === 'hide' ? '⌨  Keyboard hidden (sounds stay on).' : '⌨  Keyboard shown.'
    } else {
      reply = `Unknown switch "${word}". Try: ${Object.keys(SWITCHES).join(', ')}`
    }
    if (changed) {
      const next = changed
      await update($, settings, () => next)
      await $.store.set('settings', next)
      if (word && isSwitch(word)) void pressFor?.('GENERIC_R2', null, 'you')
    }
    return { text: reply }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = await read($, settings)
    if (s.isHidden || e.props.hasSurvey) return next(e)
    await read($, tick)
    const isUp = await read($, isHelperUp)
    const litNow: Record<BoardKey, 'you' | 'claude'> = {}
    for (const [key, l] of lit) litNow[key] = l.by
    const name = SWITCHES[s.switch as Switch] ?? s.switch
    const status = !isUp ? 'sound needs macOS' : s.isMuted ? 'muted' : `volume ${Math.round(s.volume * 100)}`

    if (e.surface === 'terminal') {
      const { Box, Raster, Text } = $.ui.resolve(e)
      return (
        <Box flexDirection="row">
          <Raster key="board" columns={BOARD_COLUMNS} rows={BOARD_ROWS} cells={boardCells(litNow as Lit)} />
          <Box flexDirection="column" paddingLeft={2} justifyContent="center">
            <Text bold>⌨  {name}</Text>
            <Text dimColor>{status}</Text>
            <Text dimColor>/keyboard to switch</Text>
          </Box>
        </Box>
      )
    }
    if (e.surface === 'desktop') {
      const { Box, Svg, Text } = $.ui.resolve(e)
      return (
        <Box flexDirection="row" alignItems="center">
          <Svg source={boardSvg(litNow as Lit)} alt="a keyboard lighting up as keys are typed" width={BOARD_COLUMNS * 6} height={BOARD_ROWS * 14} />
          <Box flexDirection="column" paddingLeft={2}>
            <Text bold>⌨  {name}</Text>
            <Text dimColor>{status} · /keyboard to switch</Text>
          </Box>
        </Box>
      )
    }
    return next(e)
  })
}
