import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { LevelMemory, MAX_SHOTS, NAMES, SOBER, SPINNER_WORDS, afterPrompt, buzzNote, level, shotLine, slur, soberUp, takeShot } from './buzz'
import { FACE_COLUMNS, FACE_ROWS, faceCells, faceSvg } from './face'
import type { Face } from './face'

const buzz = atom({ plugin: 'drunk', key: 'buzz' } as const, SOBER)
const frame = atom({ plugin: 'drunk', key: 'frame' } as const, 0)

const FRAME_MS = 350
const FACE_FOR: Record<1 | 2 | 3, Face> = { 1: 'tipsy', 2: 'drunk', 3: 'wasted' }

const pick = (list: readonly string[]): string => list[Math.floor(Math.random() * list.length)] ?? 'Hiccuping'

export const register: Register = on => {
  // One spinner word per turn, so it doesn't flicker between redraws.
  let spinnerWord: string | null = null
  const written = new LevelMemory()

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'shot', description: 'Give Claude a shot (optionally name the drink: /shot tequila)' })
    await $.command.register({ name: 'water', description: 'Sober Claude up. It will be hungover for a bit.' })
    // Animate only while there's a face to show.
    $.clock.every(FRAME_MS, async () => {
      const now = await read($, buzz)
      if (now.shots > 0 || now.hangover > 0) await update($, frame, n => n + 1)
    })
    return next(e)
  })

  on('command.run', { command: 'shot' }, async ($, e) => {
    const { buzz: after, isCutOff } = takeShot(await read($, buzz))
    await update($, buzz, () => after)
    if (isCutOff) return { text: `🚫 The bartender cut Claude off at ${MAX_SHOTS}. Try /water.` }
    return { text: shotLine(after, e.args, Math.floor(Math.random() * 100)) }
  })

  on('command.run', { command: 'water' }, async $ => {
    const before = await read($, buzz)
    if (before.shots === 0) return { text: '💧 Claude is already sober.' }
    await update($, buzz, soberUp)
    return { text: '💧 Claude drinks a big glass of water. Sober now. Hungover, though.' }
  })

  // Compacting the context is a good night's sleep: sober, and hungover.
  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    await update($, buzz, soberUp)
    return result
  })

  on('prompt.submit', async ($, e, next) => {
    const now = await read($, buzz)
    const note = buzzNote(now)
    const lvl = level(now)
    spinnerWord = now.hangover > 0 ? pick(SPINNER_WORDS.hangover) : lvl === 0 ? null : pick(SPINNER_WORDS[lvl])
    await update($, buzz, afterPrompt)
    return next(note ? { ...e, context: [...(e.context ?? []), note] } : e)
  })

  // Display only: what Claude wrote stays as written; the screen gets slurred.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const lvl = written.levelFor(e.props.text, level(await read($, buzz)))
    if (lvl === 0) return next(e)
    return next({ ...e, props: { ...e.props, text: slur(e.props.text, lvl) } })
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (!spinnerWord) return next(e)
    return next({ ...e, props: { ...e.props, word: spinnerWord } })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const now = await read($, buzz)
    const lvl = level(now)
    if ((lvl === 0 && now.hangover === 0) || e.props.hasSurvey) return next(e)

    const face: Face = lvl === 0 ? 'hangover' : FACE_FOR[lvl]
    const tick = await read($, frame)
    const shots = `${now.shots} shot${now.shots === 1 ? '' : 's'}`
    const [title, hint] = lvl === 0
      ? ['Claude is hungover', 'keep it down. please.']
      : [`Claude is ${NAMES[lvl]} · ${shots}`, now.shots >= MAX_SHOTS ? 'cut off. /water' : '/shot for another · /water to sober up']

    if (e.surface === 'terminal') {
      const { Box, Raster, Text } = $.ui.resolve(e)
      return (
        <Box flexDirection="row">
          <Raster key="face" columns={FACE_COLUMNS} rows={FACE_ROWS} cells={faceCells(face, tick)} />
          <Box flexDirection="column" paddingLeft={2} justifyContent="center">
            <Text bold>{title}</Text>
            <Text dimColor>{hint}</Text>
          </Box>
        </Box>
      )
    }
    if (e.surface === 'desktop') {
      const { Box, Svg, Text } = $.ui.resolve(e)
      return (
        <Box flexDirection="row" alignItems="center">
          <Svg source={faceSvg(face, tick)} alt={`Claude looks ${lvl === 0 ? 'hungover' : NAMES[lvl]}`} width={60} height={42} />
          <Box flexDirection="column" paddingLeft={2}>
            <Text bold>{title}</Text>
            <Text dimColor>{hint}</Text>
          </Box>
        </Box>
      )
    }
    const { Text } = $.ui.resolve(e)
    return <Text dimColor>{lvl === 0 ? '🕶️' : '🥴'} {title} · {hint}</Text>
  })
}
