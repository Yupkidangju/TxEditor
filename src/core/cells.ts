const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null

export const CONTINUATION_CELL = '\u0001'
export const TRANSPARENT_CELL = '\u0000'

export type TextBuffer = {
  width: number
  height: number
  lines: string[]
}

export type Layer = {
  id: string
  name: string
  visible: boolean
  locked: boolean
  buffer: TextBuffer
}

function isFullWidthCodePoint(codePoint: number) {
  if (codePoint < 0x1100) return false
  if (codePoint === 0x2329 || codePoint === 0x232a) return true
  if (codePoint >= 0x1100 && codePoint <= 0x115f) return true
  if (codePoint >= 0x2e80 && codePoint <= 0x3247 && codePoint !== 0x303f) return true
  if (codePoint >= 0x3250 && codePoint <= 0x4dbf) return true
  if (codePoint >= 0x4e00 && codePoint <= 0xa4c6) return true
  if (codePoint >= 0xa960 && codePoint <= 0xa97c) return true
  if (codePoint >= 0xac00 && codePoint <= 0xd7a3) return true
  if (codePoint >= 0xf900 && codePoint <= 0xfaff) return true
  if (codePoint >= 0xfe10 && codePoint <= 0xfe19) return true
  if (codePoint >= 0xfe30 && codePoint <= 0xfe6b) return true
  if (codePoint >= 0xff01 && codePoint <= 0xff60) return true
  if (codePoint >= 0xffe0 && codePoint <= 0xffe6) return true
  if (codePoint >= 0x1b000 && codePoint <= 0x1b001) return true
  if (codePoint >= 0x1f200 && codePoint <= 0x1f251) return true
  if (codePoint >= 0x20000 && codePoint <= 0x3fffd) return true
  return false
}

function isWideGrapheme(grapheme: string) {
  if (!grapheme) return false
  if (grapheme === CONTINUATION_CELL) return false
  for (const ch of grapheme) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp === 0x200d) return true
    if (cp === 0xfe0f) return true
    if (cp >= 0x1f300 && cp <= 0x1faff) return true
    if (isFullWidthCodePoint(cp)) return true
  }
  return false
}

export function cellDisplayWidth(grapheme: string) {
  return isWideGrapheme(grapheme) ? 2 : 1
}

export function toCells(text: string) {
  if (!text) return []
  if (!segmenter) return Array.from(text)
  return Array.from(segmenter.segment(text), (s) => s.segment)
}

export function toDisplayText(text: string) {
  if (!text) return ''
  return text.replaceAll(CONTINUATION_CELL, ' ')
}

export function cellLength(text: string) {
  const cells = toCells(text)
  let len = 0
  for (let i = 0; i < cells.length; i += 1) {
    const ch = cells[i] ?? ''
    if (ch === CONTINUATION_CELL) {
      len += 1
      continue
    }
    const w = cellDisplayWidth(ch)
    if (w === 2 && (cells[i + 1] ?? '') === CONTINUATION_CELL) {
      len += 2
      let j = i + 1
      while ((cells[j] ?? '') === CONTINUATION_CELL) j += 1
      i = j - 1
      continue
    }
    len += w
  }
  return len
}

export function sliceCells(text: string, width: number) {
  if (!(width > 0)) return ''
  const cells = toCells(text)
  const out: string[] = []
  let col = 0
  for (let i = 0; i < cells.length; i += 1) {
    const ch = cells[i] ?? ''
    if (!ch) continue
    if (ch === '\n' || ch === '\r') break
    if (ch === CONTINUATION_CELL) {
      if (col + 1 > width) break
      out.push(CONTINUATION_CELL)
      col += 1
      continue
    }
    const w = cellDisplayWidth(ch)
    if (w === 2) {
      if (col + 2 > width) break
      out.push(ch, CONTINUATION_CELL)
      col += 2
      let j = i + 1
      while ((cells[j] ?? '') === CONTINUATION_CELL) j += 1
      i = j - 1
      continue
    }
    if (col + 1 > width) break
    out.push(ch)
    col += 1
  }
  return out.join('')
}

export function cloneLines(lines: string[], height: number) {
  const out: string[] = []
  for (let i = 0; i < height; i += 1) out.push(lines[i] ?? '')
  return out
}

export function setCharInLines(lines: string[], row: number, col: number, ch: string, width: number) {
  if (row < 0 || row >= lines.length) return
  if (col < 0 || col >= width) return
  const src = lines[row] ?? ''
  const cells = toCells(src)
  if (ch !== CONTINUATION_CELL && cellDisplayWidth(ch) === 2) {
    if (col + 1 >= width) ch = ' '
  }
  if (cells.length <= col) {
    for (let i = cells.length; i < col; i += 1) cells.push(' ')
    cells.push(ch)
  } else {
    if (ch !== CONTINUATION_CELL) {
      if (cells[col] === CONTINUATION_CELL) {
        let start = col
        while (start > 0 && (cells[start] ?? '') === CONTINUATION_CELL) start -= 1
        cells[start] = ' '
        for (let i = start + 1; i < cells.length; i += 1) {
          if ((cells[i] ?? '') !== CONTINUATION_CELL) break
          cells[i] = ' '
        }
      } else {
        for (let i = col + 1; i < cells.length; i += 1) {
          if ((cells[i] ?? '') !== CONTINUATION_CELL) break
          cells[i] = ' '
        }
      }
    }
    cells[col] = ch
  }
  if (ch !== CONTINUATION_CELL && cellDisplayWidth(ch) === 2 && col + 1 < width) {
    if (cells.length <= col + 1) {
      for (let i = cells.length; i <= col + 1; i += 1) cells.push(' ')
    }
    if ((cells[col + 1] ?? '') === CONTINUATION_CELL) {
      let start = col + 1
      while (start > 0 && (cells[start] ?? '') === CONTINUATION_CELL) start -= 1
      cells[start] = ' '
      for (let i = start + 1; i < cells.length; i += 1) {
        if ((cells[i] ?? '') !== CONTINUATION_CELL) break
        cells[i] = ' '
      }
    } else {
      for (let i = col + 2; i < cells.length; i += 1) {
        if ((cells[i] ?? '') !== CONTINUATION_CELL) break
        cells[i] = ' '
      }
    }
    cells[col + 1] = CONTINUATION_CELL
    for (let i = col + 2; i < cells.length; i += 1) {
      if ((cells[i] ?? '') !== CONTINUATION_CELL) break
      cells[i] = ' '
    }
  }
  lines[row] = cells.slice(0, width).join('')
}

export function padCells(text: string, width: number) {
  const len = cellLength(text)
  if (len >= width) return text
  return text + ' '.repeat(width - len)
}

export function getCellAt(text: string, index: number) {
  if (!(index >= 0)) return ' '
  const cells = toCells(text)
  let col = 0
  for (let i = 0; i < cells.length; i += 1) {
    const ch = cells[i] ?? ''
    if (!ch) continue
    if (ch === CONTINUATION_CELL) {
      if (col === index) return CONTINUATION_CELL
      col += 1
      continue
    }
    const w = cellDisplayWidth(ch)
    if (w === 2) {
      if (col === index) return ch
      if (col + 1 === index) return CONTINUATION_CELL
      col += 2
      let j = i + 1
      while ((cells[j] ?? '') === CONTINUATION_CELL) j += 1
      i = j - 1
      continue
    }
    if (col === index) return ch
    col += 1
  }
  return ' '
}

export function toInternalText(text: string) {
  if (!text) return ''
  const cells = toCells(text.replace(/\r\n/g, '\n'))
  const out: string[] = []
  for (const ch of cells) {
    if (ch === '\r') continue
    if (ch === '\n') {
      out.push('\n')
      continue
    }
    if (ch === CONTINUATION_CELL) {
      out.push(CONTINUATION_CELL)
      continue
    }
    out.push(ch)
    if (cellDisplayWidth(ch) === 2) out.push(CONTINUATION_CELL)
  }
  return out.join('')
}
