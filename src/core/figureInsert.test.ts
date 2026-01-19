import { describe, expect, it } from 'vitest'

import { insertBlankFigure, insertFigureFromClipboard } from './figureInsert'

describe('insertBlankFigure', () => {
  it('inserts rows and shifts content down', () => {
    const base = { width: 10, height: 3, lines: ['aaa', 'bbb', 'ccc'] }
    const { buffer } = insertBlankFigure(base, { row: 1, col: 2 }, { width: 4, height: 2 }, 'ascii')
    expect(buffer.height).toBe(5)
    expect(buffer.width).toBe(10)
    expect(buffer.lines[0]).toBe('aaa')
    expect(buffer.lines[3]).toBe('bbb')
    expect(buffer.lines[4]).toBe('ccc')
    expect(buffer.lines[1]).toBe('  ')
    expect(buffer.lines[2]).toBe('  ')
  })

  it('clamps insert column so the figure fits in width', () => {
    const base = { width: 6, height: 1, lines: ['hello'] }
    const { buffer } = insertBlankFigure(base, { row: 0, col: 100 }, { width: 4, height: 1 }, 'ascii')
    expect(buffer.lines[0]).toBe('      ') // Clamped to width? No, insertCol is clamped to base.width(6).
    // insertCol = 6.
    // figWidth = 4.
    // nextWidth = max(6, 6+4) = 10.
    // padding = ' '.repeat(6) = '      '
    // lines[0] = padding
    expect(buffer.lines[0].length).toBe(6)
    expect(buffer.lines[1]).toBe('hello')
  })

  it('accepts style without drawing any shape', () => {
    const base = { width: 6, height: 1, lines: [''] }
    const { buffer } = insertBlankFigure(base, { row: 0, col: 0 }, { width: 4, height: 1 }, 'unicode')
    expect(buffer.lines[0]).toBe('') // 0 padding + blank
  })

  it('expands buffer width to fit inserted width at cursor col', () => {
    const base = { width: 80, height: 1, lines: ['x'] }
    const { buffer } = insertBlankFigure(base, { row: 0, col: 10 }, { width: 80, height: 1 }, 'ascii')
    expect(buffer.width).toBe(90)
    expect(buffer.height).toBe(2)
    expect(buffer.lines[1]).toBe('x')
  })
})

describe('insertFigureFromClipboard', () => {
  it('inserts clipboard content and shifts existing lines down', () => {
    const base = { width: 5, height: 2, lines: ['aaaaa', 'bbbbb'] }
    const clip = { width: 3, height: 1, lines: ['CCC'], origin: { row: 0, col: 0 } }
    const { buffer } = insertFigureFromClipboard(base, { row: 1, col: 1 }, clip)
    
    expect(buffer.height).toBe(3)
    // Row 0: aaaaa (unchanged)
    expect(buffer.lines[0]).toBe('aaaaa')
    // Row 1: Inserted ' CCC' (1 space padding + CCC)
    expect(buffer.lines[1]).toBe(' CCC')
    // Row 2: bbbbb (shifted down)
    expect(buffer.lines[2]).toBe('bbbbb')
  })

  it('handles wide characters correctly', () => {
    const base = { width: 10, height: 1, lines: ['start'] }
    // '한글' takes 2 cells each (internal 2 chars if including CONT, but here clip.lines is string)
    // toCells('한글') -> ['한', CONT, '글', CONT]
    // width should be 4
    const clip = { width: 4, height: 1, lines: ['한글'], origin: { row: 0, col: 0 } }
    
    const { buffer } = insertFigureFromClipboard(base, { row: 0, col: 0 }, clip)
    
    expect(buffer.lines[0]).toBe('한글')
    expect(buffer.lines[1]).toBe('start')
  })

  it('pads with spaces if inserted at offset', () => {
    const base = { width: 10, height: 1, lines: ['line1'] }
    const clip = { width: 2, height: 1, lines: ['AB'], origin: { row: 0, col: 0 } }
    
    const { buffer } = insertFigureFromClipboard(base, { row: 0, col: 3 }, clip)
    
    // 3 spaces padding + AB
    expect(buffer.lines[0]).toBe('   AB')
  })

  it('truncates content if it exceeds max width (2000)', () => {
    const base = { width: 10, height: 1, lines: ['line1'] }
    const longLine = 'A'.repeat(3000)
    const clip = { width: 3000, height: 1, lines: [longLine], origin: { row: 0, col: 0 } }
    
    const { buffer } = insertFigureFromClipboard(base, { row: 0, col: 0 }, clip)
    
    expect(buffer.width).toBe(2000)
    expect(buffer.lines[0].length).toBe(2000) // Assuming ASCII 1 byte
  })
})
