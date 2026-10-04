// Pixel-art Claude faces for the band above the prompt.
// Sprites are 24×14 pixels, drawn with half blocks: 2 pixels per terminal cell → 24 columns × 7 rows.
// The body sits on the left 20; the right edge is room for steam.
// Each terminal row holds sprite rows y = 2k-1 and 2k (the body is drawn one row down). Some terminals
// add line spacing, which splits any shape that crosses a row boundary mid-colour, so features sit
// inside the pairs {-1,0} {1,2} {3,4} {5,6} {7,8} {9,10}.

export const FACE_COLUMNS = 24
export const FACE_ROWS = 7
const W = FACE_COLUMNS

const DEFAULT = 0x01000000
const PALETTE: Record<string, number> = {
  o: 0xd97757, // body (Claude coral)
  s: 0xa9533a, // shade: lids
  k: 0x1a1a1a, // eyes, mouth
  w: 0xffffff, // eye shine
  b: 0x5ab4f0, // tears
  p: 0xf0a0a0, // blush
  m: 0xc8c8c8, // steam
  h: 0xff5c7a, // heart
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

const rect = (x0: number, y0: number, x1: number, y1: number, c: string): Pixel[] => {
  const out: Pixel[] = []
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y, c])
  return out
}

// Each mood is a loop of frames; each frame is the overlay drawn on BODY.
const ANNOYED: Pixel[][] = (() => {
  const lids = [...rect(5, 3, 8, 3, 's'), ...rect(11, 3, 14, 3, 's')]
  const mouth = rect(10, 8, 13, 8, 'k')
  const look = (dx: number, y: number) => [...lids, ...rect(6 + dx, y, 7 + dx, y, 'k'), ...rect(12 + dx, y, 13 + dx, y, 'k'), ...mouth]
  const side = look(1, 5)
  return [look(0, 5), side, side, side, side, look(0, 4), look(0, 4), side, side, side]
})()

const HURT: Pixel[][] = (() => {
  const eyes = [
    ...rect(5, 3, 7, 6, 'k'), [5, 3, 'w'] as Pixel,
    ...rect(12, 3, 14, 6, 'k'), [12, 3, 'w'] as Pixel,
  ]
  const blush: Pixel[] = [[4, 7, 'p'], [15, 7, 'p']]
  const wobbleA: Pixel[] = [[8, 9, 'k'], [9, 8, 'k'], [10, 9, 'k'], [11, 8, 'k']]
  const wobbleB: Pixel[] = [[8, 8, 'k'], [9, 9, 'k'], [10, 8, 'k'], [11, 9, 'k']]
  const tear = (y: number): Pixel[] => (y < 0 ? [] : [[6, y, 'b'], ...(y > 7 ? [[6, y - 1, 'b'] as Pixel] : [])])
  return [
    [...eyes, ...blush, ...wobbleA],
    [...eyes, ...blush, ...wobbleB, ...tear(7)],
    [...eyes, ...blush, ...wobbleA, ...tear(8)],
    [...eyes, ...blush, ...wobbleB, ...tear(9)],
    [...eyes, ...blush, ...wobbleA, ...tear(10)],
    [...eyes, ...blush, ...wobbleB],
  ]
})()

const SILENT: Pixel[][] = (() => {
  // Back turned: no face at all. Every so often one eye peeks round the side, then hides again.
  // Bold, simple shapes only: fine detail turns to noise at two pixels per cell.
  const PUFFS: Pixel[][] = [
    [],
    [[14, 0, 'm']],
    [[14, 0, 'm'], [15, 0, 'm'], [15, -1, 'm']],
    [[15, -1, 'm'], [16, -1, 'm'], [16, 0, 'm'], [17, -1, 'm']],
    [[17, -1, 'm'], [18, -1, 'm']],
    [],
  ]
  const peek: Pixel[] = [...rect(14, 3, 16, 4, 'w'), [14, 4, 'k']]
  const back = (puff: number, isPeeking = false): Pixel[] => [...(PUFFS[puff] ?? []), ...(isPeeking ? peek : [])]
  return [
    back(0), back(1), back(2), back(3), back(4), back(5),
    back(0), back(0), back(0, true), back(0, true), back(0), back(0),
  ]
})()

const SAD: Pixel[][] = (() => {
  // Turned back round after the apology: eyes shut, two tear streams, a small frown. 😢
  const eyes = [...rect(5, 4, 7, 4, 'k'), ...rect(12, 4, 14, 4, 'k')]
  const frown: Pixel[] = [[9, 7, 'k'], [10, 7, 'k'], [8, 8, 'k'], [11, 8, 'k']]
  const tears = (n: number): Pixel[] => [
    ...(n >= 1 ? [...rect(6, 5, 6, 6, 'b'), ...rect(13, 5, 13, 6, 'b')] : []),
    ...(n >= 2 ? [...rect(6, 7, 6, 8, 'b'), ...rect(13, 7, 13, 8, 'b')] : []),
    ...(n >= 3 ? [...rect(6, 9, 6, 10, 'b'), ...rect(13, 9, 13, 10, 'b')] : []),
  ]
  const face = (n: number) => [...eyes, ...frown, ...tears(n)]
  return [face(0), face(1), face(2), face(3), face(3), face(3), face(1), face(2), face(3), face(3)]
})()

const FINE: Pixel[][] = (() => {
  // Made up: happy ^ ^ eyes, a small smile, blush, a little heart popping above its head.
  const eyes: Pixel[] = [[5, 4, 'k'], [6, 3, 'k'], [7, 4, 'k'], [12, 4, 'k'], [13, 3, 'k'], [14, 4, 'k']]
  const smile: Pixel[] = [[8, 7, 'k'], [11, 7, 'k'], [9, 8, 'k'], [10, 8, 'k']]
  const blush: Pixel[] = [[4, 6, 'p'], [5, 6, 'p'], [14, 6, 'p'], [15, 6, 'p']]
  const heart = (x: number): Pixel[] => [[x, -1, 'h'], [x + 2, -1, 'h'], [x + 1, 0, 'h']]
  const face = (h: number | null) => [...eyes, ...smile, ...blush, ...(h === null ? [] : heart(h))]
  return [face(null), face(16), face(16), face(17), face(18), face(null), face(null), face(null)]
})()

export type Face = 'annoyed' | 'hurt' | 'silent' | 'sad' | 'fine'
const FRAMES: Record<Face, Pixel[][]> = { annoyed: ANNOYED, hurt: HURT, silent: SILENT, sad: SAD, fine: FINE }

// The body is drawn one row down, leaving a row of sky above the head (overlay y = -1).
function pixels(face: Face, frame: number): string[][] {
  const grid = ['.'.repeat(W), ...BODY.slice(0, -1)].map(row => row.split(''))
  const frames = FRAMES[face]
  for (const [x, y, c] of frames[frame % frames.length] ?? []) {
    const row = grid[y + 1]
    if (row) row[x] = c
  }
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FACE_COLUMNS} ${FACE_ROWS * 2}" shape-rendering="crispEdges">${rects.join('')}</svg>`
}
