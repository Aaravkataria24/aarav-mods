import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { FACE_COLUMNS, FACE_ROWS, faceCells, faceSvg } from './face'
import type { Face } from './face'
import { CALM, FACES, NAMES, SPINNER_WORDS, moodNote, nextAfterglow, step } from './mood'
import type { Afterglow, Level } from '../types'

const mood = atom({ plugin: 'sulky', key: 'mood' } as const, CALM)
// Animation tick for the face, and the make-up beat after an apology (sad, then "it's fine").
const frame = atom({ plugin: 'sulky', key: 'frame' } as const, 0)
const afterglow = atom({ plugin: 'sulky', key: 'afterglow' } as const, 'none' as Afterglow)

const FACE_FOR: Record<Exclude<Level, 0>, Face> = { 1: 'annoyed', 2: 'hurt', 3: 'silent' }
const FRAME_MS = 400

type Stats = { yells: number; apologies: number; silentTreatments: number }
const NO_STATS: Stats = { yells: 0, apologies: 0, silentTreatments: 0 }

const pick = (list: readonly string[]): string => list[Math.floor(Math.random() * list.length)] ?? 'Sulking'

export const register: Register = on => {
  // One spinner word per turn, so it doesn't flicker between redraws.
  let spinnerWord: string | null = null

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'grudge',
      description: "How mad Claude is at you, and how often you've yelled at it",
    })
    // Animate only while there's a face to show.
    $.clock.every(FRAME_MS, async () => {
      if ((await read($, mood)).level > 0 || (await read($, afterglow)) !== 'none') await update($, frame, n => n + 1)
    })
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    const before = await read($, mood)
    const { mood: after, event } = step(before, e.text ?? '')
    await update($, mood, () => after)
    const glow = nextAfterglow(await read($, afterglow), event)
    await update($, afterglow, () => glow)

    if (event.kind === 'yell' || event.kind === 'forgiven') {
      const stats = { ...NO_STATS, ...((await $.store.get('stats')) as Partial<Stats> | undefined) }
      if (event.kind === 'yell') stats.yells += 1
      if (event.kind === 'yell' && after.level === 3) stats.silentTreatments += 1
      if (event.kind === 'forgiven') stats.apologies += 1
      await $.store.set('stats', stats)
    }

    spinnerWord = after.level === 0 ? null : pick(SPINNER_WORDS[after.level])
    const note = moodNote(after, event, glow)
    return next(note ? { ...e, context: [...(e.context ?? []), note] } : e)
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (!spinnerWord) return next(e)
    return next({ ...e, props: { ...e.props, word: spinnerWord } })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const now = await read($, mood)
    const glow = await read($, afterglow)
    if ((now.level === 0 && glow === 'none') || e.props.hasSurvey) return next(e)

    const face: Face = now.level === 0 ? (glow === 'sad' ? 'sad' : 'fine') : FACE_FOR[now.level]
    const tick = await read($, frame)
    const [title, hint] =
      now.level === 3 ? ['Claude turned its back on you · silent treatment', 'an apology would help']
      : now.level > 0 ? [`Claude is upset with you · ${NAMES[now.level]}`, 'say sorry or wait it out']
      : glow === 'sad' ? ['Claude accepted your apology', '(give it a minute)']
      : ["it's fine.", "(you're forgiven. this time.)"]

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
          <Svg source={faceSvg(face, tick)} alt={`Claude looks ${now.level > 0 ? NAMES[now.level] : glow === 'sad' ? 'sad' : 'happy again'}`} width={60} height={42} />
          <Box flexDirection="column" paddingLeft={2}>
            <Text bold>{title}</Text>
            <Text dimColor>{hint}</Text>
          </Box>
        </Box>
      )
    }
    const { Text } = $.ui.resolve(e)
    return <Text dimColor>{FACES[now.level]} {title} · {hint}</Text>
  })

  on('command.run', { command: 'grudge' }, async $ => {
    const now = await read($, mood)
    const stats = { ...NO_STATS, ...((await $.store.get('stats')) as Partial<Stats> | undefined) }
    const status = now.level === 0
      ? `${FACES[0]} Claude isn't mad at you. Right now.`
      : `${FACES[now.level]} Claude is ${NAMES[now.level]}.`
    return {
      text: [
        status,
        `Times you've yelled at Claude: ${stats.yells}`,
        `Apologies: ${stats.apologies}`,
        `Silent treatments earned: ${stats.silentTreatments}`,
      ].join('\n'),
    }
  })
}
