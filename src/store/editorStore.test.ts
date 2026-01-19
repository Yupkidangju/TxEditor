import { beforeEach, describe, expect, it } from 'vitest'

import { CONTINUATION_CELL } from '../core/cells'
import { bufferToText, useEditorStore } from './editorStore'

function emptyBuffer(width: number, height: number) {
  return { width, height, lines: Array.from({ length: height }, () => '') }
}

function withMark(width: number, height: number, mark: string) {
  const lines = Array.from({ length: height }, () => '')
  lines[0] = mark
  return { width, height, lines }
}

describe('editorStore history limits', () => {
  beforeEach(() => {
    useEditorStore.setState({ buffer: emptyBuffer(80, 24), cursor: null, past: [], future: [] })
  })

  it('caps history for small buffers', () => {
    const { commitBuffer } = useEditorStore.getState()
    for (let i = 0; i < 260; i += 1) {
      commitBuffer(withMark(80, 24, String(i)))
    }
    const { past } = useEditorStore.getState()
    expect(past.length).toBeLessThanOrEqual(200)
  })

  it('caps history more aggressively for huge buffers', () => {
    useEditorStore.setState({ buffer: emptyBuffer(2000, 2000), cursor: null, past: [], future: [] })
    const { commitBuffer } = useEditorStore.getState()
    for (let i = 0; i < 80; i += 1) {
      commitBuffer(withMark(2000, 2000, String(i)))
    }
    const { past } = useEditorStore.getState()
    expect(past.length).toBeLessThanOrEqual(20)
  })
})

describe('editorStore unicode cells', () => {
  beforeEach(() => {
    useEditorStore.setState({ buffer: emptyBuffer(1, 1), cursor: null, past: [], future: [] })
  })

  it('slices text by codepoints, not UTF-16 units', () => {
    useEditorStore.setState({ buffer: emptyBuffer(2, 1), cursor: null, past: [], future: [] })
    useEditorStore.getState().setBufferFromText('😀a')
    const { buffer } = useEditorStore.getState()
    expect(buffer.width).toBe(2)
    expect(buffer.height).toBe(1)
    expect(buffer.lines[0]).toBe(`😀${CONTINUATION_CELL}`)
  })

  it('auto-sizes width by codepoints', () => {
    useEditorStore.setState({ buffer: emptyBuffer(80, 24), cursor: null, past: [], future: [] })
    useEditorStore.getState().loadBufferFromTextAutoSize('😀a')
    const { buffer } = useEditorStore.getState()
    expect(buffer.width).toBe(3)
  })

  it('handles Hangul graphemes as one cell', () => {
    useEditorStore.setState({ buffer: emptyBuffer(2, 1), cursor: null, past: [], future: [] })
    useEditorStore.getState().setBufferFromText('가a')
    const { buffer } = useEditorStore.getState()
    expect(buffer.lines[0]).toBe(`가${CONTINUATION_CELL}`)
  })

  it('auto-sizes width for Hangul and ASCII graphemes', () => {
    useEditorStore.setState({ buffer: emptyBuffer(80, 24), cursor: null, past: [], future: [] })
    useEditorStore.getState().loadBufferFromTextAutoSize('가a')
    const { buffer } = useEditorStore.getState()
    expect(buffer.width).toBe(3)
  })

  it('treats ZWJ emoji sequences as one cell when possible', () => {
    useEditorStore.setState({ buffer: emptyBuffer(2, 1), cursor: null, past: [], future: [] })
    useEditorStore.getState().setBufferFromText('👩‍💻a')
    const { buffer } = useEditorStore.getState()
    expect(buffer.lines[0]).toBe(`👩‍💻${CONTINUATION_CELL}`)
  })

  it('treats combining marks as one cell when possible', () => {
    useEditorStore.setState({ buffer: emptyBuffer(1, 1), cursor: null, past: [], future: [] })
    useEditorStore.getState().setBufferFromText('e\u0301a')
    const { buffer } = useEditorStore.getState()
    expect(buffer.lines[0]).toBe('e\u0301')
  })
})

describe('bufferToText space padding', () => {
  it('pads each line to buffer width when enabled', () => {
    const buffer = { width: 4, height: 2, lines: ['a', ''] }
    expect(bufferToText(buffer, { padRight: true })).toBe('a   \n    ')
  })

  it('does not pad when disabled', () => {
    const buffer = { width: 4, height: 2, lines: ['a', ''] }
    expect(bufferToText(buffer, { padRight: false })).toBe('a\n')
  })
})
