import { describe, expect, it } from 'vitest'

import { insertBlankFigure } from './figureInsert'

describe('insertBlankFigure', () => {
  it('inserts rows and shifts content down', () => {
    const base = { width: 10, height: 3, lines: ['aaa', 'bbb', 'ccc'] }
    const { buffer } = insertBlankFigure(base, { row: 1, col: 2 }, { width: 4, height: 2 }, 'ascii')
    expect(buffer.height).toBe(5)
    expect(buffer.width).toBe(10)
    expect(buffer.lines[0]).toBe('aaa')
    expect(buffer.lines[3]).toBe('bbb')
    expect(buffer.lines[4]).toBe('ccc')
    expect(buffer.lines[1]).toBe('')
    expect(buffer.lines[2]).toBe('')
  })

  it('clamps insert column so the figure fits in width', () => {
    const base = { width: 6, height: 1, lines: ['hello'] }
    const { buffer } = insertBlankFigure(base, { row: 0, col: 100 }, { width: 4, height: 1 }, 'ascii')
    expect(buffer.lines[0]).toBe('')
    expect(buffer.lines[1]).toBe('hello')
  })

  it('accepts style without drawing any shape', () => {
    const base = { width: 6, height: 1, lines: [''] }
    const { buffer } = insertBlankFigure(base, { row: 0, col: 0 }, { width: 4, height: 1 }, 'unicode')
    expect(buffer.lines[0]).toBe('')
  })

  it('expands buffer width to fit inserted width at cursor col', () => {
    const base = { width: 80, height: 1, lines: ['x'] }
    const { buffer } = insertBlankFigure(base, { row: 0, col: 10 }, { width: 80, height: 1 }, 'ascii')
    expect(buffer.width).toBe(90)
    expect(buffer.height).toBe(2)
    expect(buffer.lines[1]).toBe('x')
  })
})
