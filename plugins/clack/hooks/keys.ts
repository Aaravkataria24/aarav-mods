// Which sound a key makes, and the little keyboard drawn above the prompt.

export const SWITCHES = {
  mxblue: 'Cherry MX Blue',
  mxbrown: 'Cherry MX Brown',
  mxblack: 'Cherry MX Black',
  holypanda: 'Holy Panda',
  topre: 'Topre',
  cream: 'NovelKeys Cream',
  alpaca: 'Alpaca',
  turquoise: 'Turquoise Tealios',
  blackink: 'Gateron Black Ink',
  redink: 'Gateron Red Ink',
  bluealps: 'Blue Alps',
  boxnavy: 'Box Navy',
  buckling: 'Buckling Spring (IBM Model M)',
} as const
export type Switch = keyof typeof SWITCHES
export const DEFAULT_SWITCH: Switch = 'mxblue'

export const isSwitch = (name: string): name is Switch => Object.hasOwn(SWITCHES, name)

// Board keys: one per character the board can show, plus the wide special keys.
export type BoardKey = string // 'a'..'z', '0'..'9', punctuation, 'space', 'enter', 'backspace'

const ROWS: readonly string[] = ['1234567890-=', 'qwertyuiop[]', "asdfghjkl;'", 'zxcvbnm,./']

// The recordings come per keyboard row: R0 numbers, R1 qwerty, R2 asdf, R3 zxcv, R4 bottom.
export function keyFor(char: string): { sound: string; board: BoardKey | null } {
  if (char === ' ') return { sound: 'SPACE', board: 'space' }
  if (char === '\n' || char === '\r') return { sound: 'ENTER', board: 'enter' }
  const c = char.toLowerCase()
  const row = ROWS.findIndex(r => r.includes(c))
  if (row >= 0) return { sound: `GENERIC_R${row}`, board: c }
  if (/[!@#$%^&*()_+]/.test(c)) return { sound: 'GENERIC_R0', board: '1234567890-='['!@#$%^&*()_+'.indexOf(c)] ?? null }
  return { sound: 'GENERIC_R4', board: null }
}

// The key a prompt-box edit came from, as `prompt.edit` names it.
export function keyForEdit(key: string): { sound: string; board: BoardKey | null } {
  const k = key.toLowerCase()
  if (k === 'space') return keyFor(' ')
  if (k === 'return' || k === 'enter') return keyFor('\n')
  if (k === 'backspace' || k === 'delete') return { sound: 'BACKSPACE', board: 'backspace' }
  if (k.length === 1) return keyFor(k)
  return { sound: 'GENERIC_R4', board: null }
}

// ---- the board: a Raster of keycaps (glyph on a coloured cap), one terminal row per key row ----

export type Lit = Readonly<Record<BoardKey, 'you' | 'claude'>>

type Cap = { key: BoardKey; label: string; width: number }
const capsFor = (row: string): Cap[] => row.split('').map(c => ({ key: c, label: c, width: 3 }))
const LAYOUT: { indent: number; caps: Cap[] }[] = [
  { indent: 0, caps: [...capsFor(ROWS[0] ?? ''), { key: 'backspace', label: 'bksp', width: 6 }] },
  { indent: 2, caps: capsFor(ROWS[1] ?? '') },
  { indent: 3, caps: [...capsFor(ROWS[2] ?? ''), { key: 'enter', label: 'enter', width: 7 }] },
  { indent: 5, caps: capsFor(ROWS[3] ?? '') },
  { indent: 13, caps: [{ key: 'space', label: '', width: 23 }] },
]
export const BOARD_COLUMNS = Math.max(...LAYOUT.map(r => r.indent + r.caps.reduce((n, c) => n + c.width + 1, 0)))
export const BOARD_ROWS = LAYOUT.length

const DEFAULT = 0x01000000
const CAP = 0x3a3a3c
const LEGEND = 0xa8a8ad
const YOU = 0xf2f2f2
const YOU_LEGEND = 0x1a1a1a
const CLAUDE = 0xd97757
const CLAUDE_LEGEND = 0xffffff

function grid(lit: Lit): { char: number; fg: number; bg: number }[][] {
  return LAYOUT.map(({ indent, caps }) => {
    const row: { char: number; fg: number; bg: number }[] = []
    const blank = () => row.push({ char: 0x20, fg: DEFAULT, bg: DEFAULT })
    for (let i = 0; i < indent; i++) blank()
    for (const cap of caps) {
      const by = lit[cap.key]
      const bg = by === 'you' ? YOU : by === 'claude' ? CLAUDE : CAP
      const fg = by === 'you' ? YOU_LEGEND : by === 'claude' ? CLAUDE_LEGEND : LEGEND
      const pad = Math.floor((cap.width - cap.label.length) / 2)
      for (let x = 0; x < cap.width; x++) {
        const ch = cap.label[x - pad]
        row.push({ char: ch ? ch.charCodeAt(0) : 0x20, fg, bg })
      }
      blank()
    }
    while (row.length < BOARD_COLUMNS) blank()
    return row
  })
}

// Packs the board into a Raster's `cells`: base64 of [codePoint, fg, bg] u32 triplets.
export function boardCells(lit: Lit): string {
  const cells = grid(lit).flat()
  const words = new Uint32Array(cells.length * 3)
  cells.forEach((c, i) => words.set([c.char, c.fg, c.bg], i * 3))
  const bytes = new Uint8Array(words.buffer)
  let binary = ''
  for (let j = 0; j < bytes.length; j++) binary += String.fromCharCode(bytes[j] ?? 0)
  return btoa(binary)
}

// The same board as SVG, for the Desktop app (no Raster there).
export function boardSvg(lit: Lit): string {
  const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`
  const parts: string[] = []
  LAYOUT.forEach(({ indent, caps }, y) => {
    let x = indent
    for (const cap of caps) {
      const by = lit[cap.key]
      const bg = by === 'you' ? YOU : by === 'claude' ? CLAUDE : CAP
      const fg = by === 'you' ? YOU_LEGEND : by === 'claude' ? CLAUDE_LEGEND : LEGEND
      parts.push(`<rect x="${x * 8}" y="${y * 18}" width="${cap.width * 8}" height="15" rx="3" fill="${hex(bg)}"/>`)
      if (cap.label) parts.push(`<text x="${(x + cap.width / 2) * 8}" y="${y * 18 + 11}" font-family="monospace" font-size="10" text-anchor="middle" fill="${hex(fg)}">${cap.label.replace('&', '&amp;').replace('<', '&lt;')}</text>`)
      x += cap.width + 1
    }
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOARD_COLUMNS * 8} ${BOARD_ROWS * 18}">${parts.join('')}</svg>`
}
