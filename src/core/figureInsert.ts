import { toCells, cellDisplayWidth, CONTINUATION_CELL } from './cells'

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

// [Deleted] setChar removed to prevent O(N*M) overhead
// Use batch processing instead.

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

  // Blank figure means empty lines at insertRow ... insertRow + figHeight
  // But we might need to pad left with spaces if insertCol > 0
  if (insertCol > 0) {
    const padding = ' '.repeat(insertCol)
    for (let r = 0; r < figHeight; r += 1) {
      lines[insertRow + r] = padding
    }
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

  // 1. Construct new lines array with shifted content
  const lines: string[] = Array.from({ length: nextHeight }, () => '')
  
  // Copy top part
  for (let r = 0; r < insertRow && r < base.height; r += 1) {
    lines[r] = base.lines[r] ?? ''
  }
  
  // Shift bottom part
  for (let r = insertRow; r < base.height; r += 1) {
    const dest = r + clip.height
    if (dest >= nextHeight) break
    lines[dest] = base.lines[r] ?? ''
  }

  // 2. Batch Process: Fill the inserted gap with clipboard content
  // Complexity: O(clip.height * (insertCol + clip.width)) -> Linear per line
  // No repeated toCells() calls for the target line (since it's empty)
  
  // Pre-calculate left padding
  const leftPadding: string[] = []
  for (let i = 0; i < insertCol; i++) leftPadding.push(' ')

  for (let r = 0; r < clip.height; r += 1) {
    const targetRowIdx = insertRow + r
    // Although lines are allocated, we might exceed nextHeight if logic is wrong, but loop is bounded by clip.height
    if (targetRowIdx >= nextHeight) break

    const clipLineStr = clip.lines[r] ?? ''
    const clipCells = toCells(clipLineStr)
    
    // Construct the new line: [Padding] + [ClipCells]
    const newLineCells: string[] = [...leftPadding]
    
    let currentClipWidth = 0
    for (const cell of clipCells) {
      const w = cellDisplayWidth(cell)
      if (currentClipWidth + w > clip.width) break
      newLineCells.push(cell)
      currentClipWidth += w
    }

    // Pad remaining width with spaces if clip line is shorter than clip.width
    while (currentClipWidth < clip.width) {
      newLineCells.push(' ')
      currentClipWidth += 1
    }

    if (newLineCells.length > nextWidth) {
      // Truncate
      const truncated = newLineCells.slice(0, nextWidth)
      
      // Integrity check for the last cell
      const lastIdx = truncated.length - 1
      if (lastIdx >= 0) {
        const lastChar = truncated[lastIdx]
        // If we cut off the tail of a wide char
        if (cellDisplayWidth(lastChar) === 2) {
          // The next char (which was cut) should have been CONT.
          // Since it's gone, this wide char is now broken/incomplete at the edge.
          // Option A: Replace with space
          // Option B: Keep it (browser might render weirdly or just clip)
          // To be safe and strict: replace with space
          truncated[lastIdx] = ' '
        }
      }
      lines[targetRowIdx] = truncated.join('')
    } else {
      lines[targetRowIdx] = newLineCells.join('')
    }
  }

  const cursorAfter = { row: clampInt(insertRow + clip.height, 0, nextHeight - 1), col: insertCol }
  return { buffer: { width: nextWidth, height: nextHeight, lines }, cursorAfter }
}
