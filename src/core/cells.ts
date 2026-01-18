const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null

export const CONTINUATION_CELL = '\u0001'

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
  return toCells(text).length
}

export function sliceCells(text: string, width: number) {
  const cells = toCells(text)
  if (cells.length <= width) return text
  return cells.slice(0, width).join('')
}

export function padCells(text: string, width: number) {
  const len = cellLength(text)
  if (len >= width) return text
  return text + ' '.repeat(width - len)
}

export function getCellAt(text: string, index: number) {
  return toCells(text)[index] ?? ' '
}
