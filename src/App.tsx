import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { bufferToText, useEditorStore } from './store/editorStore'
import { CONTINUATION_CELL, cellLength, getCellAt, toCells, toDisplayText } from './core/cells'

type BufferTemplate = '80x24' | '120x80' | '160x100'

const TEMPLATES: Array<{ id: BufferTemplate; width: number; height: number; label: string }> = [
  { id: '80x24', width: 80, height: 24, label: '80×24' },
  { id: '120x80', width: 120, height: 80, label: '120×80' },
  { id: '160x100', width: 160, height: 100, label: '160×100' }
]

type ExportNewline = 'lf' | 'crlf'

type Language = 'ko' | 'en' | 'ja' | 'zh-Hant' | 'zh-Hans'

type TextKey =
  | 'menuFile'
  | 'menuEdit'
  | 'menuHelp'
  | 'settings'
  | 'language'
  | 'open'
  | 'loadError'
  | 'find'
  | 'replace'
  | 'findNext'
  | 'findPrev'
  | 'replaceNext'
  | 'replacePrev'
  | 'replaceAll'
  | 'search'
  | 'replaceWith'
  | 'tools'
  | 'toolText'
  | 'toolSelect'
  | 'toolRect'
  | 'toolLine'
  | 'toolArrow'
  | 'toolFree'
  | 'drawChar'
  | 'style'
  | 'styleAscii'
  | 'styleUnicode'
  | 'selection'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'delete'
  | 'new'
  | 'save'
  | 'undo'
  | 'redo'
  | 'newBuffer'
  | 'close'
  | 'custom'
  | 'width'
  | 'height'
  | 'create'
  | 'file'
  | 'newline'
  | 'crlfWindows'
  | 'padRightOnSave'
  | 'ctrlCmdS'
  | 'ln'
  | 'col'
  | 'buffer'

const LANGUAGE_LABELS: Record<Language, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  'zh-Hant': '中文（繁體）',
  'zh-Hans': '中文（简体）'
}

const TEXT: Record<Language, Record<TextKey, string>> = {
  ko: {
    menuFile: '파일',
    menuEdit: '편집',
    menuHelp: '도움말',
    settings: '설정',
    language: '언어',
    open: '열기',
    loadError: '파일을 불러오지 못했습니다.',
    find: '찾기',
    replace: '바꾸기',
    findNext: '다음 찾기',
    findPrev: '이전 찾기',
    replaceNext: '다음 바꾸기',
    replacePrev: '이전 바꾸기',
    replaceAll: '모두 바꾸기',
    search: '찾을 내용',
    replaceWith: '바꿀 내용',
    tools: '도구',
    toolText: '텍스트',
    toolSelect: '선택',
    toolRect: '사각형',
    toolLine: '직각선',
    toolArrow: '화살표',
    toolFree: '프리폼',
    drawChar: '그리기 문자',
    style: '스타일',
    styleAscii: 'ASCII',
    styleUnicode: '유니코드',
    selection: '선택',
    copy: '복사',
    cut: '잘라내기',
    paste: '붙여넣기',
    delete: '삭제',
    new: '새로 만들기',
    save: '저장',
    undo: '되돌리기',
    redo: '다시 실행',
    newBuffer: '새 버퍼',
    close: '닫기',
    custom: '커스텀',
    width: '가로',
    height: '세로',
    create: '생성',
    file: '파일',
    newline: '개행',
    crlfWindows: 'CRLF(Windows)',
    padRightOnSave: '저장 시 우측 공백 채우기',
    ctrlCmdS: 'Ctrl/Cmd+S',
    ln: '행',
    col: '열',
    buffer: '버퍼'
  },
  en: {
    menuFile: 'File',
    menuEdit: 'Edit',
    menuHelp: 'Help',
    settings: 'Settings',
    language: 'Language',
    open: 'Open',
    loadError: 'Failed to load file.',
    find: 'Find',
    replace: 'Replace',
    findNext: 'Find next',
    findPrev: 'Find previous',
    replaceNext: 'Replace next',
    replacePrev: 'Replace previous',
    replaceAll: 'Replace all',
    search: 'Find',
    replaceWith: 'Replace with',
    tools: 'Tools',
    toolText: 'Text',
    toolSelect: 'Select',
    toolRect: 'Rectangle',
    toolLine: 'Ortholine',
    toolArrow: 'Arrow',
    toolFree: 'Freeform',
    drawChar: 'Draw char',
    style: 'Style',
    styleAscii: 'ASCII',
    styleUnicode: 'Unicode',
    selection: 'Selection',
    copy: 'Copy',
    cut: 'Cut',
    paste: 'Paste',
    delete: 'Delete',
    new: 'New',
    save: 'Save',
    undo: 'Undo',
    redo: 'Redo',
    newBuffer: 'New Buffer',
    close: 'Close',
    custom: 'Custom',
    width: 'Width',
    height: 'Height',
    create: 'Create',
    file: 'File',
    newline: 'Newline',
    crlfWindows: 'CRLF (Windows)',
    padRightOnSave: 'Pad right spaces on save',
    ctrlCmdS: 'Ctrl/Cmd+S',
    ln: 'Ln',
    col: 'Col',
    buffer: 'Buffer'
  },
  ja: {
    menuFile: 'ファイル',
    menuEdit: '編集',
    menuHelp: 'ヘルプ',
    settings: '設定',
    language: '言語',
    open: '開く',
    loadError: 'ファイルを読み込めませんでした。',
    find: '検索',
    replace: '置換',
    findNext: '次を検索',
    findPrev: '前を検索',
    replaceNext: '次を置換',
    replacePrev: '前を置換',
    replaceAll: 'すべて置換',
    search: '検索',
    replaceWith: '置換後',
    tools: 'ツール',
    toolText: 'テキスト',
    toolSelect: '選択',
    toolRect: '四角形',
    toolLine: '直角線',
    toolArrow: '矢印',
    toolFree: 'フリーフォーム',
    drawChar: '描画文字',
    style: 'スタイル',
    styleAscii: 'ASCII',
    styleUnicode: 'Unicode',
    selection: '選択',
    copy: 'コピー',
    cut: '切り取り',
    paste: '貼り付け',
    delete: '削除',
    new: '新規',
    save: '保存',
    undo: '元に戻す',
    redo: 'やり直し',
    newBuffer: '新規バッファ',
    close: '閉じる',
    custom: 'カスタム',
    width: '幅',
    height: '高さ',
    create: '作成',
    file: 'ファイル',
    newline: '改行',
    crlfWindows: 'CRLF(Windows)',
    padRightOnSave: '保存時に右側の空白を埋める',
    ctrlCmdS: 'Ctrl/Cmd+S',
    ln: '行',
    col: '列',
    buffer: 'バッファ'
  },
  'zh-Hant': {
    menuFile: '檔案',
    menuEdit: '編輯',
    menuHelp: '說明',
    settings: '設定',
    language: '語言',
    open: '開啟',
    loadError: '無法載入檔案。',
    find: '尋找',
    replace: '取代',
    findNext: '尋找下一個',
    findPrev: '尋找上一個',
    replaceNext: '取代下一個',
    replacePrev: '取代上一個',
    replaceAll: '全部取代',
    search: '尋找',
    replaceWith: '取代為',
    tools: '工具',
    toolText: '文字',
    toolSelect: '選取',
    toolRect: '矩形',
    toolLine: '直角線',
    toolArrow: '箭頭',
    toolFree: '自由繪製',
    drawChar: '繪製字元',
    style: '樣式',
    styleAscii: 'ASCII',
    styleUnicode: 'Unicode',
    selection: '選取',
    copy: '複製',
    cut: '剪下',
    paste: '貼上',
    delete: '刪除',
    new: '新增',
    save: '儲存',
    undo: '復原',
    redo: '重做',
    newBuffer: '新增緩衝區',
    close: '關閉',
    custom: '自訂',
    width: '寬',
    height: '高',
    create: '建立',
    file: '檔案',
    newline: '換行',
    crlfWindows: 'CRLF(Windows)',
    padRightOnSave: '儲存時補齊右側空白',
    ctrlCmdS: 'Ctrl/Cmd+S',
    ln: '行',
    col: '列',
    buffer: '緩衝區'
  },
  'zh-Hans': {
    menuFile: '文件',
    menuEdit: '编辑',
    menuHelp: '帮助',
    settings: '设置',
    language: '语言',
    open: '打开',
    loadError: '无法加载文件。',
    find: '查找',
    replace: '替换',
    findNext: '查找下一个',
    findPrev: '查找上一个',
    replaceNext: '替换下一个',
    replacePrev: '替换上一个',
    replaceAll: '全部替换',
    search: '查找',
    replaceWith: '替换为',
    tools: '工具',
    toolText: '文本',
    toolSelect: '选择',
    toolRect: '矩形',
    toolLine: '直角线',
    toolArrow: '箭头',
    toolFree: '自由绘制',
    drawChar: '绘制字符',
    style: '样式',
    styleAscii: 'ASCII',
    styleUnicode: 'Unicode',
    selection: '选择',
    copy: '复制',
    cut: '剪切',
    paste: '粘贴',
    delete: '删除',
    new: '新建',
    save: '保存',
    undo: '撤销',
    redo: '重做',
    newBuffer: '新建缓冲区',
    close: '关闭',
    custom: '自定义',
    width: '宽',
    height: '高',
    create: '创建',
    file: '文件',
    newline: '换行',
    crlfWindows: 'CRLF(Windows)',
    padRightOnSave: '保存时补齐右侧空格',
    ctrlCmdS: 'Ctrl/Cmd+S',
    ln: '行',
    col: '列',
    buffer: '缓冲区'
  }
}

function normalizeNewlines(text: string, mode: ExportNewline) {
  const lf = text.replace(/\r\n/g, '\n')
  return mode === 'crlf' ? lf.replace(/\n/g, '\r\n') : lf
}

function clampInt(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min
  return Math.max(min, Math.min(max, Math.floor(v)))
}

type ToolMode = 'text' | 'select' | 'rect' | 'line' | 'arrow' | 'free'

type Cell = { row: number; col: number }

type TextMetrics = { charWidth: number; lineHeight: number; paddingLeft: number; paddingTop: number }

type Rect = { top: number; left: number; bottom: number; right: number }

type BlockClipboard = { width: number; height: number; lines: string[] } | null

type DrawStyle = 'ascii' | 'unicode'

function styleChars(style: DrawStyle) {
  if (style === 'unicode') {
    return {
      h: '─',
      v: '│',
      tl: '┌',
      tr: '┐',
      bl: '└',
      br: '┘',
      arrow: { left: '←', right: '→', up: '↑', down: '↓' } as const,
      elbow: (from: Cell, to: Cell) => {
        const fromLeft = to.col > from.col
        const down = to.row > from.row
        if (fromLeft && down) return '┐'
        if (fromLeft && !down) return '┘'
        if (!fromLeft && down) return '┌'
        return '└'
      }
    } as const
  }
  return {
    h: '-',
    v: '|',
    tl: '+',
    tr: '+',
    bl: '+',
    br: '+',
    arrow: { left: '<', right: '>', up: '^', down: 'v' } as const,
    elbow: () => '+'
  } as const
}

function normalizeRect(a: Cell, b: Cell): Rect {
  const top = Math.min(a.row, b.row)
  const bottom = Math.max(a.row, b.row)
  const left = Math.min(a.col, b.col)
  const right = Math.max(a.col, b.col)
  return { top, left, bottom, right }
}

function rectSize(rect: Rect) {
  const width = rect.right - rect.left + 1
  const height = rect.bottom - rect.top + 1
  return { width, height }
}

function getCharAt(lines: string[], row: number, col: number) {
  const line = lines[row] ?? ''
  const ch = getCellAt(line, col)
  return ch === CONTINUATION_CELL ? ' ' : ch
}

function copyRectFromBuffer(base: { width: number; height: number; lines: string[] }, rect: Rect): BlockClipboard {
  const { width, height } = rectSize(rect)
  if (width <= 0 || height <= 0) return null
  const out: string[] = []
  for (let r = rect.top; r <= rect.bottom; r += 1) {
    let s = ''
    for (let c = rect.left; c <= rect.right; c += 1) s += getCharAt(base.lines, r, c)
    out.push(s)
  }
  return { width, height, lines: out }
}

function applyRectFill(base: { width: number; height: number; lines: string[] }, rect: Rect, fillChar: string) {
  const lines = cloneLines(base.lines, base.height)
  for (let r = rect.top; r <= rect.bottom; r += 1) {
    for (let c = rect.left; c <= rect.right; c += 1) setCharInLines(lines, r, c, fillChar, base.width)
  }
  return { ...base, lines }
}

function pasteRectIntoBuffer(base: { width: number; height: number; lines: string[] }, at: Cell, clip: BlockClipboard) {
  if (!clip) return base
  const lines = cloneLines(base.lines, base.height)
  for (let r = 0; r < clip.height; r += 1) {
    const rowCells = toCells(clip.lines[r] ?? '')
    for (let c = 0; c < clip.width; c += 1) {
      const row = at.row + r
      const col = at.col + c
      if (row < 0 || row >= base.height) continue
      if (col < 0 || col >= base.width) continue
      const ch = rowCells[c] ?? ' '
      setCharInLines(lines, row, col, ch, base.width)
    }
  }
  return { ...base, lines }
}

function parsePx(px: string) {
  const v = Number.parseFloat(px)
  return Number.isFinite(v) ? v : 0
}

function chooseEditorFontFamily(textarea: HTMLTextAreaElement) {
  if (navigator.userAgent.includes('jsdom')) return null
  const cs = window.getComputedStyle(textarea)
  const canvas = document.createElement('canvas')
  let ctx: CanvasRenderingContext2D | null = null
  try {
    ctx = canvas.getContext('2d')
  } catch {
    return null
  }
  if (!ctx) return null
  const fontPrefix = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize}`
  const samples = ['M', '0', 'A', '─', '│', '┌', '┐', '└', '┘', '가', '한', '中', '日', '🙂']
  const candidates = [
    '"D2Coding", monospace',
    '"Cascadia Mono", monospace',
    'Consolas, monospace',
    '"Noto Sans Mono CJK KR", monospace',
    '"Noto Sans Mono", monospace',
    '"DejaVu Sans Mono", monospace',
    '"Liberation Mono", monospace',
    'Menlo, monospace',
    'Monaco, monospace',
    '"SF Mono", monospace',
    'ui-monospace, monospace',
    cs.fontFamily
  ]

  let best: { family: string; score: number } | null = null
  for (const family of candidates) {
    ctx.font = `${fontPrefix} ${family}`
    const base = ctx.measureText('M').width
    if (!(base > 0)) continue
    let score = 0
    for (const s of samples) {
      const w = ctx.measureText(s).width
      if (!(w > 0)) {
        score += 10
        continue
      }
      score += Math.abs(w - base) / base
    }
    if (!best || score < best.score) best = { family, score }
  }
  return best?.family ?? null
}

function measureEditorElement(el: HTMLElement): TextMetrics | null {
  const cs = window.getComputedStyle(el)
  const span = document.createElement('span')
  span.style.position = 'absolute'
  span.style.left = '-10000px'
  span.style.top = '-10000px'
  span.style.whiteSpace = 'pre'
  span.style.fontFamily = cs.fontFamily
  span.style.fontSize = cs.fontSize
  span.style.fontWeight = cs.fontWeight
  span.style.fontStyle = cs.fontStyle
  span.style.letterSpacing = cs.letterSpacing
  span.style.lineHeight = cs.lineHeight
  document.body.appendChild(span)
  let baseCharWidth = 0
  let maxCharWidth = 0
  let lineHeight = 0
  for (const s of ['M', '─', '│', '가', '한', '中', '🙂']) {
    span.textContent = s
    const r = span.getBoundingClientRect()
    if (s === 'M') baseCharWidth = r.width
    if (r.width > maxCharWidth) maxCharWidth = r.width
    if (r.height > lineHeight) lineHeight = r.height
  }
  document.body.removeChild(span)
  const charWidth = baseCharWidth > 0 ? baseCharWidth : maxCharWidth
  if (!(charWidth > 0) || !(lineHeight > 0)) return null
  return {
    charWidth,
    lineHeight,
    paddingLeft: parsePx(cs.paddingLeft),
    paddingTop: parsePx(cs.paddingTop)
  }
}

function cellFromPointerEvent(e: React.PointerEvent<HTMLElement>, el: HTMLElement, metrics: TextMetrics, bufferSize: { width: number; height: number }): Cell {
  const rect = el.getBoundingClientRect()
  const x = e.clientX - rect.left - metrics.paddingLeft + el.scrollLeft
  const y = e.clientY - rect.top - metrics.paddingTop + el.scrollTop
  const col = clampInt(Math.floor(x / metrics.charWidth), 0, bufferSize.width - 1)
  const row = clampInt(Math.floor(y / metrics.lineHeight), 0, bufferSize.height - 1)
  return { row, col }
}

function cellFromClientPoint(clientX: number, clientY: number, el: HTMLElement, metrics: TextMetrics, bufferSize: { width: number; height: number }): Cell {
  const rect = el.getBoundingClientRect()
  const x = clientX - rect.left - metrics.paddingLeft + el.scrollLeft
  const y = clientY - rect.top - metrics.paddingTop + el.scrollTop
  const col = clampInt(Math.floor(x / metrics.charWidth), 0, bufferSize.width - 1)
  const row = clampInt(Math.floor(y / metrics.lineHeight), 0, bufferSize.height - 1)
  return { row, col }
}

function setCharInLines(lines: string[], row: number, col: number, ch: string, width: number) {
  if (row < 0 || row >= lines.length) return
  if (col < 0 || col >= width) return
  const src = lines[row] ?? ''
  const cells = toCells(src)
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
  lines[row] = cells.slice(0, width).join('')
}

function cloneLines(lines: string[], height: number) {
  const out: string[] = []
  for (let i = 0; i < height; i += 1) out.push(lines[i] ?? '')
  return out
}

function drawHorizontal(lines: string[], row: number, c1: number, c2: number, width: number, ch: string) {
  const from = Math.max(0, Math.min(c1, c2))
  const to = Math.min(width - 1, Math.max(c1, c2))
  for (let col = from; col <= to; col += 1) setCharInLines(lines, row, col, ch, width)
}

function drawVertical(lines: string[], col: number, r1: number, r2: number, width: number, ch: string) {
  const from = Math.max(0, Math.min(r1, r2))
  const to = Math.min(lines.length - 1, Math.max(r1, r2))
  for (let row = from; row <= to; row += 1) setCharInLines(lines, row, col, ch, width)
}

function drawRect(base: { width: number; height: number; lines: string[] }, a: Cell, b: Cell, style: DrawStyle) {
  const chars = styleChars(style)
  const x1 = Math.min(a.col, b.col)
  const x2 = Math.max(a.col, b.col)
  const y1 = Math.min(a.row, b.row)
  const y2 = Math.max(a.row, b.row)
  const lines = cloneLines(base.lines, base.height)

  if (x1 === x2 && y1 === y2) {
    setCharInLines(lines, y1, x1, chars.tl, base.width)
    return { ...base, lines }
  }

  if (y1 === y2) {
    drawHorizontal(lines, y1, x1, x2, base.width, chars.h)
    setCharInLines(lines, y1, x1, chars.tl, base.width)
    setCharInLines(lines, y1, x2, chars.tr, base.width)
    return { ...base, lines }
  }

  if (x1 === x2) {
    drawVertical(lines, x1, y1, y2, base.width, chars.v)
    setCharInLines(lines, y1, x1, chars.tl, base.width)
    setCharInLines(lines, y2, x1, chars.bl, base.width)
    return { ...base, lines }
  }

  drawHorizontal(lines, y1, x1 + 1, x2 - 1, base.width, chars.h)
  drawHorizontal(lines, y2, x1 + 1, x2 - 1, base.width, chars.h)
  drawVertical(lines, x1, y1 + 1, y2 - 1, base.width, chars.v)
  drawVertical(lines, x2, y1 + 1, y2 - 1, base.width, chars.v)
  setCharInLines(lines, y1, x1, chars.tl, base.width)
  setCharInLines(lines, y1, x2, chars.tr, base.width)
  setCharInLines(lines, y2, x1, chars.bl, base.width)
  setCharInLines(lines, y2, x2, chars.br, base.width)
  return { ...base, lines }
}

function drawOrthogonal(base: { width: number; height: number; lines: string[] }, a: Cell, b: Cell, style: DrawStyle, opts?: { arrow?: boolean }) {
  const chars = styleChars(style)
  const lines = cloneLines(base.lines, base.height)
  const elbow: Cell = { row: a.row, col: b.col }

  if (a.col !== elbow.col) drawHorizontal(lines, a.row, a.col, elbow.col, base.width, chars.h)
  if (a.row !== b.row) drawVertical(lines, b.col, a.row, b.row, base.width, chars.v)

  const needsElbow = a.col !== elbow.col && a.row !== b.row
  if (needsElbow) setCharInLines(lines, elbow.row, elbow.col, chars.elbow(a, b), base.width)

  if (opts?.arrow) {
    let head: string = chars.arrow.right
    if (b.row !== elbow.row) {
      head = b.row > elbow.row ? chars.arrow.down : chars.arrow.up
    } else if (b.col !== a.col) {
      head = b.col > a.col ? chars.arrow.right : chars.arrow.left
    }
    setCharInLines(lines, b.row, b.col, head, base.width)
  }

  return { ...base, lines }
}

function bresenham(a: Cell, b: Cell) {
  const points: Cell[] = []
  let x0 = a.col
  let y0 = a.row
  const x1 = b.col
  const y1 = b.row
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy
  for (;;) {
    points.push({ row: y0, col: x0 })
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 > -dy) {
      err -= dy
      x0 += sx
    }
    if (e2 < dx) {
      err += dx
      y0 += sy
    }
  }
  return points
}

function drawFree(base: { width: number; height: number; lines: string[] }, points: Cell[], drawChar: string) {
  const lines = cloneLines(base.lines, base.height)
  for (const p of points) setCharInLines(lines, p.row, p.col, drawChar, base.width)
  return { ...base, lines }
}

const STORAGE_KEYS = {
  language: 'txeditor.language',
  exportNewline: 'txeditor.exportNewline',
  padRightOnSave: 'txeditor.padRightOnSave',
  drawStyle: 'txeditor.drawStyle',
  filePath: 'txeditor.filePath'
} as const

function readStorage(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    return
  }
}

function safeJsonParse<T>(text: string | null): T | null {
  if (!text) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

type MenuAction = { label: string; shortcut?: string; disabled?: boolean; onSelect: () => void }

type IconName =
  | 'file'
  | 'save'
  | 'undo'
  | 'redo'
  | 'text'
  | 'select'
  | 'rect'
  | 'line'
  | 'arrow'
  | 'brush'
  | 'gear'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'trash'
  | 'search'
  | 'replace'

function Icon({ name }: { name: IconName }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  }
  if (name === 'file')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path {...common} d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
        <path {...common} d="M14 2v5h5" />
      </svg>
    )
  if (name === 'save')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path {...common} d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <path {...common} d="M17 21v-8H7v8" />
        <path {...common} d="M7 3v5h8" />
      </svg>
    )
  if (name === 'undo')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path {...common} d="M9 14l-4-4 4-4" />
        <path {...common} d="M20 20a8 8 0 0 0-8-8H5" />
      </svg>
    )
  if (name === 'redo')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path {...common} d="M15 6l4 4-4 4" />
        <path {...common} d="M4 20a8 8 0 0 1 8-8h7" />
      </svg>
    )
  if (name === 'text')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path {...common} d="M4 6h16" />
        <path {...common} d="M8 6v14" />
        <path {...common} d="M16 6v14" />
      </svg>
    )
  if (name === 'select')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path {...common} d="M4 4h6M4 4v6M20 4h-6M20 4v6M4 20h6M4 20v-6M20 20h-6M20 20v-6" />
      </svg>
    )
  if (name === 'rect')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <rect {...common} x="5" y="6" width="14" height="12" rx="1.5" />
      </svg>
    )
  if (name === 'line')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path {...common} d="M6 6v12h12" />
      </svg>
    )
  if (name === 'arrow')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path {...common} d="M5 12h12" />
        <path {...common} d="M13 6l6 6-6 6" />
      </svg>
    )
  if (name === 'brush')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path {...common} d="M7 20c2 0 3-1 3-3 0-2 1-3 3-3 1 0 2 0 3-1 3-3 4-7 2-9-2-2-6-1-9 2-1 1-1 2-1 3 0 2-1 3-3 3-2 0-3 1-3 3 0 1 1 2 2 2z" />
      </svg>
    )
  if (name === 'gear')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path
          {...common}
          d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a7.9 7.9 0 0 0 .1-2l2-1.2-2-3.5-2.3.6a7.5 7.5 0 0 0-1.7-1L15 5h-6l-.5 2.4a7.5 7.5 0 0 0-1.7 1L4.5 7.8l-2 3.5 2 1.2a7.9 7.9 0 0 0 .1 2l-2 1.2 2 3.5 2.3-.6a7.5 7.5 0 0 0 1.7 1L9 19h6l.5-2.4a7.5 7.5 0 0 0 1.7-1l2.3.6 2-3.5-2-1.2z"
        />
      </svg>
    )
  if (name === 'copy')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path {...common} d="M9 9h11v12H9z" />
        <path {...common} d="M4 15H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
      </svg>
    )
  if (name === 'cut')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path {...common} d="M4 4l8 8" />
        <path {...common} d="M20 4l-8 8" />
        <path {...common} d="M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
      </svg>
    )
  if (name === 'paste')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path {...common} d="M8 4h8v3H8z" />
        <path {...common} d="M6 7h12v14H6z" />
      </svg>
    )
  if (name === 'trash')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path {...common} d="M4 7h16" />
        <path {...common} d="M10 11v6M14 11v6" />
        <path {...common} d="M6 7l1 14h10l1-14" />
        <path {...common} d="M9 7V4h6v3" />
      </svg>
    )
  if (name === 'search')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path {...common} d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" />
        <path {...common} d="M21 21l-4.3-4.3" />
      </svg>
    )
  if (name === 'replace')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path {...common} d="M7 7h9a4 4 0 0 1 0 8H5" />
        <path {...common} d="M7 4l-3 3 3 3" />
        <path {...common} d="M17 20l3-3-3-3" />
      </svg>
    )
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path {...common} d="M7 7h10v10H7z" />
      <path {...common} d="M4 20h16" />
    </svg>
  )
}

function IconButton({
  label,
  icon,
  disabled,
  active,
  onClick
}: {
  label: string
  icon: IconName
  disabled?: boolean
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`group relative flex h-8 w-8 items-center justify-center rounded border text-slate-700 ${
        active ? 'border-slate-400 bg-slate-100' : 'border-slate-300 bg-white hover:bg-slate-50'
      } disabled:opacity-40`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      <Icon name={icon} />
      <div className="pointer-events-none absolute left-1/2 top-full z-20 hidden -translate-x-1/2 whitespace-nowrap rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 shadow-sm group-hover:block group-focus-visible:block">
        {label}
      </div>
    </button>
  )
}

function DropdownMenu({
  trigger,
  label,
  items,
  align
}: {
  trigger: React.ReactNode
  label: string
  items: MenuAction[]
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const el = menuRef.current
      if (!el) return
      if (el.contains(e.target as Node)) return
      setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    if (items.length === 0) return
    const idx = clampInt(activeIndex, 0, Math.max(0, items.length - 1))
    setActiveIndex(idx)
    queueMicrotask(() => itemRefs.current[idx]?.focus())
  }, [activeIndex, items.length, open])

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    if (items.length === 0) return
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = (activeIndex + 1) % items.length
      setActiveIndex(next)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const next = (activeIndex - 1 + items.length) % items.length
      setActiveIndex(next)
      return
    }
    if (e.key === 'Home') {
      e.preventDefault()
      setActiveIndex(0)
      return
    }
    if (e.key === 'End') {
      e.preventDefault()
      setActiveIndex(items.length - 1)
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className="rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={items.length === 0}
        onClick={() => {
          if (items.length === 0) return
          setOpen((v) => !v)
          setActiveIndex(0)
        }}
      >
        {trigger}
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={label}
          className={`absolute top-full z-30 mt-1 min-w-56 rounded border border-slate-200 bg-white p-1 shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((it, idx) => (
            <button
              key={it.label}
              ref={(el) => {
                itemRefs.current[idx] = el
              }}
              type="button"
              role="menuitem"
              className="flex w-full items-center justify-between gap-6 rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              disabled={it.disabled}
              onClick={() => {
                setOpen(false)
                it.onSelect()
              }}
            >
              <span>{it.label}</span>
              <span className="text-xs text-slate-400">{it.shortcut ?? ''}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function MenuBar({
  language,
  onLanguageChange,
  onOpen,
  onNew,
  onSave,
  onUndo,
  onRedo,
  onCopy,
  onCut,
  onPaste,
  onFind,
  onReplace
}: {
  language: Language
  onLanguageChange: (lang: Language) => void
  onOpen: () => void
  onNew: () => void
  onSave: () => void
  onUndo: () => void
  onRedo: () => void
  onCopy: () => void
  onCut: () => void
  onPaste: () => void
  onFind: () => void
  onReplace: () => void
}) {
  const t = useCallback((key: TextKey) => TEXT[language][key], [language])
  return (
    <div className="flex h-12 items-center gap-2 border-b border-slate-200 bg-white px-3">
      <div className="mr-2 font-semibold text-slate-800">TxEditor</div>
      <DropdownMenu
        label={t('menuFile')}
        trigger={<span>{t('menuFile')}</span>}
        items={[
          { label: t('new'), shortcut: 'Ctrl+N', onSelect: onNew },
          { label: t('open'), shortcut: 'Ctrl+O', onSelect: onOpen },
          { label: t('save'), shortcut: 'Ctrl+S', onSelect: onSave }
        ]}
      />
      <DropdownMenu
        label={t('menuEdit')}
        trigger={<span>{t('menuEdit')}</span>}
        items={[
          { label: t('undo'), shortcut: 'Ctrl+Z', onSelect: onUndo },
          { label: t('redo'), shortcut: 'Ctrl+Y', onSelect: onRedo },
          { label: t('copy'), shortcut: 'Ctrl+C', onSelect: onCopy },
          { label: t('cut'), shortcut: 'Ctrl+X', onSelect: onCut },
          { label: t('paste'), shortcut: 'Ctrl+V', onSelect: onPaste },
          { label: t('find'), shortcut: 'Ctrl+F', onSelect: onFind },
          { label: t('replace'), shortcut: 'Ctrl+H', onSelect: onReplace }
        ]}
      />
      <DropdownMenu label={t('menuHelp')} trigger={<span>{t('menuHelp')}</span>} items={[]} />
      <div className="ml-auto flex items-center gap-1">
        <DropdownMenu
          align="right"
          label={t('settings')}
          trigger={
            <span className="inline-flex items-center gap-2">
              <Icon name="gear" />
              <span className="sr-only">{t('settings')}</span>
            </span>
          }
          items={[
            { label: LANGUAGE_LABELS.ko, disabled: language === 'ko', onSelect: () => onLanguageChange('ko') },
            { label: LANGUAGE_LABELS.en, disabled: language === 'en', onSelect: () => onLanguageChange('en') },
            { label: LANGUAGE_LABELS.ja, disabled: language === 'ja', onSelect: () => onLanguageChange('ja') },
            { label: LANGUAGE_LABELS['zh-Hant'], disabled: language === 'zh-Hant', onSelect: () => onLanguageChange('zh-Hant') },
            { label: LANGUAGE_LABELS['zh-Hans'], disabled: language === 'zh-Hans', onSelect: () => onLanguageChange('zh-Hans') }
          ]}
        />
        <div className="hidden" />
      </div>
    </div>
  )
}

function basename(p: string) {
  const parts = p.split(/[\\/]/)
  const last = parts[parts.length - 1]
  return last || p
}

function StatusBar({
  language,
  newlineMode,
  filePath
}: {
  language: Language
  newlineMode: ExportNewline
  filePath: string | null
}) {
  const t = useCallback((key: TextKey) => TEXT[language][key], [language])
  const buffer = useEditorStore((s) => s.buffer)
  const cursor = useEditorStore((s) => s.cursor)
  const row = cursor ? cursor.row + 1 : null
  const col = cursor ? cursor.col + 1 : null
  return (
    <div className="flex h-8 items-center justify-between border-t border-slate-200 bg-white px-3 text-xs text-slate-700">
      <div>
        {t('ln')}: {row ?? '-'}, {t('col')}: {col ?? '-'}
      </div>
      <div className="flex items-center gap-3">
        <div>
          {t('file')}: {filePath ? basename(filePath) : '-'}
        </div>
        <div>
          {t('buffer')}: {buffer.width}×{buffer.height}
        </div>
        <div>
          {t('newline')}: {newlineMode.toUpperCase()}
        </div>
        <div>UTF-8</div>
        <div>Windows Webview2 (Tauri)</div>
      </div>
    </div>
  )
}

function snapColToCellStart(line: string, col: number) {
  const cells = toCells(line)
  let c = clampInt(col, 0, Math.max(0, cells.length - 1))
  while (c > 0 && (cells[c] ?? '') === CONTINUATION_CELL) c -= 1
  return c
}

function snapCursorToCellStartInBuffer(buffer: { width: number; height: number; lines: string[] }, pos: Cell) {
  const row = clampInt(pos.row, 0, buffer.height - 1)
  const col = clampInt(pos.col, 0, buffer.width - 1)
  const line = buffer.lines[row] ?? ''
  return { row, col: snapColToCellStart(line, col) }
}

function clearContinuationRight(lines: string[], row: number, col: number, width: number) {
  for (let c = col + 1; c < width; c += 1) {
    const ch = getCellAt(lines[row] ?? '', c)
    if (ch !== CONTINUATION_CELL) break
    setCharInLines(lines, row, c, ' ', width)
  }
}

function deleteCellAt(lines: string[], row: number, col: number, width: number) {
  const line = lines[row] ?? ''
  const startCol = snapColToCellStart(line, col)
  setCharInLines(lines, row, startCol, ' ', width)
  clearContinuationRight(lines, row, startCol, width)
  return startCol
}

function overwriteTextIntoBuffer(
  base: { width: number; height: number; lines: string[] },
  at: Cell,
  text: string
): { next: { width: number; height: number; lines: string[] }; cursor: Cell } {
  const lines = cloneLines(base.lines, base.height)
  let row = clampInt(at.row, 0, base.height - 1)
  let col = clampInt(at.col, 0, base.width - 1)
  col = snapColToCellStart(lines[row] ?? '', col)
  for (const ch of toCells(text.replace(/\r\n/g, '\n'))) {
    if (ch === '\r') continue
    if (ch === '\n') {
      row += 1
      col = 0
      if (row >= base.height) break
      continue
    }
    col = snapColToCellStart(lines[row] ?? '', col)
    clearContinuationRight(lines, row, col, base.width)
    setCharInLines(lines, row, col, ch, base.width)
    col += 1
    if (col >= base.width) {
      row += 1
      col = 0
      if (row >= base.height) break
    }
  }
  return { next: { ...base, lines }, cursor: { row: clampInt(row, 0, base.height - 1), col: clampInt(col, 0, base.width - 1) } }
}

function diffText(oldText: string, newText: string) {
  if (oldText === newText) return { start: 0, deleted: '', inserted: '' }
  const oldLen = oldText.length
  const newLen = newText.length
  let start = 0
  while (start < oldLen && start < newLen && oldText[start] === newText[start]) start += 1
  let endOld = oldLen - 1
  let endNew = newLen - 1
  while (endOld >= start && endNew >= start && oldText[endOld] === newText[endNew]) {
    endOld -= 1
    endNew -= 1
  }
  const deleted = oldText.slice(start, endOld + 1)
  const inserted = newText.slice(start, endNew + 1)
  return { start, deleted, inserted }
}

export default function App() {
  const buffer = useEditorStore((s) => s.buffer)
  const newBuffer = useEditorStore((s) => s.newBuffer)
  const setBufferFromText = useEditorStore((s) => s.setBufferFromText)
  const loadBufferFromTextAutoSize = useEditorStore((s) => s.loadBufferFromTextAutoSize)
  const commitBuffer = useEditorStore((s) => s.commitBuffer)
  const setCursor = useEditorStore((s) => s.setCursor)
  const cursor = useEditorStore((s) => s.cursor)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)

  const [isNewOpen, setIsNewOpen] = useState(false)
  const [customWidth, setCustomWidth] = useState(80)
  const [customHeight, setCustomHeight] = useState(24)
  const [language, setLanguage] = useState<Language>(() => {
    const stored = readStorage(STORAGE_KEYS.language)
    if (stored === 'ko' || stored === 'en' || stored === 'ja' || stored === 'zh-Hant' || stored === 'zh-Hans') return stored
    return 'ko'
  })
  const [filePath, setFilePath] = useState<string | null>(() => readStorage(STORAGE_KEYS.filePath))
  const [exportNewline, setExportNewline] = useState<ExportNewline>(() => {
    const stored = readStorage(STORAGE_KEYS.exportNewline)
    if (stored === 'lf' || stored === 'crlf') return stored
    return navigator.userAgent.includes('Windows') ? 'crlf' : 'lf'
  })
  const [padRightOnSave, setPadRightOnSave] = useState(() => readStorage(STORAGE_KEYS.padRightOnSave) === 'true')
  const [lastError, setLastError] = useState<string | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const preRef = useRef<HTMLPreElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const [editorFontFamily, setEditorFontFamily] = useState<string | null>(null)
  const [tool, setTool] = useState<ToolMode>('text')
  const [freeChar, setFreeChar] = useState('#')
  const [drawStyle, setDrawStyle] = useState<DrawStyle>(() => {
    const stored = readStorage(STORAGE_KEYS.drawStyle)
    if (stored === 'ascii' || stored === 'unicode') return stored
    return 'ascii'
  })
  const [draftBuffer, setDraftBuffer] = useState<{ width: number; height: number; lines: string[] } | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionRect, setSelectionRect] = useState<Rect | null>(null)
  const [clipboard, setClipboard] = useState<BlockClipboard>(null)
  const [metrics, setMetrics] = useState<TextMetrics | null>(null)
  const metricsRef = useRef<TextMetrics | null>(null)
  const composingRef = useRef(false)
  const restoreViewportRef = useRef<{ scrollTop: number; scrollLeft: number } | null>(null)
  const gestureRef = useRef<{
    tool: Exclude<ToolMode, 'text'>
    start: Cell
    last: Cell
    current: Cell
    base: { width: number; height: number; lines: string[] }
    drawChar: string
    points: Cell[]
  } | null>(null)
  const selectGestureRef = useRef<{ start: Cell; current: Cell } | null>(null)
  const [isFindOpen, setIsFindOpen] = useState(false)
  const [isReplaceOpen, setIsReplaceOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const findInputRef = useRef<HTMLInputElement | null>(null)
  const replaceInputRef = useRef<HTMLInputElement | null>(null)
  const [findMatch, setFindMatch] = useState<Cell | null>(null)
  const [contextMenu, setContextMenu] = useState<{ open: boolean; x: number; y: number; at: Cell | null; inSelection: boolean }>({
    open: false,
    x: 0,
    y: 0,
    at: null,
    inSelection: false
  })
  const contextMenuRef = useRef<HTMLDivElement | null>(null)

  const renderText = useMemo(() => bufferToText(draftBuffer ?? buffer, { padRight: true }), [buffer, draftBuffer])
  const t = useCallback((key: TextKey) => TEXT[language][key], [language])

  const snapCursorToCellStart = useCallback(
    (pos: Cell) => {
      const row = clampInt(pos.row, 0, buffer.height - 1)
      const col = clampInt(pos.col, 0, buffer.width - 1)
      const line = buffer.lines[row] ?? ''
      return { row, col: snapColToCellStart(line, col) }
    },
    [buffer.height, buffer.lines, buffer.width]
  )

  useEffect(() => writeStorage(STORAGE_KEYS.language, language), [language])
  useEffect(() => writeStorage(STORAGE_KEYS.exportNewline, exportNewline), [exportNewline])
  useEffect(() => writeStorage(STORAGE_KEYS.padRightOnSave, padRightOnSave ? 'true' : 'false'), [padRightOnSave])
  useEffect(() => writeStorage(STORAGE_KEYS.drawStyle, drawStyle), [drawStyle])
  useEffect(() => {
    if (isFindOpen) findInputRef.current?.focus()
  }, [isFindOpen])
  useEffect(() => {
    if (isReplaceOpen) replaceInputRef.current?.focus()
  }, [isReplaceOpen])
  useEffect(() => {
    if (!findQuery) setFindMatch(null)
  }, [findQuery])
  useEffect(() => {
    if (!filePath) return
    writeStorage(STORAGE_KEYS.filePath, filePath)
  }, [filePath])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    const family = chooseEditorFontFamily(el)
    if (!family) return
    setEditorFontFamily(family)
    metricsRef.current = null
    setMetrics(null)
  }, [])

  useEffect(() => {
    const el = preRef.current
    if (!el) return
    const m = measureEditorElement(el)
    metricsRef.current = m
    setMetrics(m)
  }, [editorFontFamily])

  const openFileByPath = useCallback(
    async (path: string) => {
      try {
        setLastError(null)
        const contents = await invoke<string>('read_text_file', { path })
        loadBufferFromTextAutoSize(contents)
        setFilePath(path)
        queueMicrotask(() => inputRef.current?.focus())
      } catch {
        setLastError(t('loadError'))
      }
    },
    [loadBufferFromTextAutoSize, t]
  )

  const saveBufferText = useCallback(
    async (opts?: { forceDialog?: boolean }) => {
      const forceDialog = opts?.forceDialog ?? false
      const contents = normalizeNewlines(bufferToText(buffer, { padRight: padRightOnSave }), exportNewline)

      if (filePath && !forceDialog) {
        await invoke('write_text_file', { path: filePath, contents })
        return
      }

      const path = await save({
        defaultPath: filePath ?? 'txeditor.txt',
        filters: [{ name: 'Text', extensions: ['txt'] }]
      })
      if (!path) return
      await invoke('write_text_file', { path, contents })
      setFilePath(path)
    },
    [buffer, exportNewline, filePath, padRightOnSave]
  )

  const openTextFile = useCallback(async () => {
    const picked = await open({
      multiple: false,
      filters: [{ name: 'Text', extensions: ['txt'] }]
    })
    if (!picked) return
    const path = Array.isArray(picked) ? picked[0] : picked
    if (!path) return
    await openFileByPath(path)
  }, [openFileByPath])

  const clearSelection = useCallback(() => {
    selectGestureRef.current = null
    setIsSelecting(false)
    setSelectionRect(null)
  }, [])

  const scrollCellIntoView = useCallback((cell: Cell) => {
    const viewport = viewportRef.current
    const m = metricsRef.current
    if (!viewport || !m) return
    const x = m.paddingLeft + cell.col * m.charWidth
    const y = m.paddingTop + cell.row * m.lineHeight
    const marginX = m.charWidth * 2
    const marginY = m.lineHeight * 2

    const viewLeft = viewport.scrollLeft
    const viewRight = viewport.scrollLeft + viewport.clientWidth
    const viewTop = viewport.scrollTop
    const viewBottom = viewport.scrollTop + viewport.clientHeight

    const cellLeft = x
    const cellRight = x + m.charWidth
    const cellTop = y
    const cellBottom = y + m.lineHeight

    if (cellLeft < viewLeft + marginX) viewport.scrollLeft = Math.max(0, cellLeft - marginX)
    else if (cellRight > viewRight - marginX) viewport.scrollLeft = Math.max(0, cellRight - viewport.clientWidth + marginX)

    if (cellTop < viewTop + marginY) viewport.scrollTop = Math.max(0, cellTop - marginY)
    else if (cellBottom > viewBottom - marginY) viewport.scrollTop = Math.max(0, cellBottom - viewport.clientHeight + marginY)
  }, [])

  const cancelDrawing = useCallback(() => {
    gestureRef.current = null
    setDraftBuffer(null)
    setIsDrawing(false)
    clearSelection()
    queueMicrotask(() => inputRef.current?.focus())
  }, [clearSelection])

  const cancelPointerGesture = useCallback(() => {
    if (selectGestureRef.current) {
      selectGestureRef.current = null
      setIsSelecting(false)
    }
    if (gestureRef.current) {
      gestureRef.current = null
      setDraftBuffer(null)
      setIsDrawing(false)
    }
    queueMicrotask(() => inputRef.current?.focus())
  }, [])

  const copySelection = useCallback(() => {
    if (!selectionRect) return
    const clip = copyRectFromBuffer(buffer, selectionRect)
    setClipboard(clip)
  }, [buffer, selectionRect])

  const deleteSelection = useCallback(() => {
    if (!selectionRect) return
    const next = applyRectFill(buffer, selectionRect, ' ')
    commitBuffer(next)
    clearSelection()
  }, [buffer, clearSelection, commitBuffer, selectionRect])

  const cutSelection = useCallback(() => {
    copySelection()
    deleteSelection()
  }, [copySelection, deleteSelection])

  const pasteClipboard = useCallback(() => {
    const at = cursor ?? { row: 0, col: 0 }
    const next = pasteRectIntoBuffer(buffer, at, clipboard)
    commitBuffer(next)
    clearSelection()
  }, [buffer, clearSelection, clipboard, commitBuffer, cursor])

  const pasteClipboardAt = useCallback(
    (at: Cell) => {
      if (!clipboard) return
      const next = pasteRectIntoBuffer(buffer, at, clipboard)
      commitBuffer(next)
      setCursor(at)
      clearSelection()
      setContextMenu({ open: false, x: 0, y: 0, at: null, inSelection: false })
      queueMicrotask(() => inputRef.current?.focus())
    },
    [buffer, clipboard, clearSelection, commitBuffer, setCursor]
  )

  const applyOverwriteAt = useCallback(
    (opts: { text: string; at?: Cell }) => {
      const viewport = viewportRef.current
      if (viewport) restoreViewportRef.current = { scrollTop: viewport.scrollTop, scrollLeft: viewport.scrollLeft }
      const { buffer: currentBuffer, cursor: currentCursor } = useEditorStore.getState()
      const at = snapCursorToCellStartInBuffer(currentBuffer, opts.at ?? currentCursor ?? { row: 0, col: 0 })

      const { next, cursor: nextCursor } = overwriteTextIntoBuffer(currentBuffer, at, opts.text)
      commitBuffer({ width: next.width, height: next.height, lines: next.lines })
      setCursor({ row: nextCursor.row, col: nextCursor.col })
      setDraftBuffer(null)
    },
    [commitBuffer, setCursor]
  )

  const openFind = useCallback(() => {
    cancelDrawing()
    clearSelection()
    setTool('text')
    setIsReplaceOpen(false)
    setIsFindOpen(true)
    queueMicrotask(() => findInputRef.current?.focus())
  }, [cancelDrawing, clearSelection])

  const openReplace = useCallback(() => {
    cancelDrawing()
    clearSelection()
    setTool('text')
    setIsFindOpen(false)
    setIsReplaceOpen(true)
    queueMicrotask(() => replaceInputRef.current?.focus())
  }, [cancelDrawing, clearSelection])

  const closeFindReplace = useCallback(() => {
    setIsFindOpen(false)
    setIsReplaceOpen(false)
    queueMicrotask(() => inputRef.current?.focus())
  }, [])

  const isCellInRect = useCallback((rect: Rect, cell: Cell) => {
    if (cell.row < rect.top || cell.row > rect.bottom) return false
    if (cell.col < rect.left || cell.col > rect.right) return false
    return true
  }, [])

  const computeMatches = useCallback(
    (query: string) => {
      const q = query
      if (!q) return [] as Cell[]
      const matches: Cell[] = []
      for (let row = 0; row < buffer.height; row += 1) {
        const displayLine = toDisplayText(buffer.lines[row] ?? '')
        let idx = 0
        for (;;) {
          const found = displayLine.indexOf(q, idx)
          if (found === -1) break
          const col = cellLength(displayLine.slice(0, found))
          matches.push({ row, col })
          idx = found + Math.max(1, q.length)
        }
      }
      return matches
    },
    [buffer.height, buffer.lines]
  )

  const findQueryLen = useMemo(() => cellLength(findQuery), [findQuery])
  const findMatches = useMemo(() => computeMatches(findQuery), [computeMatches, findQuery])
  const currentFindIndex = useMemo(() => {
    if (!findMatch) return null
    const idx = findMatches.findIndex((m) => m.row === findMatch.row && m.col === findMatch.col)
    return idx === -1 ? null : idx
  }, [findMatch, findMatches])

  const findNext = useCallback(
    (opts?: { from?: Cell }) => {
      const matches = computeMatches(findQuery)
      if (matches.length === 0) return false
      const from = opts?.from ?? cursor ?? { row: 0, col: 0 }
      const idx = matches.findIndex((m) => m.row > from.row || (m.row === from.row && m.col > from.col))
      const match = matches[idx === -1 ? 0 : idx]
      cancelDrawing()
      clearSelection()
      setTool('text')
      setCursor(match)
      setFindMatch(match)
      queueMicrotask(() => {
        scrollCellIntoView(match)
        inputRef.current?.focus()
      })
      return true
    },
    [cancelDrawing, clearSelection, computeMatches, cursor, findQuery, scrollCellIntoView, setCursor]
  )

  const findPrev = useCallback(
    (opts?: { from?: Cell }) => {
      const matches = computeMatches(findQuery)
      if (matches.length === 0) return false
      const from = opts?.from ?? cursor ?? { row: 0, col: 0 }
      let idx = -1
      for (let i = matches.length - 1; i >= 0; i -= 1) {
        const m = matches[i]
        if (m.row < from.row || (m.row === from.row && m.col < from.col)) {
          idx = i
          break
        }
      }
      const match = matches[idx === -1 ? matches.length - 1 : idx]
      cancelDrawing()
      clearSelection()
      setTool('text')
      setCursor(match)
      setFindMatch(match)
      queueMicrotask(() => {
        scrollCellIntoView(match)
        inputRef.current?.focus()
      })
      return true
    },
    [cancelDrawing, clearSelection, computeMatches, cursor, findQuery, scrollCellIntoView, setCursor]
  )

  const replaceNext = useCallback(() => {
    const matches = computeMatches(findQuery)
    if (matches.length === 0) return
    const from = cursor ?? { row: 0, col: 0 }
    const idx = matches.findIndex((m) => m.row > from.row || (m.row === from.row && m.col >= from.col))
    const match = matches[idx === -1 ? 0 : idx]
    const findLen = cellLength(findQuery)
    const replaceLen = cellLength(replaceQuery)
    const paddedReplace = replaceLen < findLen ? replaceQuery + ' '.repeat(findLen - replaceLen) : replaceQuery
    applyOverwriteAt({ at: match, text: paddedReplace })
    queueMicrotask(() => {
      const after = useEditorStore.getState().cursor ?? match
      findNext({ from: after })
    })
  }, [applyOverwriteAt, computeMatches, cursor, findNext, findQuery, replaceQuery])

  const replacePrev = useCallback(() => {
    const matches = computeMatches(findQuery)
    if (matches.length === 0) return
    const from = cursor ?? { row: 0, col: 0 }
    let idx = -1
    for (let i = matches.length - 1; i >= 0; i -= 1) {
      const m = matches[i]
      if (m.row < from.row || (m.row === from.row && m.col <= from.col)) {
        idx = i
        break
      }
    }
    const match = matches[idx === -1 ? matches.length - 1 : idx]
    const findLen = cellLength(findQuery)
    const replaceLen = cellLength(replaceQuery)
    const paddedReplace = replaceLen < findLen ? replaceQuery + ' '.repeat(findLen - replaceLen) : replaceQuery
    applyOverwriteAt({ at: match, text: paddedReplace })
    queueMicrotask(() => {
      findPrev({ from: match })
    })
  }, [applyOverwriteAt, computeMatches, cursor, findPrev, findQuery, replaceQuery])

  const replaceAll = useCallback(() => {
    const { buffer: currentBuffer } = useEditorStore.getState()
    const matches = computeMatches(findQuery)
    if (matches.length === 0) return
    const findLen = cellLength(findQuery)
    const replaceLen = cellLength(replaceQuery)
    const paddedReplace = replaceLen < findLen ? replaceQuery + ' '.repeat(findLen - replaceLen) : replaceQuery

    let next = currentBuffer
    for (let i = matches.length - 1; i >= 0; i -= 1) {
      next = overwriteTextIntoBuffer(next, snapCursorToCellStartInBuffer(next, matches[i]), paddedReplace).next
    }
    commitBuffer({ width: next.width, height: next.height, lines: next.lines })
    queueMicrotask(() => inputRef.current?.focus())
  }, [commitBuffer, computeMatches, findQuery, replaceQuery])

  useEffect(() => {
    if (!contextMenu.open) return
    const onPointerDown = () => setContextMenu({ open: false, x: 0, y: 0, at: null, inSelection: false })
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [contextMenu.open])

  useEffect(() => {
    if (!contextMenu.open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setContextMenu({ open: false, x: 0, y: 0, at: null, inSelection: false })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [contextMenu.open])

  useEffect(() => {
    if (!contextMenu.open) return
    const el = contextMenuRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    let x = contextMenu.x
    let y = contextMenu.y
    const pad = 8
    if (x + r.width + pad > window.innerWidth) x = Math.max(pad, window.innerWidth - r.width - pad)
    if (y + r.height + pad > window.innerHeight) y = Math.max(pad, window.innerHeight - r.height - pad)
    if (x !== contextMenu.x || y !== contextMenu.y) setContextMenu((s) => ({ ...s, x, y }))
  }, [contextMenu.open, contextMenu.x, contextMenu.y])


  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      const ctrlOrMeta = e.ctrlKey || e.metaKey
      if (isFindOpen || isReplaceOpen) {
        if (e.key === 'Escape') {
          e.preventDefault()
          closeFindReplace()
        }
        return
      }

      if (gestureRef.current || selectGestureRef.current) {
        if (gestureRef.current) {
          e.preventDefault()
          cancelDrawing()
        }
        return
      }

      if (!ctrlOrMeta) return
      if (key === 'f') {
        e.preventDefault()
        openFind()
        return
      }

      if (key === 'h') {
        e.preventDefault()
        openReplace()
        return
      }

      if (key === 'c') {
        if (tool === 'select') {
          e.preventDefault()
          copySelection()
        }
        return
      }

      if (key === 'x') {
        if (tool === 'select') {
          e.preventDefault()
          cutSelection()
        }
        return
      }

      if (key === 'v') {
        if (tool === 'select') {
          e.preventDefault()
          pasteClipboard()
        }
        return
      }


      if (key === 's') {
        e.preventDefault()
        void saveBufferText()
        return
      }

      if (key === 'o') {
        e.preventDefault()
        void openTextFile()
        return
      }

      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
          return
        }
        undo()
        return
      }

      if (key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    cancelDrawing,
    closeFindReplace,
    copySelection,
    cutSelection,
    isFindOpen,
    isReplaceOpen,
    openFind,
    openReplace,
    openTextFile,
    pasteClipboard,
    redo,
    saveBufferText,
    tool,
    undo
  ])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (tool !== 'select') return
      if (!selectionRect) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteSelection()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [deleteSelection, selectionRect, tool])

  const applyAndCommitGesture = useCallback(
    (g: NonNullable<typeof gestureRef.current>) => {
      let next = g.base as { width: number; height: number; lines: string[] }
      if (g.tool === 'rect') next = drawRect(next, g.start, g.current, drawStyle)
      if (g.tool === 'line') next = drawOrthogonal(next, g.start, g.current, drawStyle)
      if (g.tool === 'arrow') next = drawOrthogonal(next, g.start, g.current, drawStyle, { arrow: true })
      if (g.tool === 'free') next = drawFree(next, g.points, g.drawChar)
      const viewport = viewportRef.current
      if (viewport) restoreViewportRef.current = { scrollTop: viewport.scrollTop, scrollLeft: viewport.scrollLeft }
      commitBuffer({ width: next.width, height: next.height, lines: next.lines })
      setDraftBuffer(null)
    },
    [commitBuffer, drawStyle]
  )

  const applyDraftFromGesture = useCallback((g: NonNullable<typeof gestureRef.current>) => {
    let next = g.base as { width: number; height: number; lines: string[] }
    if (g.tool === 'rect') next = drawRect(next, g.start, g.current, drawStyle)
    if (g.tool === 'line') next = drawOrthogonal(next, g.start, g.current, drawStyle)
    if (g.tool === 'arrow') next = drawOrthogonal(next, g.start, g.current, drawStyle, { arrow: true })
    if (g.tool === 'free') next = drawFree(next, g.points, g.drawChar)
    setDraftBuffer({ width: next.width, height: next.height, lines: next.lines })
  }, [drawStyle])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    if (restoreViewportRef.current) {
      const { scrollTop, scrollLeft } = restoreViewportRef.current
      restoreViewportRef.current = null
      viewport.scrollTop = scrollTop
      viewport.scrollLeft = scrollLeft
    }
  }, [buffer.height, buffer.lines, buffer.width, cursor, draftBuffer, tool])

  const applyBackspace = useCallback(() => {
    const viewport = viewportRef.current
    if (viewport) restoreViewportRef.current = { scrollTop: viewport.scrollTop, scrollLeft: viewport.scrollLeft }
    const { buffer: currentBuffer, cursor: currentCursor } = useEditorStore.getState()
    if (!currentCursor) return
    const at: Cell = snapCursorToCellStartInBuffer(currentBuffer, currentCursor)
    let nextAt = at
    if (nextAt.col > 0) nextAt = { row: nextAt.row, col: nextAt.col - 1 }
    else if (nextAt.row > 0) nextAt = { row: nextAt.row - 1, col: currentBuffer.width - 1 }
    const lines = cloneLines(currentBuffer.lines, currentBuffer.height)
    const deletedCol = deleteCellAt(lines, nextAt.row, nextAt.col, currentBuffer.width)
    commitBuffer({ width: currentBuffer.width, height: currentBuffer.height, lines })
    setCursor({ row: nextAt.row, col: deletedCol })
    setDraftBuffer(null)
  }, [commitBuffer, setCursor])

  const applyDelete = useCallback(() => {
    const viewport = viewportRef.current
    if (viewport) restoreViewportRef.current = { scrollTop: viewport.scrollTop, scrollLeft: viewport.scrollLeft }
    const { buffer: currentBuffer, cursor: currentCursor } = useEditorStore.getState()
    if (!currentCursor) return
    const at: Cell = snapCursorToCellStartInBuffer(currentBuffer, currentCursor)
    const lines = cloneLines(currentBuffer.lines, currentBuffer.height)
    const deletedCol = deleteCellAt(lines, at.row, at.col, currentBuffer.width)
    commitBuffer({ width: currentBuffer.width, height: currentBuffer.height, lines })
    setCursor({ row: at.row, col: deletedCol })
    setDraftBuffer(null)
  }, [commitBuffer, setCursor])

  const applyEnter = useCallback(() => {
    const viewport = viewportRef.current
    if (viewport) restoreViewportRef.current = { scrollTop: viewport.scrollTop, scrollLeft: viewport.scrollLeft }
    const { buffer: currentBuffer, cursor: currentCursor } = useEditorStore.getState()
    const at = currentCursor ?? { row: 0, col: 0 }
    const nextRow = clampInt(at.row + 1, 0, currentBuffer.height - 1)
    const nextCol = 0
    setCursor({ row: nextRow, col: nextCol })
    setDraftBuffer(null)
  }, [setCursor])

  const beginGesture = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (contextMenu.open) setContextMenu({ open: false, x: 0, y: 0, at: null, inSelection: false })
      if (tool === 'text') {
        if (isDrawing || isSelecting) return
        const el = e.currentTarget
        const metricsEl = preRef.current ?? el
        metricsRef.current = metricsRef.current ?? measureEditorElement(metricsEl)
        const metrics = metricsRef.current
        if (!metrics) return
        restoreViewportRef.current = { scrollTop: el.scrollTop, scrollLeft: el.scrollLeft }
        const clicked = cellFromPointerEvent(e, el, metrics, { width: buffer.width, height: buffer.height })
        const next = snapCursorToCellStart(clicked)
        setCursor(next)
        queueMicrotask(() => inputRef.current?.focus())
        return
      }
      if (e.button !== 0) return
      const el = e.currentTarget
      const metricsEl = preRef.current ?? el
      metricsRef.current = metricsRef.current ?? measureEditorElement(metricsEl)
      const metrics = metricsRef.current
      if (!metrics) return

      el.setPointerCapture(e.pointerId)
      const start = cellFromPointerEvent(e, el, metrics, { width: buffer.width, height: buffer.height })
      if (tool === 'select') {
        selectGestureRef.current = { start, current: start }
        setIsSelecting(true)
        setSelectionRect(normalizeRect(start, start))
        return
      }
      const base = { width: buffer.width, height: buffer.height, lines: [...buffer.lines] }
      const g = {
        tool,
        start,
        last: start,
        current: start,
        base,
        drawChar: freeChar,
        points: tool === 'free' ? [start] : []
      } as NonNullable<typeof gestureRef.current>
      gestureRef.current = g
      setIsDrawing(true)
      applyDraftFromGesture(g)
    },
    [
      applyDraftFromGesture,
      buffer.height,
      buffer.lines,
      buffer.width,
      contextMenu.open,
      freeChar,
      isDrawing,
      isSelecting,
      setCursor,
      snapCursorToCellStart,
      tool
    ]
  )

  const moveGesture = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const sg = selectGestureRef.current
      if (sg) {
        const el = e.currentTarget
        const metrics = metricsRef.current
        if (!metrics) return
        const cell = cellFromPointerEvent(e, el, metrics, { width: buffer.width, height: buffer.height })
        sg.current = cell
        setSelectionRect(normalizeRect(sg.start, sg.current))
        return
      }
      const g = gestureRef.current
      if (!g) return
      const el = e.currentTarget
      const metrics = metricsRef.current
      if (!metrics) return
      const cell = cellFromPointerEvent(e, el, metrics, { width: g.base.width, height: g.base.height })
      g.current = cell
      if (g.tool === 'free') {
        const pts = bresenham(g.last, cell)
        for (let i = 1; i < pts.length; i += 1) g.points.push(pts[i])
        g.last = cell
      }
      applyDraftFromGesture(g)
    },
    [applyDraftFromGesture, buffer.height, buffer.width]
  )

  const endGesture = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (selectGestureRef.current) {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {}
        selectGestureRef.current = null
        setIsSelecting(false)
        queueMicrotask(() => inputRef.current?.focus())
        return
      }
      const g = gestureRef.current
      if (!g) return
      try {
        applyAndCommitGesture(g)
      } finally {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {}
        gestureRef.current = null
        setDraftBuffer(null)
        setIsDrawing(false)
        queueMicrotask(() => inputRef.current?.focus())
      }
    },
    [applyAndCommitGesture]
  )

  return (
    <div className="flex h-full w-full flex-col">
      <MenuBar
        language={language}
        onLanguageChange={setLanguage}
        onOpen={() => void openTextFile()}
        onNew={() => setIsNewOpen(true)}
        onSave={() => void saveBufferText()}
        onUndo={() => {
          if (isDrawing) return
          undo()
        }}
        onRedo={() => {
          if (isDrawing) return
          redo()
        }}
        onCopy={copySelection}
        onCut={cutSelection}
        onPaste={pasteClipboard}
        onFind={openFind}
        onReplace={openReplace}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <IconButton label={t('new')} icon="file" onClick={() => setIsNewOpen(true)} />
              <IconButton label={t('open')} icon="file" onClick={() => void openTextFile()} />
              <IconButton label={t('save')} icon="save" onClick={() => void saveBufferText()} />
            </div>
          </div>

          <div className="flex items-center gap-2 border-l border-slate-200 pl-2">
            <div className="flex items-center gap-1">
              <IconButton label={t('undo')} icon="undo" onClick={undo} disabled={isDrawing || isSelecting} />
              <IconButton label={t('redo')} icon="redo" onClick={redo} disabled={isDrawing || isSelecting} />
              <IconButton label={t('find')} icon="search" onClick={openFind} />
              <IconButton label={t('replace')} icon="replace" onClick={openReplace} />
            </div>
          </div>

          <div className="flex items-center gap-2 border-l border-slate-200 pl-2">
            <div className="font-semibold">{t('tools')}</div>
            <div className="flex items-center gap-1">
              <IconButton
                label={t('toolText')}
                icon="text"
                onClick={() => {
                  cancelDrawing()
                  clearSelection()
                  setTool('text')
                }}
                active={tool === 'text'}
              />
              <IconButton
                label={t('toolSelect')}
                icon="select"
                onClick={() => {
                  cancelDrawing()
                  setTool('select')
                }}
                active={tool === 'select'}
              />
              <IconButton
                label={t('toolRect')}
                icon="rect"
                onClick={() => {
                  cancelDrawing()
                  clearSelection()
                  setTool('rect')
                }}
                active={tool === 'rect'}
              />
              <IconButton
                label={t('toolLine')}
                icon="line"
                onClick={() => {
                  cancelDrawing()
                  clearSelection()
                  setTool('line')
                }}
                active={tool === 'line'}
              />
              <IconButton
                label={t('toolArrow')}
                icon="arrow"
                onClick={() => {
                  cancelDrawing()
                  clearSelection()
                  setTool('arrow')
                }}
                active={tool === 'arrow'}
              />
              <IconButton
                label={t('toolFree')}
                icon="brush"
                onClick={() => {
                  cancelDrawing()
                  clearSelection()
                  setTool('free')
                }}
                active={tool === 'free'}
              />
            </div>
          </div>

          {tool === 'free' ? (
            <div className="flex items-center gap-2 border-l border-slate-200 pl-2">
              <span>{t('drawChar')}</span>
              <select
                className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs"
                value={freeChar}
                onChange={(e) => setFreeChar(e.target.value)}
              >
                <option value="#">#</option>
                <option value="$">$</option>
                <option value="%">%</option>
              </select>
            </div>
          ) : null}

          <div className="flex items-center gap-2 border-l border-slate-200 pl-2">
            <span>{t('style')}</span>
            <select
              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs"
              value={drawStyle}
              onChange={(e) => setDrawStyle(e.target.value as DrawStyle)}
              disabled={isDrawing || isSelecting}
            >
              <option value="ascii">{t('styleAscii')}</option>
              <option value="unicode">{t('styleUnicode')}</option>
            </select>
          </div>

          {tool === 'select' ? (
            <div className="flex flex-wrap items-center gap-2 border-l border-slate-200 pl-2">
              <div className="flex items-center gap-2">
                <span>{t('selection')}</span>
                <span className="text-slate-500">
                  {selectionRect ? `${selectionRect.left},${selectionRect.top}–${selectionRect.right},${selectionRect.bottom}` : '-'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50 disabled:opacity-40"
                  onClick={copySelection}
                  disabled={!selectionRect}
                >
                  {t('copy')}
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50 disabled:opacity-40"
                  onClick={cutSelection}
                  disabled={!selectionRect}
                >
                  {t('cut')}
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50 disabled:opacity-40"
                  onClick={pasteClipboard}
                  disabled={!clipboard}
                >
                  {t('paste')}
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50 disabled:opacity-40"
                  onClick={deleteSelection}
                  disabled={!selectionRect}
                >
                  {t('delete')}
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-2 border-l border-slate-200 pl-2">
            <span>{t('newline')}</span>
            <select
              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs"
              value={exportNewline}
              onChange={(e) => setExportNewline(e.target.value as ExportNewline)}
              disabled={isDrawing || isSelecting}
            >
              <option value="lf">LF</option>
              <option value="crlf">{t('crlfWindows')}</option>
            </select>
          </div>

          <label className="flex items-center gap-2 border-l border-slate-200 pl-2">
            <input
              type="checkbox"
              checked={padRightOnSave}
              onChange={(e) => setPadRightOnSave(e.target.checked)}
              disabled={isDrawing || isSelecting}
            />
            <span>{t('padRightOnSave')}</span>
          </label>

          <div className="ml-auto text-xs text-slate-600">
            {t('ctrlCmdS')} · Ctrl/Cmd+O · Esc
          </div>
        </div>

        {lastError ? (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{lastError}</div>
        ) : null}

        <div className="relative min-h-0 flex-1">
          <div
            ref={viewportRef}
            className="h-full w-full select-none overflow-auto rounded border border-slate-300 bg-white outline-none"
            onPointerDown={(e) => {
              beginGesture(e)
              queueMicrotask(() => inputRef.current?.focus())
            }}
            onPointerMove={moveGesture}
            onPointerUp={endGesture}
            onPointerCancel={cancelPointerGesture}
            onContextMenu={(e) => {
              e.preventDefault()
              const el = e.currentTarget
              const metricsEl = preRef.current ?? el
              metricsRef.current = metricsRef.current ?? measureEditorElement(metricsEl)
              const m = metricsRef.current
              if (!m) return
              const clicked = cellFromClientPoint(e.clientX, e.clientY, el, m, { width: buffer.width, height: buffer.height })
              if (selectionRect && isCellInRect(selectionRect, clicked)) {
                setContextMenu({ open: true, x: e.clientX, y: e.clientY, at: clicked, inSelection: true })
                return
              }
              setContextMenu({ open: false, x: 0, y: 0, at: null, inSelection: false })
              pasteClipboardAt(clicked)
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="relative">
              <pre ref={preRef} className="p-3 font-mono text-xs text-slate-800" style={editorFontFamily ? { fontFamily: editorFontFamily } : undefined}>
                {renderText}
              </pre>
              {metrics && selectionRect ? (
                <div className="pointer-events-none absolute inset-0">
                  {Array.from({ length: selectionRect.bottom - selectionRect.top + 1 }, (_, i) => selectionRect.top + i).map((row) => (
                    <div
                      key={`sel-${row}`}
                      className="absolute bg-white mix-blend-difference"
                      style={{
                        left: metrics.paddingLeft + selectionRect.left * metrics.charWidth,
                        top: metrics.paddingTop + row * metrics.lineHeight,
                        width: (selectionRect.right - selectionRect.left + 1) * metrics.charWidth,
                        height: metrics.lineHeight
                      }}
                    />
                  ))}
                </div>
              ) : null}
              {metrics && findQueryLen > 0 && findMatches.length > 0 ? (
                <div className="pointer-events-none absolute inset-0">
                  {findMatches.map((m, i) => (
                    <div
                      key={`find-${m.row}-${m.col}-${i}`}
                      className="absolute bg-white/60 mix-blend-difference"
                      style={{
                        left: metrics.paddingLeft + m.col * metrics.charWidth,
                        top: metrics.paddingTop + m.row * metrics.lineHeight,
                        width: Math.max(0, Math.min(findQueryLen, buffer.width - m.col)) * metrics.charWidth,
                        height: metrics.lineHeight
                      }}
                    />
                  ))}
                </div>
              ) : null}
              {metrics && findMatch && findQueryLen > 0 ? (
                <div
                  className="pointer-events-none absolute bg-white mix-blend-difference"
                  style={{
                    left: metrics.paddingLeft + findMatch.col * metrics.charWidth,
                    top: metrics.paddingTop + findMatch.row * metrics.lineHeight,
                    width: Math.max(0, Math.min(findQueryLen, buffer.width - findMatch.col)) * metrics.charWidth,
                    height: metrics.lineHeight
                  }}
                />
              ) : null}
              {tool === 'text' && cursor && metrics ? (
                <div
                  className="pointer-events-none absolute z-20 bg-slate-800"
                  style={{
                    left: metrics.paddingLeft + cursor.col * metrics.charWidth,
                    top: metrics.paddingTop + cursor.row * metrics.lineHeight,
                    width: 2,
                    height: metrics.lineHeight
                  }}
                />
              ) : null}
            </div>
          </div>

          <textarea
            ref={inputRef}
            className="absolute left-0 top-0 h-px w-px opacity-0"
            style={editorFontFamily ? { fontFamily: editorFontFamily } : undefined}
            spellCheck={false}
            wrap="off"
            onCompositionStart={() => {
              if (tool !== 'text' || isDrawing || isSelecting) return
              composingRef.current = true
              setDraftBuffer(null)
            }}
            onCompositionEnd={(e) => {
              if (tool !== 'text' || isDrawing || isSelecting) return
              composingRef.current = false
              setDraftBuffer(null)
              e.currentTarget.value = ''
            }}
            onBeforeInput={(e) => {
              if (tool !== 'text' || isDrawing || isSelecting) return
              const viewport = viewportRef.current
              if (viewport) restoreViewportRef.current = { scrollTop: viewport.scrollTop, scrollLeft: viewport.scrollLeft }
              const ne = e.nativeEvent as InputEvent
              if (ne.inputType === 'insertCompositionText') return
              if (ne.inputType === 'insertText' && typeof ne.data === 'string' && ne.data) {
                e.preventDefault()
                composingRef.current = false
                applyOverwriteAt({ text: ne.data })
                return
              }
              if (ne.inputType === 'insertLineBreak') {
                e.preventDefault()
                composingRef.current = false
                applyEnter()
              }
            }}
            onKeyDown={(e) => {
              if (tool !== 'text' || isDrawing || isSelecting) return
              if (e.key === 'Backspace') {
                e.preventDefault()
                applyBackspace()
                return
              }
              if (e.key === 'Delete') {
                e.preventDefault()
                applyDelete()
                return
              }
              if (e.key === 'Enter') {
                e.preventDefault()
                applyEnter()
              }
            }}
            onPaste={(e) => {
              if (tool !== 'text' || isDrawing || isSelecting) return
              const text = e.clipboardData.getData('text')
              if (!text) return
              e.preventDefault()
              applyOverwriteAt({ text })
            }}
            onInput={(e) => {
              const el = e.currentTarget
              const v = el.value
              if (composingRef.current) {
                if (v && /^[\x20-\x7E]+$/.test(v)) {
                  composingRef.current = false
                  applyOverwriteAt({ text: v })
                  el.value = ''
                } else if (v.length > 64) {
                  el.value = ''
                }
                return
              }
              if (v && tool === 'text' && !isDrawing && !isSelecting && !composingRef.current) {
                applyOverwriteAt({ text: v })
              }
              el.value = ''
            }}
            onBlur={() => {
              composingRef.current = false
              setDraftBuffer(null)
            }}
          />
        </div>
      </div>
      <StatusBar language={language} newlineMode={exportNewline} filePath={filePath} />

      {contextMenu.open ? (
        <div
          ref={contextMenuRef}
          className="fixed z-50 w-44 rounded border border-slate-200 bg-white p-1 text-sm shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setContextMenu({ open: false, x: 0, y: 0, at: null, inSelection: false })
              copySelection()
            }}
          >
            <span>{t('copy')}</span>
            <span className="text-xs text-slate-400">Ctrl+C</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setContextMenu({ open: false, x: 0, y: 0, at: null, inSelection: false })
              cutSelection()
            }}
          >
            <span>{t('cut')}</span>
            <span className="text-xs text-slate-400">Ctrl+X</span>
          </button>
        </div>
      ) : null}

      {isFindOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeFindReplace()
          }}
        >
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="text-sm font-semibold text-slate-800">{t('find')}</div>
              <button
                type="button"
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                onClick={closeFindReplace}
              >
                {t('close')}
              </button>
            </div>
            <div
              className="px-4 py-4"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  closeFindReplace()
                  return
                }
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (e.shiftKey) findPrev()
                  else findNext()
                }
              }}
            >
              <label className="mb-3 block text-xs font-semibold text-slate-700">{t('search')}</label>
              <input
                ref={findInputRef}
                value={findQuery}
                onChange={(e) => setFindQuery(e.target.value)}
                className="mb-4 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              />
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-slate-500 tabular-nums">
                  {(currentFindIndex ?? -1) + 1}/{findMatches.length}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => findPrev()}
                    disabled={findMatches.length === 0}
                  >
                    {t('findPrev')}
                  </button>
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => findNext()}
                  disabled={findMatches.length === 0}
                >
                  {t('findNext')}
                </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isReplaceOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeFindReplace()
          }}
        >
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="text-sm font-semibold text-slate-800">{t('replace')}</div>
              <button
                type="button"
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                onClick={closeFindReplace}
              >
                {t('close')}
              </button>
            </div>
            <div
              className="px-4 py-4"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  closeFindReplace()
                  return
                }
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (e.shiftKey) replacePrev()
                  else replaceNext()
                }
              }}
            >
              <label className="mb-1 block text-xs font-semibold text-slate-700">{t('search')}</label>
              <input
                value={findQuery}
                onChange={(e) => setFindQuery(e.target.value)}
                className="mb-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              />
              <label className="mb-1 block text-xs font-semibold text-slate-700">{t('replaceWith')}</label>
              <input
                ref={replaceInputRef}
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                className="mb-4 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => findPrev()}
                  disabled={findMatches.length === 0}
                >
                  {t('findPrev')}
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => replacePrev()}
                  disabled={findMatches.length === 0}
                >
                  {t('replacePrev')}
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => findNext()}
                  disabled={findMatches.length === 0}
                >
                  {t('findNext')}
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={replaceNext}
                  disabled={findMatches.length === 0}
                >
                  {t('replaceNext')}
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={replaceAll}
                  disabled={findMatches.length === 0}
                >
                  {t('replaceAll')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isNewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="text-sm font-semibold text-slate-800">{t('newBuffer')}</div>
              <button
                type="button"
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                onClick={() => setIsNewOpen(false)}
              >
                {t('close')}
              </button>
            </div>
            <div className="px-4 py-4">
              <div className="mb-3 flex flex-wrap gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      newBuffer(t.width, t.height)
                      setIsNewOpen(false)
                      queueMicrotask(() => inputRef.current?.focus())
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-xs font-semibold text-slate-700">{t('custom')}</div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                  <label className="flex items-center gap-2">
                    <span>{t('width')}</span>
                    <input
                      type="number"
                      min={1}
                      max={2000}
                      value={customWidth}
                      onChange={(e) => setCustomWidth(clampInt(Number(e.target.value), 1, 2000))}
                      className="w-24 rounded border border-slate-300 bg-white px-2 py-1"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <span>{t('height')}</span>
                    <input
                      type="number"
                      min={1}
                      max={2000}
                      value={customHeight}
                      onChange={(e) => setCustomHeight(clampInt(Number(e.target.value), 1, 2000))}
                      className="w-24 rounded border border-slate-300 bg-white px-2 py-1"
                    />
                  </label>
                  <button
                    type="button"
                    className="ml-auto rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      newBuffer(customWidth, customHeight)
                      setIsNewOpen(false)
                      queueMicrotask(() => inputRef.current?.focus())
                    }}
                  >
                    {t('create')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
