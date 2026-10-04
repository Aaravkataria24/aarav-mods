import { describe, expect, test } from 'claude-code/testing'

import { BOARD_COLUMNS, BOARD_ROWS, SWITCHES, boardCells, boardSvg, isSwitch, keyFor, keyForEdit } from './keys'

describe('keyFor', () => {
  test('letters use their keyboard row recording', () => {
    expect(keyFor('q')).toEqual({ sound: 'GENERIC_R1', board: 'q' })
    expect(keyFor('A')).toEqual({ sound: 'GENERIC_R2', board: 'a' })
    expect(keyFor('m')).toEqual({ sound: 'GENERIC_R3', board: 'm' })
    expect(keyFor('7')).toEqual({ sound: 'GENERIC_R0', board: '7' })
  })

  test('space, enter and shifted symbols', () => {
    expect(keyFor(' ')).toEqual({ sound: 'SPACE', board: 'space' })
    expect(keyFor('\n')).toEqual({ sound: 'ENTER', board: 'enter' })
    expect(keyFor('!').board).toBe('1')
  })
})

describe('keyForEdit', () => {
  test('prompt-box key names', () => {
    expect(keyForEdit('space').sound).toBe('SPACE')
    expect(keyForEdit('backspace')).toEqual({ sound: 'BACKSPACE', board: 'backspace' })
    expect(keyForEdit('return').board).toBe('enter')
    expect(keyForEdit('k').board).toBe('k')
  })
})

describe('board', () => {
  test('cells cover the whole board', () => {
    const bytes = atob(boardCells({})).length
    expect(bytes).toBe(BOARD_COLUMNS * BOARD_ROWS * 3 * 4)
  })

  test('a lit key changes the drawing', () => {
    expect(boardCells({ q: 'you' })).not.toBe(boardCells({}))
    expect(boardCells({ q: 'claude' })).not.toBe(boardCells({ q: 'you' }))
    expect(boardSvg({ space: 'claude' })).toContain('#d97757')
  })

  test('every switch has a name', () => {
    expect(isSwitch('holypanda')).toBe(true)
    expect(isSwitch('nope')).toBe(false)
    expect(Object.keys(SWITCHES).length).toBe(13)
  })
})
