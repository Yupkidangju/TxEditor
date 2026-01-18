import { create } from 'zustand'

import { cellLength, padCells, sliceCells, toDisplayText } from '../core/cells'

export type TextBuffer = {
  width: number
  height: number
  lines: string[]
}

export type Cursor = { row: number; col: number } | null

type HistoryEntry = TextBuffer

export type EditorState = {
  buffer: TextBuffer
  cursor: Cursor
  past: HistoryEntry[]
  future: HistoryEntry[]
  setCursor: (cursor: Cursor) => void
  newBuffer: (width: number, height: number) => void
  setBufferFromText: (text: string) => void
  loadBufferFromTextAutoSize: (text: string) => void
  commitBuffer: (next: TextBuffer) => void
  undo: () => void
  redo: () => void
}

function clampInt(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min
  return Math.max(min, Math.min(max, Math.floor(v)))
}

function normalizeTextToBuffer(text: string, width: number, height: number): TextBuffer {
  const normalized = text.replace(/\r\n/g, '\n')
  const rawLines = normalized.split('\n')

  const lines: string[] = []
  for (let i = 0; i < height; i += 1) {
    const src = rawLines[i] ?? ''
    lines.push(sliceCells(src, width))
  }

  return { width, height, lines }
}

export function bufferToText(buffer: TextBuffer, opts?: { padRight?: boolean }) {
  const padRight = opts?.padRight ?? false
  const out: string[] = []
  for (let i = 0; i < buffer.height; i += 1) {
    const line = toDisplayText(buffer.lines[i] ?? '')
    out.push(padRight ? padCells(line, buffer.width) : line)
  }
  return out.join('\n')
}

function cloneBuffer(b: TextBuffer): TextBuffer {
  return { width: b.width, height: b.height, lines: [...b.lines] }
}

function historyLimitForSize(width: number, height: number) {
  const cells = width * height
  if (cells <= 100 * 100) return 200
  if (cells <= 300 * 300) return 100
  if (cells <= 1000 * 1000) return 50
  return 20
}

function appendPast(past: HistoryEntry[], current: TextBuffer, limit: number) {
  const next = [...past, cloneBuffer(current)]
  if (next.length <= limit) return next
  return next.slice(next.length - limit)
}

function prependFuture(future: HistoryEntry[], current: TextBuffer, limit: number) {
  const next = [cloneBuffer(current), ...future]
  if (next.length <= limit) return next
  return next.slice(0, limit)
}

export const useEditorStore = create<EditorState>((set, get) => ({
  buffer: { width: 80, height: 24, lines: Array.from({ length: 24 }, () => '') },
  cursor: null,
  past: [],
  future: [],
  setCursor: (cursor) => set({ cursor }),
  newBuffer: (width, height) => {
    const w = clampInt(width, 1, 2000)
    const h = clampInt(height, 1, 2000)
    const next: TextBuffer = { width: w, height: h, lines: Array.from({ length: h }, () => '') }
    set((s) => {
      const limit = Math.min(historyLimitForSize(s.buffer.width, s.buffer.height), historyLimitForSize(next.width, next.height))
      return { ...s, past: appendPast(s.past, s.buffer, limit), future: [], buffer: next, cursor: null }
    })
  },
  setBufferFromText: (text) => {
    const { buffer } = get()
    const next = normalizeTextToBuffer(text, buffer.width, buffer.height)
    set((s) => {
      const limit = historyLimitForSize(s.buffer.width, s.buffer.height)
      return { ...s, past: appendPast(s.past, s.buffer, limit), future: [], buffer: next }
    })
  },
  loadBufferFromTextAutoSize: (text) => {
    const normalized = text.replace(/\r\n/g, '\n')
    const rawLines = normalized.split('\n')
    const height = clampInt(rawLines.length || 1, 1, 2000)
    const width = clampInt(rawLines.reduce((m, line) => Math.max(m, cellLength(line)), 0) || 1, 1, 2000)
    const next = normalizeTextToBuffer(normalized, width, height)
    set((s) => {
      const limit = Math.min(historyLimitForSize(s.buffer.width, s.buffer.height), historyLimitForSize(next.width, next.height))
      return { ...s, past: appendPast(s.past, s.buffer, limit), future: [], buffer: next, cursor: null }
    })
  },
  commitBuffer: (next) =>
    set((s) => {
      const limit = Math.min(historyLimitForSize(s.buffer.width, s.buffer.height), historyLimitForSize(next.width, next.height))
      return { ...s, past: appendPast(s.past, s.buffer, limit), future: [], buffer: next, cursor: null }
    }),
  undo: () =>
    set((s) => {
      const last = s.past[s.past.length - 1]
      if (!last) return s
      const limit = historyLimitForSize(s.buffer.width, s.buffer.height)
      return {
        ...s,
        past: s.past.slice(0, -1),
        future: prependFuture(s.future, s.buffer, limit),
        buffer: cloneBuffer(last)
      }
    }),
  redo: () =>
    set((s) => {
      const next = s.future[0]
      if (!next) return s
      const limit = historyLimitForSize(s.buffer.width, s.buffer.height)
      return {
        ...s,
        past: appendPast(s.past, s.buffer, limit),
        future: s.future.slice(1),
        buffer: cloneBuffer(next)
      }
    })
}))
