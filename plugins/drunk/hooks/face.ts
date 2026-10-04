// Pixel-art drunk Claude for the band above the prompt.
// Sprites are 24×14 pixels, drawn with half blocks: 2 pixels per terminal cell → 24 columns × 7 rows.
// Each terminal row holds sprite rows y = 2k-1 and 2k (the body is drawn one row down). Some terminals
// add line spacing, which splits any shape that crosses a row boundary mid-colour, so features sit
// inside the pairs {-1,0} {1,2} {3,4} {5,6} {7,8} {9,10}. Bold simple shapes only.

export const FACE_COLUMNS = 24
export const FACE_ROWS = 7
const W = FACE_COLUMNS

const DEFAULT = 0x01000000
const PALETTE: Record<string, number> = {
  o: 0xd97757, // body (Claude coral)
  k: 0x1a1a1a, // eyes, mouth, sunglasses
  r: 0xff4d6d, // flushed cheeks
  t: 0xff8fab, // tongue
  g: 0x3fa34d, // bottle
  c: 0x8b5a2b, // cork
  w: 0xffffff, // hiccup bubble, glint
  i: 0x9fd8ff, // ice pack
}
const BODY_COLOR = PALETTE.o

const BODY = [
  '........................',
  '...oooooooooooooo.......',
  '...oooooooooooooo.......',
  '...oooooooooooooo.......',
  '...oooooooooooooo.......',
  '.oooooooooooooooooo.....',
  '.oooooooooooooooooo.....',
  '...oooooooooooooo.......',
  '...oooooooooooooo.......',
  '...oooooooooooooo.......',
  '...oooooooooooooo.......',
  '....o.o......o.o........',
  '....o.o......o.o........',
  '........................',
]

type Pixel = [x: number, y: number, color: string]
type Frame = { dx: number; pixels: Pixel[] }

const rect = (x0: number, y0: number, x1: number, y1: number, c: string): Pixel[] => {
  const out: Pixel[] = []
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y, c])
  return out
}

const BOTTLE: Pixel[] = [[19, 1, 'c'], [19, 2, 'g'], ...rect(19, 3, 20, 6, 'g'), [20, 3, 'w']]
const BUBBLES: Pixel[][] = [[], [[16, 0, 'w']], [[17, -1, 'w']], []]
const bubble = (n: number): Pixel[] => BUBBLES[n % BUBBLES.length] ?? []
const sway = (pattern: number[], make: (i: number) => Pixel[]): Frame[] => pattern.map((dx, i) => ({ dx, pixels: make(i) }))

const TIPSY = sway([0, 0, 0, 1, 1, 1, 0, 0, 0, -1, -1, -1], () => [
  ...rect(6, 3, 7, 4, 'k'), ...rect(12, 3, 13, 4, 'k'),
  ...rect(4, 5, 5, 6, 'r'), ...rect(14, 5, 15, 6, 'r'),
  [8, 7, 'k'], [11, 7, 'k'], [9, 8, 'k'], [10, 8, 'k'],
])

const DRUNK = sway([0, 1, 1, 1, 0, -1, -1, -1], i => [
  ...rect(6, 3, 7, 4, 'k'), ...rect(12, 4, 13, 4, 'k'),
  ...rect(4, 5, 6, 6, 'r'), ...rect(13, 5, 15, 6, 'r'),
  ...rect(8, 7, 11, 7, 'k'), [10, 8, 't'], [11, 8, 't'],
  ...BOTTLE, ...bubble(i),
])

const WASTED = sway([-1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1], i => [
  ...rect(5, 3, 7, 3, 'k'), ...rect(12, 4, 14, 4, 'k'),
  ...rect(4, 5, 7, 6, 'r'), ...rect(12, 5, 15, 6, 'r'),
  ...rect(9, 7, 10, 8, 'k'),
  ...BOTTLE, ...bubble(i), ...bubble(i + 2).map(([x, y, c]): Pixel => [x - 3, y, c]),
])

const HANGOVER: Frame[] = (() => {
  const shades = [...rect(5, 3, 8, 4, 'k'), ...rect(11, 3, 14, 4, 'k'), ...rect(9, 3, 10, 3, 'k'), [6, 3, 'w'] as Pixel]
  const ice = rect(6, 1, 10, 2, 'i')
  const flat = rect(8, 8, 11, 8, 'k')
  const wince: Pixel[] = [[8, 8, 'k'], [9, 7, 'k'], [10, 8, 'k'], [11, 7, 'k']]
  const still = { dx: 0, pixels: [...shades, ...ice, ...flat] }
  return [still, still, still, still, still, { dx: 0, pixels: [...shades, ...ice, ...wince] }, still, still]
})()

export type Face = 'tipsy' | 'drunk' | 'wasted' | 'hangover'
const FRAMES: Record<Face, Frame[]> = { tipsy: TIPSY, drunk: DRUNK, wasted: WASTED, hangover: HANGOVER }

// The body is drawn one row down, leaving a row of sky above the head (overlay y = -1), and the
// whole sprite shifts by the frame's sway.
function pixels(face: Face, frame: number): string[][] {
  const frames = FRAMES[face]
  const f = frames[frame % frames.length] ?? { dx: 0, pixels: [] }
  const grid = Array.from({ length: BODY.length }, () => Array.from({ length: W }, () => '.'))
  const put = (x: number, y: number, c: string) => {
    const row = grid[y + 1]
    const at = x + f.dx + 1
    if (row && at >= 0 && at < W) row[at] = c
  }
  BODY.slice(0, -1).forEach((line, y) => line.split('').forEach((c, x) => { if (c !== '.') put(x, y, c) }))
  for (const [x, y, c] of f.pixels) put(x, y, c)
  return grid
}

// Packs a frame into a Raster's `cells`: base64 of [codePoint, fg, bg] u32 triplets.
export function faceCells(face: Face, frame: number): string {
  const grid = pixels(face, frame)
  const words = new Uint32Array(W * FACE_ROWS * 3)
  let i = 0
  for (let row = 0; row < FACE_ROWS; row++) {
    for (let x = 0; x < W; x++) {
      const top = PALETTE[grid[row * 2]?.[x] ?? '.']
      const bottom = PALETTE[grid[row * 2 + 1]?.[x] ?? '.']
      // Terminals with extra line spacing paint the gap in the cell's background, so the
      // background is the body (or the empty side) and the feature rides in the glyph.
      if (top === undefined && bottom === undefined) words.set([0x20, DEFAULT, DEFAULT], i)
      else if (top === undefined) words.set([0x2584, bottom ?? DEFAULT, DEFAULT], i) // ▄
      else if (bottom === undefined) words.set([0x2580, top, DEFAULT], i) // ▀
      else if (top === BODY_COLOR && bottom !== BODY_COLOR) words.set([0x2584, bottom, top], i) // ▄ on body
      else words.set([0x2580, top, bottom], i) // ▀
      i += 3
    }
  }
  const bytes = new Uint8Array(words.buffer)
  let binary = ''
  for (let j = 0; j < bytes.length; j++) binary += String.fromCharCode(bytes[j] ?? 0)
  return btoa(binary)
}

// The same frame as an SVG of squares, for the Desktop app (no Raster there).
export function faceSvg(face: Face, frame: number): string {
  const grid = pixels(face, frame)
  const rects: string[] = []
  grid.forEach((row, y) => row.forEach((c, x) => {
    const color = PALETTE[c]
    if (color !== undefined) rects.push(`<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="#${color.toString(16).padStart(6, '0')}"/>`)
  }))
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${FACE_ROWS * 2}" shape-rendering="crispEdges">${rects.join('')}</svg>`
}
