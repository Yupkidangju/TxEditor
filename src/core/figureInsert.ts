import { toCells } from './cells'

export type Cell = { row: number; col: number }

export type TextBuffer = {
  width: number
  height: number
  lines: string[]
}

export type BlockClipboard = {
  width: number
  height: number
  lines: string[]
  origin: Cell
}

function clampInt(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min
  return Math.max(min, Math.min(max, Math.floor(v)))
}

function setChar(line: string, col: number, ch: string, width: number) {
  const cells = toCells(line)
  if (cells.length <= col) {
    for (let i = cells.length; i < col; i += 1) cells.push(' ')
    cells.push(ch)
  } else {
    cells[col] = ch
  }
  return cells.slice(0, width).join('')
}

export function insertBlankFigure(
  base: TextBuffer,
  at: Cell,
  figSize: { width: number; height: number },
  _style: 'ascii' | 'unicode',
  opts?: { maxHeight?: number; maxWidth?: number }
) {
  const maxHeight = opts?.maxHeight ?? 2000
  const maxWidth = opts?.maxWidth ?? 2000
  const figWidth = clampInt(figSize.width, 1, maxWidth)
  const figHeight = clampInt(figSize.height, 1, Math.max(1, maxHeight - base.height))
  const insertRow = clampInt(at.row, 0, base.height)
  const insertCol = clampInt(at.col, 0, base.width)
  const nextHeight = clampInt(base.height + figHeight, 1, maxHeight)
  const nextWidth = clampInt(Math.max(base.width, insertCol + figWidth), 1, maxWidth)

  const lines: string[] = Array.from({ length: nextHeight }, () => '')
  for (let r = 0; r < insertRow && r < base.height; r += 1) lines[r] = base.lines[r] ?? ''
  for (let r = insertRow; r < base.height; r += 1) {
    const dest = r + figHeight
    if (dest >= nextHeight) break
    lines[dest] = base.lines[r] ?? ''
  }

  const cursorAfter = { row: clampInt(insertRow + figHeight, 0, nextHeight - 1), col: insertCol }
  return { buffer: { width: nextWidth, height: nextHeight, lines }, cursorAfter }
}

export function insertFigureFromClipboard(base: TextBuffer, at: Cell, clip: BlockClipboard, opts?: { maxHeight?: number }) {
  const maxHeight = opts?.maxHeight ?? 2000
  const insertRow = clampInt(at.row, 0, base.height)
  const insertCol = clampInt(at.col, 0, base.width)
  const nextHeight = clampInt(base.height + clip.height, 1, maxHeight)
  const nextWidth = clampInt(Math.max(base.width, insertCol + clip.width), 1, 2000)

  const lines: string[] = Array.from({ length: nextHeight }, () => '')
  for (let r = 0; r < insertRow && r < base.height; r += 1) lines[r] = base.lines[r] ?? ''
  for (let r = insertRow; r < base.height; r += 1) {
    const dest = r + clip.height
    if (dest >= nextHeight) break
    lines[dest] = base.lines[r] ?? ''
  }

  for (let r = 0; r < clip.height; r += 1) {
    const rowCells = toCells(clip.lines[r] ?? '')
    let line = lines[insertRow + r] ?? ''
    for (let c = 0; c < clip.width; c += 1) {
      const ch = rowCells[c] ?? ' '
      line = setChar(line, insertCol + c, ch, nextWidth)
    }
    lines[insertRow + r] = line
  }

  const cursorAfter = { row: clampInt(insertRow + clip.height, 0, nextHeight - 1), col: insertCol }
  return { buffer: { width: nextWidth, height: nextHeight, lines }, cursorAfter }
}
