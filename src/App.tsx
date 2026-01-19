import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { writeText as writeClipboardText } from '@tauri-apps/plugin-clipboard-manager'
import { bufferToText, selectActiveBuffer, useEditorStore } from './store/editorStore'
import { CONTINUATION_CELL, cellDisplayWidth, cellLength, cloneLines, getCellAt, padCells, setCharInLines, toCells, toDisplayText, toInternalText, type Layer } from './core/cells'
import { compositeBuffers } from './core/composition'
import { insertBlankFigure } from './core/figureInsert'
import { dirname, ensureDefaultExtension, isValidSavePath, joinPath, normalizeForClipboard, normalizeForSave, stripUtf8Bom } from './core/textIo'

type BufferTemplate = '80x24' | '120x80' | '160x100'

const TEMPLATES: Array<{ id: BufferTemplate; width: number; height: number; label: string }> = [
  { id: '80x24', width: 80, height: 24, label: '80×24' },
  { id: '120x80', width: 120, height: 80, label: '120×80' },
  { id: '160x100', width: 160, height: 100, label: '160×100' }
]

type ExportNewline = 'lf' | 'crlf'

type Language = 'ko' | 'en' | 'ja' | 'zh-Hant' | 'zh-Hans'

type ThemeId = 'light' | 'dark' | 'monokai' | 'kimble-dark' | 'dracula' | 'nord' | 'solarized-light' | 'solarized-dark'

type ThemeSetting = ThemeId | 'system'

type TextKey =
  | 'menuFile'
  | 'menuEdit'
  | 'menuHelp'
  | 'settings'
  | 'language'
  | 'theme'
  | 'themeSystem'
  | 'themeLight'
  | 'themeDark'
  | 'themeMonokai'
  | 'themeKimbleDark'
  | 'themeDracula'
  | 'themeNord'
  | 'themeSolarizedLight'
  | 'themeSolarizedDark'
  | 'open'
  | 'loadError'
  | 'saveError'
  | 'overwriteConfirm'
  | 'clipboardError'
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
  | 'insert'
  | 'insertFigure'
  | 'new'
  | 'save'
  | 'saveAs'
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
  | 'recentFiles'
  | 'clearRecent'
  | 'pinnedFiles'
  | 'manageRecent'
  | 'pin'
  | 'unpin'
  | 'toastThemeApplied'
  | 'toastLanguageApplied'
  | 'invalidSavePath'
  | 'layers'
  | 'addLayer'
  | 'removeLayer'
  | 'renameLayer'
  | 'visible'
  | 'locked'

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
    theme: '테마',
    themeSystem: '시스템',
    themeLight: '라이트',
    themeDark: '다크',
    themeMonokai: '모노카이',
    themeKimbleDark: '킴블 다크',
    themeDracula: '드라큘라',
    themeNord: '노르드',
    themeSolarizedLight: '솔라라이즈드 라이트',
    themeSolarizedDark: '솔라라이즈드 다크',
    open: '열기',
    loadError: '파일을 불러오지 못했습니다.',
    saveError: '파일을 저장하지 못했습니다.',
    overwriteConfirm: '기존 파일을 덮어쓰시겠습니까?',
    clipboardError: '클립보드에 복사하지 못했습니다.',
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
    insert: '삽입',
    insertFigure: '그림 삽입',
    new: '새로 만들기',
    save: '저장',
    saveAs: '다른 이름으로 저장',
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
    buffer: '버퍼',
    recentFiles: '최근 파일',
    clearRecent: '최근 파일 비우기',
    pinnedFiles: '고정된 파일',
    manageRecent: '최근 파일 관리',
    pin: '핀',
    unpin: '핀 해제',
    toastThemeApplied: '테마가 적용되었습니다.',
    toastLanguageApplied: '언어가 적용되었습니다.',
    invalidSavePath: '저장 경로 또는 파일명이 올바르지 않습니다.',
    layers: '레이어',
    addLayer: '레이어 추가',
    removeLayer: '레이어 삭제',
    renameLayer: '이름 변경',
    visible: '보이기',
    locked: '잠금'
  },
  en: {
    menuFile: 'File',
    menuEdit: 'Edit',
    menuHelp: 'Help',
    settings: 'Settings',
    language: 'Language',
    theme: 'Theme',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeMonokai: 'Monokai',
    themeKimbleDark: 'Kimble Dark',
    themeDracula: 'Dracula',
    themeNord: 'Nord',
    themeSolarizedLight: 'Solarized Light',
    themeSolarizedDark: 'Solarized Dark',
    open: 'Open',
    loadError: 'Failed to load file.',
    saveError: 'Failed to save file.',
    overwriteConfirm: 'Overwrite the existing file?',
    clipboardError: 'Failed to copy to clipboard.',
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
    insert: 'Insert',
    insertFigure: 'Insert figure',
    new: 'New',
    save: 'Save',
    saveAs: 'Save As',
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
    buffer: 'Buffer',
    recentFiles: 'Recent files',
    clearRecent: 'Clear recent files',
    pinnedFiles: 'Pinned files',
    manageRecent: 'Manage recent files',
    pin: 'Pin',
    unpin: 'Unpin',
    toastThemeApplied: 'Theme applied.',
    toastLanguageApplied: 'Language applied.',
    invalidSavePath: 'The save path or file name is invalid.',
    layers: 'Layers',
    addLayer: 'Add Layer',
    removeLayer: 'Remove Layer',
    renameLayer: 'Rename',
    visible: 'Visible',
    locked: 'Locked'
  },
  ja: {
    menuFile: 'ファイル',
    menuEdit: '編集',
    menuHelp: 'ヘルプ',
    settings: '設定',
    language: '言語',
    theme: 'テーマ',
    themeSystem: 'システム',
    themeLight: 'ライト',
    themeDark: 'ダーク',
    themeMonokai: 'Monokai',
    themeKimbleDark: 'Kimble Dark',
    themeDracula: 'Dracula',
    themeNord: 'Nord',
    themeSolarizedLight: 'Solarized Light',
    themeSolarizedDark: 'Solarized Dark',
    open: '開く',
    loadError: 'ファイルを読み込めませんでした。',
    saveError: 'ファイルを保存できませんでした。',
    overwriteConfirm: '既存のファイルを上書きしますか？',
    clipboardError: 'クリップボードにコピーできませんでした。',
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
    insert: '挿入',
    insertFigure: '図を挿入',
    new: '新規',
    save: '保存',
    saveAs: '名前を付けて保存',
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
    buffer: 'バッファ',
    recentFiles: '最近のファイル',
    clearRecent: '最近のファイルをクリア',
    pinnedFiles: 'ピン留め',
    manageRecent: '最近のファイルを管理',
    pin: 'ピン留め',
    unpin: 'ピン留め解除',
    toastThemeApplied: 'テーマを適用しました。',
    toastLanguageApplied: '言語を適用しました。',
    invalidSavePath: '保存先のパスまたはファイル名が正しくありません。',
    layers: 'レイヤー',
    addLayer: 'レイヤー追加',
    removeLayer: 'レイヤー削除',
    renameLayer: '名前変更',
    visible: '表示',
    locked: 'ロック'
  },
  'zh-Hant': {
    menuFile: '檔案',
    menuEdit: '編輯',
    menuHelp: '說明',
    settings: '設定',
    language: '語言',
    theme: '主題',
    themeSystem: '系統',
    themeLight: '淺色',
    themeDark: '深色',
    themeMonokai: 'Monokai',
    themeKimbleDark: 'Kimble Dark',
    themeDracula: 'Dracula',
    themeNord: 'Nord',
    themeSolarizedLight: 'Solarized Light',
    themeSolarizedDark: 'Solarized Dark',
    open: '開啟',
    loadError: '無法載入檔案。',
    saveError: '無法儲存檔案。',
    overwriteConfirm: '要覆寫既有檔案嗎？',
    clipboardError: '無法複製到剪貼簿。',
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
    insert: '插入',
    insertFigure: '插入圖片',
    new: '新增',
    save: '儲存',
    saveAs: '另存新檔',
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
    buffer: '緩衝區',
    recentFiles: '最近檔案',
    clearRecent: '清除最近檔案',
    pinnedFiles: '已釘選檔案',
    manageRecent: '管理最近檔案',
    pin: '釘選',
    unpin: '取消釘選',
    toastThemeApplied: '已套用主題。',
    toastLanguageApplied: '已套用語言。',
    invalidSavePath: '儲存路徑或檔名不正確。',
    layers: '圖層',
    addLayer: '新增圖層',
    removeLayer: '刪除圖層',
    renameLayer: '重新命名',
    visible: '顯示',
    locked: '鎖定'
  },
  'zh-Hans': {
    menuFile: '文件',
    menuEdit: '编辑',
    menuHelp: '帮助',
    settings: '设置',
    language: '语言',
    theme: '主题',
    themeSystem: '系统',
    themeLight: '浅色',
    themeDark: '深色',
    themeMonokai: 'Monokai',
    themeKimbleDark: 'Kimble Dark',
    themeDracula: 'Dracula',
    themeNord: 'Nord',
    themeSolarizedLight: 'Solarized Light',
    themeSolarizedDark: 'Solarized Dark',
    open: '打开',
    loadError: '无法加载文件。',
    saveError: '无法保存文件。',
    overwriteConfirm: '要覆盖现有文件吗？',
    clipboardError: '无法复制到剪贴板。',
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
    insert: '插入',
    insertFigure: '插入图片',
    new: '新建',
    save: '保存',
    saveAs: '另存为',
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
    buffer: '缓冲区',
    recentFiles: '最近文件',
    clearRecent: '清空最近文件',
    pinnedFiles: '已固定文件',
    manageRecent: '管理最近文件',
    pin: '固定',
    unpin: '取消固定',
    toastThemeApplied: '主题已应用。',
    toastLanguageApplied: '语言已应用。',
    invalidSavePath: '保存路径或文件名无效。',
    layers: '图层',
    addLayer: '新建图层',
    removeLayer: '删除图层',
    renameLayer: '重命名',
    visible: '显示',
    locked: '锁定'
  }
}

function normalizeNewlines(text: string, mode: ExportNewline) {
  const lf = text.replace(/\r\n/g, '\n')
  return mode === 'crlf' ? lf.replace(/\n/g, '\r\n') : lf
}

function dialogPathToString(picked: unknown): string | null {
  if (typeof picked === 'string') return picked
  if (picked && typeof picked === 'object') {
    const v = (picked as { path?: unknown }).path
    if (typeof v === 'string') return v
  }
  return null
}

function clampInt(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min
  return Math.max(min, Math.min(max, Math.floor(v)))
}

type ToolMode = 'text' | 'select' | 'rect' | 'line' | 'arrow' | 'free'

type Cell = { row: number; col: number }

type TextMetrics = { charWidth: number; lineHeight: number; paddingLeft: number; paddingTop: number }

type Rect = { top: number; left: number; bottom: number; right: number }

type BlockClipboard = { width: number; height: number; lines: string[]; origin: Cell }

type ClipboardState = { current: BlockClipboard | null; history: BlockClipboard[] }

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

function getRawCellAt(lines: string[], row: number, col: number) {
  const line = lines[row] ?? ''
  return getCellAt(line, col)
}

function copyRectFromBuffer(base: { width: number; height: number; lines: string[] }, rect: Rect, originCell?: Cell): BlockClipboard | null {
  const { width, height } = rectSize(rect)
  if (width <= 0 || height <= 0) return null
  const out: string[] = []
  for (let r = rect.top; r <= rect.bottom; r += 1) {
    let s = ''
    for (let c = rect.left; c <= rect.right; c += 1) s += getRawCellAt(base.lines, r, c)
    out.push(s)
  }
  const o = originCell ?? { row: rect.top, col: rect.left }
  const origin = { row: clampInt(o.row - rect.top, 0, height - 1), col: clampInt(o.col - rect.left, 0, width - 1) }
  return { width, height, lines: out, origin }
}

function applyRectFill(base: { width: number; height: number; lines: string[] }, rect: Rect, fillChar: string) {
  const lines = cloneLines(base.lines, base.height)
  for (let r = rect.top; r <= rect.bottom; r += 1) {
    for (let c = rect.left; c <= rect.right; c += 1) setCharInLines(lines, r, c, fillChar, base.width)
  }
  return { ...base, lines }
}

function pasteRectIntoBuffer(base: { width: number; height: number; lines: string[] }, at: Cell, clip: BlockClipboard | null) {
  if (!clip) return base
  const topLeft = at
  const lines = cloneLines(base.lines, base.height)
  for (let r = 0; r < clip.height; r += 1) {
    const rowCells = toCells(clip.lines[r] ?? '')
    for (let c = 0; c < clip.width; c += 1) {
      const row = topLeft.row + r
      const col = topLeft.col + c
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

function snapToDevicePx(v: number) {
  const dpr = typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1
  return Math.round(v * dpr) / dpr
}

function chooseEditorFontFamily(el: HTMLElement) {
  if (navigator.userAgent.includes('jsdom')) return null
  const cs = window.getComputedStyle(el)
  const canvas = document.createElement('canvas')
  let ctx: CanvasRenderingContext2D | null = null
  try {
    ctx = canvas.getContext('2d')
  } catch {
    return null
  }
  if (!ctx) return null
  const fontPrefix = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize}`
  const samples = [' ', 'M', '0', 'A', '─', '│', '┌', '┐', '└', '┘', '가', '한', '中', '日', '🙂']
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
  const measureRun = (glyph: string, count: number) => {
    span.textContent = glyph.repeat(count)
    const r = span.getBoundingClientRect()
    const w = r.width / count
    return Number.isFinite(w) && w > 0 ? w : 0
  }
  const runCount = 64
  const widths = [measureRun(' ', runCount), measureRun('0', runCount), measureRun('M', runCount), measureRun('─', runCount), measureRun('│', runCount)]
    .filter((v) => v > 0)
    .sort((a, b) => a - b)
  const charWidth = widths.length > 0 ? widths[Math.floor(widths.length / 2)] : 0
  span.textContent = Array.from({ length: 6 }, () => 'M').join('\n')
  const lhRect = span.getBoundingClientRect()
  const lineHeight = lhRect.height / 6
  document.body.removeChild(span)
  if (!(charWidth > 0) || !(lineHeight > 0)) return null
  return {
    charWidth: snapToDevicePx(charWidth),
    lineHeight: snapToDevicePx(lineHeight),
    paddingLeft: snapToDevicePx(parsePx(cs.paddingLeft)),
    paddingTop: snapToDevicePx(parsePx(cs.paddingTop))
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
  theme: 'txeditor.theme',
  exportNewline: 'txeditor.exportNewline',
  padRightOnSave: 'txeditor.padRightOnSave.v2',
  drawStyle: 'txeditor.drawStyle',
  filePath: 'txeditor.filePath',
  recentFiles: 'txeditor.recentFiles',
  pinnedFiles: 'txeditor.pinnedFiles'
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

function removeStorage(key: string) {
  try {
    localStorage.removeItem(key)
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

function normalizePathList(list: string[], limit: number) {
  const out: string[] = []
  for (const v of list) {
    if (typeof v !== 'string') continue
    if (!v.trim()) continue
    if (out.includes(v)) continue
    out.push(v)
    if (out.length >= limit) break
  }
  return out
}

function readPathList(key: string, limit: number) {
  const raw = safeJsonParse<unknown>(readStorage(key))
  if (!Array.isArray(raw)) return []
  return normalizePathList(raw.filter((v) => typeof v === 'string') as string[], limit)
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
  | 'chevronRight'
  | 'chevronLeft'
  | 'check'
  | 'layers'
  | 'add'
  | 'close'
  | 'visible'
  | 'hidden'
  | 'lock'
  | 'unlock'

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
  if (name === 'chevronRight')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path {...common} d="M9 6l6 6-6 6" />
      </svg>
    )
  if (name === 'chevronLeft')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path {...common} d="M15 6l-6 6 6 6" />
      </svg>
    )
  if (name === 'check')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path {...common} d="M20 6L9 17l-5-5" />
      </svg>
    )
  if (name === 'layers')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path {...common} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    )
  if (name === 'add')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path {...common} d="M12 5v14M5 12h14" />
      </svg>
    )
  if (name === 'close')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path {...common} d="M6 18L18 6M6 6l12 12" />
      </svg>
    )
  if (name === 'visible')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path {...common} d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle {...common} cx="12" cy="12" r="3" />
      </svg>
    )
  if (name === 'hidden')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path {...common} d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" />
      </svg>
    )
  if (name === 'lock')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <rect {...common} x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path {...common} d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    )
  if (name === 'unlock')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <rect {...common} x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path {...common} d="M7 11V7a5 5 0 0 1 9.9-1" />
      </svg>
    )
  if (name === 'text')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path {...common} d="M7 20L12 4l5 16" />
        <path {...common} d="M9.5 13h5" />
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
      className={`group relative flex h-8 w-8 items-center justify-center rounded border border-[var(--ui-border)] text-[var(--ui-text)] ${
        active ? 'bg-[var(--ui-surface-2)]' : 'bg-[var(--ui-surface)] hover:bg-[var(--ui-surface-2)]'
      } disabled:opacity-40`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      <Icon name={icon} />
      <div className="pointer-events-none absolute left-1/2 top-full z-20 hidden -translate-x-1/2 whitespace-nowrap rounded border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2 py-1 text-[11px] text-[var(--ui-text)] shadow-[var(--ui-shadow-sm)] group-hover:block group-focus-visible:block">
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
  trigger: ReactNode
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
        className="rounded px-2 py-1 text-sm text-[var(--ui-text)] hover:bg-[var(--ui-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] disabled:opacity-40 disabled:hover:bg-transparent"
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
          className={`absolute top-full z-30 mt-1 min-w-56 rounded border border-[var(--ui-border)] bg-[var(--ui-surface)] p-1 shadow-[var(--ui-shadow-md)] ${
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
              className="flex w-full items-center justify-between gap-6 rounded px-2 py-1.5 text-left text-sm text-[var(--ui-text)] hover:bg-[var(--ui-surface-2)] disabled:opacity-40"
              disabled={it.disabled}
              onClick={() => {
                setOpen(false)
                it.onSelect()
              }}
            >
              <span>{it.label}</span>
              <span className="text-xs text-[var(--ui-text-dim)]">{it.shortcut ?? ''}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

type SettingsPage = 'root' | 'theme' | 'language'

function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return
    const id = window.setTimeout(() => onDone(), 1600)
    return () => window.clearTimeout(id)
  }, [message, onDone])

  if (!message) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto rounded border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2 text-sm text-[var(--ui-text)] shadow-[var(--ui-shadow-md)]">
        {message}
      </div>
    </div>
  )
}

function SettingsModal({
  open,
  language,
  themeSetting,
  onThemeChange,
  onLanguageChange,
  onClose
}: {
  open: boolean
  language: Language
  themeSetting: ThemeSetting
  onThemeChange: (theme: ThemeSetting) => void
  onLanguageChange: (lang: Language) => void
  onClose: () => void
}) {
  const t = useCallback((key: TextKey) => TEXT[language][key], [language])
  const [page, setPage] = useState<SettingsPage>('root')
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    setPage('root')
    queueMicrotask(() => closeBtnRef.current?.focus())
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open) return null

  const themeLabel = (v: ThemeSetting) => {
    if (v === 'system') return t('themeSystem')
    if (v === 'light') return t('themeLight')
    if (v === 'dark') return t('themeDark')
    if (v === 'monokai') return t('themeMonokai')
    if (v === 'kimble-dark') return t('themeKimbleDark')
    if (v === 'dracula') return t('themeDracula')
    if (v === 'nord') return t('themeNord')
    if (v === 'solarized-light') return t('themeSolarizedLight')
    return t('themeSolarizedDark')
  }

  const card = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('settings')}
      className="w-full max-w-md rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-[var(--ui-shadow-md)]"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-[var(--ui-border)] px-4 py-3">
        <div className="text-base font-semibold text-[var(--ui-text)]">{t('settings')}</div>
        <button
          ref={closeBtnRef}
          type="button"
          className="rounded px-3 py-2 text-sm text-[var(--ui-text)] hover:bg-[var(--ui-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
          onClick={onClose}
        >
          {t('close')}
        </button>
      </div>

      {page === 'root' ? (
        <div className="p-3">
          <div className="space-y-2">
            <button
              type="button"
              className="flex h-12 w-full items-center justify-between rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-left text-[var(--ui-text)] hover:bg-[var(--ui-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
              onClick={() => setPage('theme')}
            >
              <div className="flex min-w-0 items-center gap-2">
                <div className="font-medium">{t('theme')}</div>
                <div className="truncate text-sm text-[var(--ui-text-dim)]">{themeLabel(themeSetting)}</div>
              </div>
              <Icon name="chevronRight" />
            </button>

            <button
              type="button"
              className="flex h-12 w-full items-center justify-between rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-left text-[var(--ui-text)] hover:bg-[var(--ui-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
              onClick={() => setPage('language')}
            >
              <div className="flex min-w-0 items-center gap-2">
                <div className="font-medium">{t('language')}</div>
                <div className="truncate text-sm text-[var(--ui-text-dim)]">{LANGUAGE_LABELS[language]}</div>
              </div>
              <Icon name="chevronRight" />
            </button>
          </div>
        </div>
      ) : null}

      {page === 'theme' ? (
        <div className="p-3">
          <div className="flex items-center gap-2 px-1 pb-2">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-[var(--ui-text)] hover:bg-[var(--ui-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
              onClick={() => setPage('root')}
              aria-label={t('close')}
            >
              <Icon name="chevronLeft" />
            </button>
            <div className="text-sm font-semibold text-[var(--ui-text)]">{t('theme')}</div>
          </div>
          <div className="space-y-2">
            {(
              [
                { id: 'system', label: t('themeSystem') },
                { id: 'light', label: t('themeLight') },
                { id: 'dark', label: t('themeDark') },
                { id: 'monokai', label: t('themeMonokai') },
                { id: 'kimble-dark', label: t('themeKimbleDark') },
                { id: 'dracula', label: t('themeDracula') },
                { id: 'nord', label: t('themeNord') },
                { id: 'solarized-light', label: t('themeSolarizedLight') },
                { id: 'solarized-dark', label: t('themeSolarizedDark') }
              ] as Array<{ id: ThemeSetting; label: string }>
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="flex h-12 w-full items-center justify-between rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-left text-[var(--ui-text)] hover:bg-[var(--ui-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
                onClick={() => onThemeChange(opt.id)}
              >
                <div className="text-sm font-medium">{opt.label}</div>
                {themeSetting === opt.id ? <Icon name="check" /> : <span className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {page === 'language' ? (
        <div className="p-3">
          <div className="flex items-center gap-2 px-1 pb-2">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-[var(--ui-text)] hover:bg-[var(--ui-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
              onClick={() => setPage('root')}
              aria-label={t('close')}
            >
              <Icon name="chevronLeft" />
            </button>
            <div className="text-sm font-semibold text-[var(--ui-text)]">{t('language')}</div>
          </div>
          <div className="space-y-2">
            {(Object.keys(LANGUAGE_LABELS) as Language[]).map((lang) => (
              <button
                key={lang}
                type="button"
                className="flex h-12 w-full items-center justify-between rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-left text-[var(--ui-text)] hover:bg-[var(--ui-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
                onClick={() => onLanguageChange(lang)}
              >
                <div className="text-sm font-medium">{LANGUAGE_LABELS[lang]}</div>
                {language === lang ? <Icon name="check" /> : <span className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )

  return (
    <div className="fixed inset-0 z-40" onPointerDown={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative flex h-full w-full items-end justify-center p-4 sm:items-center">{card}</div>
    </div>
  )
}

function ManageRecentModal({
  open,
  language,
  pinnedFiles,
  recentFiles,
  onOpenPath,
  onTogglePin,
  onRemovePath,
  onClearRecent,
  onClose
}: {
  open: boolean
  language: Language
  pinnedFiles: string[]
  recentFiles: string[]
  onOpenPath: (path: string) => void
  onTogglePin: (path: string) => void
  onRemovePath: (path: string) => void
  onClearRecent: () => void
  onClose: () => void
}) {
  const t = useCallback((key: TextKey) => TEXT[language][key], [language])
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => closeBtnRef.current?.focus())
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open) return null

  const row = (path: string) => {
    const isPinned = pinnedFiles.includes(path)
    return (
      <div key={path} className="flex items-center gap-2 rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2">
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left text-sm text-[var(--ui-text)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
          onClick={() => {
            onClose()
            onOpenPath(path)
          }}
          title={path}
        >
          {basename(path)}
        </button>
        <button
          type="button"
          className="rounded px-2 py-1 text-xs text-[var(--ui-text)] hover:bg-[var(--ui-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
          onClick={() => onTogglePin(path)}
        >
          {isPinned ? t('unpin') : t('pin')}
        </button>
        <button
          type="button"
          className="rounded px-2 py-1 text-xs text-[var(--ui-text)] hover:bg-[var(--ui-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
          onClick={() => onRemovePath(path)}
        >
          {t('delete')}
        </button>
      </div>
    )
  }

  const card = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('manageRecent')}
      className="w-full max-w-lg rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-[var(--ui-shadow-md)]"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-[var(--ui-border)] px-4 py-3">
        <div className="text-base font-semibold text-[var(--ui-text)]">{t('manageRecent')}</div>
        <button
          ref={closeBtnRef}
          type="button"
          className="rounded px-3 py-2 text-sm text-[var(--ui-text)] hover:bg-[var(--ui-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
          onClick={onClose}
        >
          {t('close')}
        </button>
      </div>

      <div className="space-y-4 p-4">
        {pinnedFiles.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[var(--ui-text-dim)]">{t('pinnedFiles')}</div>
            {pinnedFiles.slice(0, 10).map((p) => row(p))}
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-[var(--ui-text-dim)]">{t('recentFiles')}</div>
            <button
              type="button"
              className="rounded px-2 py-1 text-xs text-[var(--ui-text)] hover:bg-[var(--ui-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] disabled:opacity-40"
              disabled={recentFiles.length === 0}
              onClick={onClearRecent}
            >
              {t('clearRecent')}
            </button>
          </div>
          {recentFiles.length > 0 ? recentFiles.slice(0, 10).map((p) => row(p)) : <div className="text-sm text-[var(--ui-text-dim)]">-</div>}
        </div>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-40" onPointerDown={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative flex h-full w-full items-end justify-center p-4 sm:items-center">{card}</div>
    </div>
  )
}

function MenuBar({
  language,
  onOpen,
  onNew,
  onSave,
  onSaveAs,
  pinnedFiles,
  recentFiles,
  onOpenRecent,
  onClearRecent,
  onManageRecent,
  onUndo,
  onRedo,
  onCopy,
  onCut,
  onPaste,
  onInsertFigure,
  onFind,
  onReplace,
  onOpenSettings
}: {
  language: Language
  onOpen: () => void
  onNew: () => void
  onSave: () => void
  onSaveAs: () => void
  pinnedFiles: string[]
  recentFiles: string[]
  onOpenRecent: (path: string) => void
  onClearRecent: () => void
  onManageRecent: () => void
  onUndo: () => void
  onRedo: () => void
  onCopy: () => void
  onCut: () => void
  onPaste: () => void
  onInsertFigure: () => void
  onFind: () => void
  onReplace: () => void
  onOpenSettings: () => void
}) {
  const t = useCallback((key: TextKey) => TEXT[language][key], [language])
  return (
    <div className="flex h-12 items-center gap-2 border-b border-[var(--ui-border)] bg-[var(--ui-surface)] px-3">
      <div className="mr-2 font-semibold text-[var(--ui-text)]">TxEditor</div>
      <DropdownMenu
        label={t('menuFile')}
        trigger={<span>{t('menuFile')}</span>}
        items={[
          { label: t('new'), shortcut: 'Ctrl+N', onSelect: onNew },
          { label: t('open'), shortcut: 'Ctrl+O', onSelect: onOpen },
          { label: t('save'), shortcut: 'Ctrl+S', onSelect: onSave },
          { label: t('saveAs'), shortcut: 'Ctrl+Shift+S', onSelect: onSaveAs },
          ...(pinnedFiles.length > 0 ? [{ label: t('pinnedFiles'), disabled: true, onSelect: () => {} }] : []),
          ...pinnedFiles.slice(0, 10).map((p, idx) => ({
            label: `${idx + 1}. ${basename(p)}`,
            onSelect: () => onOpenRecent(p)
          })),
          ...(recentFiles.length > 0 ? [{ label: t('recentFiles'), disabled: true, onSelect: () => {} }] : []),
          ...recentFiles.slice(0, 10).map((p, idx) => ({
            label: `${idx + 1}. ${basename(p)}`,
            onSelect: () => onOpenRecent(p)
          })),
          { label: t('manageRecent'), onSelect: onManageRecent },
          ...(recentFiles.length > 0 ? [{ label: t('clearRecent'), onSelect: onClearRecent }] : [])
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
          { label: t('insertFigure'), shortcut: 'Ctrl+Shift+I', onSelect: onInsertFigure },
          { label: t('find'), shortcut: 'Ctrl+F', onSelect: onFind },
          { label: t('replace'), shortcut: 'Ctrl+H', onSelect: onReplace }
        ]}
      />
      <DropdownMenu label={t('menuHelp')} trigger={<span>{t('menuHelp')}</span>} items={[]} />
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-text)] hover:bg-[var(--ui-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
          onClick={onOpenSettings}
          aria-label={t('settings')}
        >
          <Icon name="gear" />
        </button>
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
  const buffer = useEditorStore(selectActiveBuffer)
  const cursor = useEditorStore((s) => s.cursor)
  const row = cursor ? cursor.row + 1 : null
  const col = cursor ? cursor.col + 1 : null
  return (
    <div className="flex h-8 items-center justify-between border-t border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-xs text-[var(--ui-text-muted)]">
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

function snapColToCellStart(line: string, col: number, width: number) {
  let c = clampInt(col, 0, Math.max(0, width - 1))
  while (c > 0 && getCellAt(line, c) === CONTINUATION_CELL) c -= 1
  return c
}

function snapCursorToCellStartInBuffer(buffer: { width: number; height: number; lines: string[] }, pos: Cell) {
  const row = clampInt(pos.row, 0, buffer.height - 1)
  const col = clampInt(pos.col, 0, buffer.width - 1)
  const line = buffer.lines[row] ?? ''
  return { row, col: snapColToCellStart(line, col, buffer.width) }
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
  const startCol = snapColToCellStart(line, col, width)
  setCharInLines(lines, row, startCol, ' ', width)
  clearContinuationRight(lines, row, startCol, width)
  return startCol
}

type BoxBounds = {
  left: number
  right: number
  top: number
  bottom: number
  leftInner: number
  rightInner: number
  topInner: number
  bottomInner: number
}

function findEnclosingBoxBounds(lines: string[], width: number, height: number, at: Cell): BoxBounds | null {
  const row = clampInt(at.row, 0, height - 1)
  const col = clampInt(at.col, 0, width - 1)

  const isWall = (ch: string) => ch === '|' || ch === '│' || ch === '+' || ch === '┌' || ch === '┐' || ch === '└' || ch === '┘'
  const isH = (ch: string) => ch === '-' || ch === '─'
  const isTopLeft = (ch: string) => ch === '+' || ch === '┌'
  const isTopRight = (ch: string) => ch === '+' || ch === '┐'
  const isBottomLeft = (ch: string) => ch === '+' || ch === '└'
  const isBottomRight = (ch: string) => ch === '+' || ch === '┘'

  const scanWall = (dir: -1 | 1) => {
    let c = col
    while (c >= 0 && c < width) {
      const ch = getCharAt(lines, row, c)
      if (isWall(ch)) return c
      c += dir
    }
    return null
  }

  const leftWall = scanWall(-1)
  const rightWall = scanWall(1)
  if (leftWall == null || rightWall == null) return null
  if (rightWall - leftWall < 2) return null

  const isTopBorderRow = (r: number) => {
    const l = getCharAt(lines, r, leftWall)
    const rr = getCharAt(lines, r, rightWall)
    if (!isTopLeft(l) || !isTopRight(rr)) return false
    for (let c = leftWall + 1; c <= rightWall - 1; c += 1) {
      const ch = getCharAt(lines, r, c)
      if (!isH(ch)) return false
    }
    return true
  }

  const isBottomBorderRow = (r: number) => {
    const l = getCharAt(lines, r, leftWall)
    const rr = getCharAt(lines, r, rightWall)
    if (!isBottomLeft(l) || !isBottomRight(rr)) return false
    for (let c = leftWall + 1; c <= rightWall - 1; c += 1) {
      const ch = getCharAt(lines, r, c)
      if (!isH(ch)) return false
    }
    return true
  }

  let top: number | null = null
  for (let r = row; r >= 0; r -= 1) {
    if (isTopBorderRow(r)) {
      top = r
      break
    }
  }

  let bottom: number | null = null
  for (let r = row; r < height; r += 1) {
    if (isBottomBorderRow(r)) {
      bottom = r
      break
    }
  }

  if (top == null || bottom == null) return null

  const bounds: BoxBounds = {
    left: leftWall,
    right: rightWall,
    top,
    bottom,
    leftInner: leftWall + 1,
    rightInner: rightWall - 1,
    topInner: top + 1,
    bottomInner: bottom - 1
  }

  if (bounds.leftInner > bounds.rightInner) return null
  if (bounds.topInner > bounds.bottomInner) return null
  if (row < bounds.topInner || row > bounds.bottomInner) return null
  if (col < bounds.leftInner || col > bounds.rightInner) return null
  return bounds
}

function overwriteTextIntoBuffer(
  base: { width: number; height: number; lines: string[] },
  at: Cell,
  text: string
): { next: { width: number; height: number; lines: string[] }; cursor: Cell } {
  const lines = cloneLines(base.lines, base.height)
  let row = clampInt(at.row, 0, base.height - 1)
  let col = clampInt(at.col, 0, base.width - 1)
  col = snapColToCellStart(lines[row] ?? '', col, base.width)
  const bounds = findEnclosingBoxBounds(lines, base.width, base.height, { row, col })
  const wrapCol = bounds ? bounds.leftInner : 0
  for (const ch of toCells(text.replace(/\r\n/g, '\n'))) {
    if (ch === '\r') continue
    if (ch === '\n') {
      row += 1
      if (row >= base.height) break
      if (bounds) {
        if (row > bounds.bottomInner) break
        col = clampInt(col, bounds.leftInner, bounds.rightInner)
      } else {
        col = clampInt(col, 0, base.width - 1)
      }
      continue
    }
    if (bounds) {
      if (row < bounds.topInner || row > bounds.bottomInner) break
      if (col < bounds.leftInner) col = bounds.leftInner
      if (col > bounds.rightInner) {
        if (row >= bounds.bottomInner) break
        row += 1
        if (row >= base.height) break
        col = wrapCol
      }
    } else if (col >= base.width) {
      row += 1
      if (row >= base.height) break
      col = 0
    }
    col = snapColToCellStart(lines[row] ?? '', col, base.width)

    let writeCh = ch
    let writeWidth = writeCh === CONTINUATION_CELL ? 1 : cellDisplayWidth(writeCh)
    const maxCol = bounds ? bounds.rightInner : base.width - 1

    if (writeWidth === 2 && col + 1 > maxCol) {
      if (bounds) {
        if (row >= bounds.bottomInner) break
        row += 1
        if (row >= base.height) break
        col = wrapCol
      } else {
        row += 1
        if (row >= base.height) break
        col = 0
      }
      col = snapColToCellStart(lines[row] ?? '', col, base.width)
    }

    if (writeWidth === 2 && col + 1 > (bounds ? bounds.rightInner : base.width - 1)) {
      writeCh = ' '
      writeWidth = 1
    }

    clearContinuationRight(lines, row, col, base.width)
    setCharInLines(lines, row, col, writeCh, base.width)
    col += writeWidth
    if (bounds) {
      if (col > bounds.rightInner) {
        if (row >= bounds.bottomInner) {
          col = bounds.rightInner
          break
        }
        row += 1
        if (row >= base.height) break
        col = wrapCol
      }
    } else if (col >= base.width) {
      row += 1
      if (row >= base.height) break
      col = 0
    }
  }
  const cursorRow = bounds ? clampInt(row, bounds.topInner, bounds.bottomInner) : clampInt(row, 0, base.height - 1)
  const cursorCol = bounds ? clampInt(col, bounds.leftInner, bounds.rightInner) : clampInt(col, 0, base.width - 1)
  const cursorLine = lines[cursorRow] ?? ''
  return {
    next: { ...base, lines },
    cursor: { row: cursorRow, col: snapColToCellStart(cursorLine, cursorCol, base.width) }
  }
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

function LayersModal({
  onClose,
  layers,
  activeLayerId,
  addLayer,
  removeLayer,
  selectLayer,
  toggleLayerVisibility,
  toggleLayerLock,
  setLayerName,
  text
}: {
  onClose: () => void
  layers: Layer[]
  activeLayerId: string
  addLayer: () => void
  removeLayer: (id: string) => void
  selectLayer: (id: string) => void
  toggleLayerVisibility: (id: string) => void
  toggleLayerLock: (id: string) => void
  setLayerName: (id: string, name: string) => void
  text: Record<TextKey, string>
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const startEditing = (l: Layer) => {
    setEditingId(l.id)
    setEditName(l.name)
  }

  const saveName = () => {
    if (editingId) {
      setLayerName(editingId, editName)
      setEditingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div 
        className="w-80 rounded p-4 shadow-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-text)]" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{text.layers}</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-[var(--ui-surface-2)]">
            <Icon name="close" />
          </button>
        </div>
        <div className="mb-4 max-h-60 overflow-y-auto">
          {layers.map((l) => {
            const isActive = l.id === activeLayerId
            return (
              <div
                key={l.id}
                className={`mb-1 flex items-center rounded p-2 border ${
                  isActive
                    ? 'bg-[var(--ui-primary)] text-[var(--ui-primary-contrast)] border-[var(--ui-primary)]'
                    : 'hover:bg-[var(--ui-surface-2)] border-transparent text-[var(--ui-text)]'
                }`}
                onClick={() => selectLayer(l.id)}
              >
                <button
                  className={`mr-2 rounded p-1 ${
                    isActive 
                      ? 'text-current opacity-90 hover:opacity-100' 
                      : l.visible ? 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]' : 'text-[var(--ui-text-dim)]'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleLayerVisibility(l.id)
                  }}
                  title={text.visible}
                >
                  <Icon name={l.visible ? 'visible' : 'hidden'} />
                </button>
                
                {editingId === l.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={saveName}
                    onKeyDown={(e) => e.key === 'Enter' && saveName()}
                    className="flex-1 rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] px-1 text-[var(--ui-text)]"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex-1 truncate cursor-pointer font-medium" onDoubleClick={() => startEditing(l)}>
                    {l.name}
                  </span>
                )}

                <button
                  className={`ml-2 rounded p-1 ${
                    isActive
                      ? 'text-current opacity-90 hover:opacity-100'
                      : l.locked ? 'text-[var(--ui-danger)]' : 'text-[var(--ui-text-dim)] hover:text-[var(--ui-text)]'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleLayerLock(l.id)
                  }}
                  title={text.locked}
                >
                  <Icon name={l.locked ? 'lock' : 'unlock'} />
                </button>

                <button
                  className={`ml-2 ${isActive ? 'text-current opacity-90 hover:opacity-100' : 'text-[var(--ui-danger)] hover:opacity-80'}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (layers.length > 1) removeLayer(l.id)
                  }}
                  disabled={layers.length <= 1}
                  title={text.removeLayer}
                >
                  <Icon name="close" />
                </button>
              </div>
            )
          })}
        </div>
        <button
          className="flex w-full items-center justify-center gap-2 rounded bg-[var(--ui-primary)] py-2 text-[var(--ui-primary-contrast)] hover:opacity-90"
          onClick={addLayer}
        >
          <Icon name="add" />
          {text.addLayer}
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const buffer = useEditorStore(selectActiveBuffer)
  const layers = useEditorStore((s) => s.layers)
  const activeLayerId = useEditorStore((s) => s.activeLayerId)
  const newBuffer = useEditorStore((s) => s.newBuffer)
  const addLayer = useEditorStore((s) => s.addLayer)
  const removeLayer = useEditorStore((s) => s.removeLayer)
  const selectLayer = useEditorStore((s) => s.selectLayer)
  const toggleLayerVisibility = useEditorStore((s) => s.toggleLayerVisibility)
  const toggleLayerLock = useEditorStore((s) => s.toggleLayerLock)
  const setLayerName = useEditorStore((s) => s.setLayerName)
  const [showLayersModal, setShowLayersModal] = useState(false)
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
  const [isFigureInsertOpen, setIsFigureInsertOpen] = useState(false)
  const [figureWidth, setFigureWidth] = useState(24)
  const [figureHeight, setFigureHeight] = useState(8)
  const [language, setLanguage] = useState<Language>(() => {
    const stored = readStorage(STORAGE_KEYS.language)
    if (stored === 'ko' || stored === 'en' || stored === 'ja' || stored === 'zh-Hant' || stored === 'zh-Hans') return stored
    return 'ko'
  })
  const [themeSetting, setThemeSetting] = useState<ThemeSetting>(() => {
    const stored = readStorage(STORAGE_KEYS.theme)
    if (
      stored === 'system' ||
      stored === 'light' ||
      stored === 'dark' ||
      stored === 'monokai' ||
      stored === 'kimble-dark' ||
      stored === 'dracula' ||
      stored === 'nord' ||
      stored === 'solarized-light' ||
      stored === 'solarized-dark'
    )
      return stored
    return 'system'
  })
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isManageRecentOpen, setIsManageRecentOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [resolvedTheme, setResolvedTheme] = useState<ThemeId>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [filePath, setFilePath] = useState<string | null>(() => readStorage(STORAGE_KEYS.filePath))
  const [fileOrigin, setFileOrigin] = useState<'opened' | 'none'>(() => (readStorage(STORAGE_KEYS.filePath) ? 'opened' : 'none'))
  const [pinnedFiles, setPinnedFiles] = useState<string[]>(() => readPathList(STORAGE_KEYS.pinnedFiles, 10))
  const [recentFiles, setRecentFiles] = useState<string[]>(() => {
    const pinned = readPathList(STORAGE_KEYS.pinnedFiles, 10)
    return readPathList(STORAGE_KEYS.recentFiles, 10).filter((p) => !pinned.includes(p)).slice(0, 10)
  })
  const [exportNewline, setExportNewline] = useState<ExportNewline>(() => {
    const stored = readStorage(STORAGE_KEYS.exportNewline)
    if (stored === 'lf' || stored === 'crlf') return stored
    return navigator.userAgent.includes('Windows') ? 'crlf' : 'lf'
  })
  const [padRightOnSave, setPadRightOnSave] = useState(() => {
    const stored = readStorage(STORAGE_KEYS.padRightOnSave)
    if (stored === 'true') return true
    if (stored === 'false') return false
    return true
  })
  const [lastError, setLastError] = useState<string | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const preRef = useRef<HTMLPreElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const didAutoOpenRef = useRef(false)
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
  const [clipboard, setClipboard] = useState<ClipboardState>({ current: null, history: [] })
  const [metrics, setMetrics] = useState<TextMetrics | null>(null)
  const metricsRef = useRef<TextMetrics | null>(null)
  const composingRef = useRef(false)
  const enterAnchorRef = useRef<Cell | null>(null)
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
  const selectionAnchorRef = useRef<{ start: Cell; end: Cell } | null>(null)
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

  const renderText = useMemo(() => {
    const targetLayers = draftBuffer
      ? layers.map((l) => (l.id === activeLayerId ? { ...l, buffer: draftBuffer } : l))
      : layers
    const composite = compositeBuffers(targetLayers, buffer.width, buffer.height)
    return bufferToText(composite, { padRight: true })
  }, [activeLayerId, buffer.height, buffer.width, draftBuffer, layers])
  const t = useCallback((key: TextKey) => TEXT[language][key], [language])
  const clearToast = useCallback(() => setToastMessage(null), [])
  const onThemeSettingChange = useCallback(
    (theme: ThemeSetting) => {
      setThemeSetting(theme)
      setToastMessage(TEXT[language].toastThemeApplied)
    },
    [language]
  )
  const onLanguageSettingChange = useCallback((lang: Language) => {
    setLanguage(lang)
    setToastMessage(TEXT[lang].toastLanguageApplied)
  }, [])

  const snapCursorToCellStart = useCallback(
    (pos: Cell) => {
      const row = clampInt(pos.row, 0, buffer.height - 1)
      const col = clampInt(pos.col, 0, buffer.width - 1)
      const line = buffer.lines[row] ?? ''
      return { row, col: snapColToCellStart(line, col, buffer.width) }
    },
    [buffer.height, buffer.lines, buffer.width]
  )

  useEffect(() => writeStorage(STORAGE_KEYS.language, language), [language])
  useEffect(() => writeStorage(STORAGE_KEYS.theme, themeSetting), [themeSetting])
  useEffect(() => writeStorage(STORAGE_KEYS.exportNewline, exportNewline), [exportNewline])
  useEffect(() => writeStorage(STORAGE_KEYS.padRightOnSave, padRightOnSave ? 'true' : 'false'), [padRightOnSave])
  useEffect(() => writeStorage(STORAGE_KEYS.drawStyle, drawStyle), [drawStyle])
  useEffect(() => writeStorage(STORAGE_KEYS.pinnedFiles, JSON.stringify(pinnedFiles)), [pinnedFiles])
  useEffect(() => writeStorage(STORAGE_KEYS.recentFiles, JSON.stringify(recentFiles)), [recentFiles])
  useEffect(() => {
    if (pinnedFiles.length === 0) return
    setRecentFiles((prev) => prev.filter((p) => !pinnedFiles.includes(p)).slice(0, 10))
  }, [pinnedFiles])
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
    if (!filePath) {
      removeStorage(STORAGE_KEYS.filePath)
      return
    }
    writeStorage(STORAGE_KEYS.filePath, filePath)
  }, [filePath])

  useEffect(() => {
    const el = preRef.current ?? inputRef.current
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

  useEffect(() => {
    if (themeSetting !== 'system') {
      setResolvedTheme(themeSetting)
      return
    }
    if (typeof window.matchMedia !== 'function') {
      setResolvedTheme('dark')
      return
    }
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setResolvedTheme(mql.matches ? 'dark' : 'light')
    update()
    try {
      mql.addEventListener('change', update)
      return () => mql.removeEventListener('change', update)
    } catch {
      mql.addListener(update)
      return () => mql.removeListener(update)
    }
  }, [themeSetting])

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
  }, [resolvedTheme])

  useEffect(() => {
    const el = preRef.current
    if (!el) return
    const m = measureEditorElement(el)
    metricsRef.current = m
    setMetrics(m)
  }, [resolvedTheme])

  const openFileByPath = useCallback(
    async (path: string) => {
      try {
        setLastError(null)
        const contents = stripUtf8Bom(await invoke<string>('read_text_file', { path }))
        if (/\r\n/.test(contents)) setExportNewline('crlf')
        else if (/\n/.test(contents)) setExportNewline('lf')
        loadBufferFromTextAutoSize(contents)
        setFilePath(path)
        setFileOrigin('opened')
        if (pinnedFiles.includes(path)) setRecentFiles((prev) => prev.filter((p) => p !== path))
        else setRecentFiles((prev) => [path, ...prev.filter((p) => p !== path && !pinnedFiles.includes(p))].slice(0, 10))
        queueMicrotask(() => inputRef.current?.focus())
        return true
      } catch {
        setLastError(t('loadError'))
        setRecentFiles((prev) => prev.filter((p) => p !== path))
        setPinnedFiles((prev) => prev.filter((p) => p !== path))
        if (filePath === path) {
          setFilePath(null)
          setFileOrigin('none')
        }
        return false
      }
    },
    [filePath, loadBufferFromTextAutoSize, pinnedFiles, t]
  )

  const saveBufferText = useCallback(
    async (opts?: { forceDialog?: boolean }) => {
      setLastError(null)
      const forceDialog = opts?.forceDialog ?? false
      const contents = normalizeForSave(bufferToText(buffer, { padRight: padRightOnSave }), exportNewline)

      const tryWrite = async (path: string) => {
        await invoke<void>('write_text_file', { path, contents })
        setLastError(null)
        setFilePath(path)
        if (pinnedFiles.includes(path)) setRecentFiles((prev) => prev.filter((p) => p !== path))
        else setRecentFiles((prev) => [path, ...prev.filter((p) => p !== path && !pinnedFiles.includes(p))].slice(0, 10))
      }

      if (filePath && !forceDialog) {
        try {
          if (fileOrigin === 'opened') {
            const ok = window.confirm(`${t('overwriteConfirm')}\n${filePath}`)
            if (!ok) return
          }
          await tryWrite(filePath)
          return
        } catch (err) {
          setLastError(`${t('saveError')}\n${String(err)}`)
        }
      }

      try {
        const defaultName = filePath ? basename(filePath) : 'txeditor.txt'
        const defaultDir = recentFiles[0] ? dirname(recentFiles[0]) : ''
        const defaultPath = filePath ?? (defaultDir ? joinPath(defaultDir, defaultName) : defaultName)
        const picked = await save({
          title: t('save'),
          defaultPath
        })
        const path = dialogPathToString(picked)
        if (!path) return
        const finalPath = ensureDefaultExtension(path, 'txt')
        const platform = navigator.userAgent.toLowerCase().includes('windows') ? 'windows' : 'other'
        if (!isValidSavePath(finalPath, platform)) {
          setLastError(`${t('invalidSavePath')}\n${finalPath}`)
          return
        }
        await tryWrite(finalPath)
        setFileOrigin('none')
      } catch (err) {
        setLastError(`${t('saveError')}\n${String(err)}`)
      }
    },
    [buffer, exportNewline, fileOrigin, filePath, padRightOnSave, pinnedFiles, recentFiles, t]
  )

  const openTextFile = useCallback(async () => {
    const picked = await open({
      multiple: false,
      filters: [{ name: 'Text', extensions: ['txt'] }]
    })
    if (!picked) return
    const first = Array.isArray(picked) ? picked[0] : picked
    const path = dialogPathToString(first)
    if (!path) return
    await openFileByPath(path)
  }, [openFileByPath])

  const togglePinRecent = useCallback((path: string) => {
    setPinnedFiles((prevPinned) => {
      const isPinned = prevPinned.includes(path)
      const nextPinned = isPinned ? prevPinned.filter((p) => p !== path) : normalizePathList([path, ...prevPinned], 10)
      setRecentFiles((prevRecent) => {
        const base = prevRecent.filter((p) => p !== path && !nextPinned.includes(p))
        if (!isPinned) return base.slice(0, 10)
        return normalizePathList([path, ...base], 10)
      })
      return nextPinned
    })
  }, [])

  const removeRecentPath = useCallback((path: string) => {
    setPinnedFiles((prev) => prev.filter((p) => p !== path))
    setRecentFiles((prev) => prev.filter((p) => p !== path))
  }, [])

  useEffect(() => {
    if (didAutoOpenRef.current) return
    didAutoOpenRef.current = true
    if (!filePath) return
    void openFileByPath(filePath)
  }, [filePath, openFileByPath])

  const clearSelection = useCallback(() => {
    selectGestureRef.current = null
    selectionAnchorRef.current = null
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
      selectionAnchorRef.current = null
      setIsSelecting(false)
    }
    if (gestureRef.current) {
      gestureRef.current = null
      setDraftBuffer(null)
      setIsDrawing(false)
    }
    queueMicrotask(() => inputRef.current?.focus())
  }, [])

  const openFigureInsert = useCallback(() => {
    cancelDrawing()
    clearSelection()
    setTool('text')
    setIsFigureInsertOpen(true)
    queueMicrotask(() => inputRef.current?.focus())
  }, [cancelDrawing, clearSelection])

  const applyInsertFigure = useCallback(() => {
    const viewport = viewportRef.current
    if (viewport) restoreViewportRef.current = { scrollTop: viewport.scrollTop, scrollLeft: viewport.scrollLeft }
    const { cursor: currentCursor, getBuffer } = useEditorStore.getState()
    const currentBuffer = getBuffer()
    const at = currentCursor ?? { row: 0, col: 0 }
    const { buffer: next, cursorAfter } = insertBlankFigure(
      { width: currentBuffer.width, height: currentBuffer.height, lines: currentBuffer.lines },
      at,
      { width: figureWidth, height: figureHeight },
      drawStyle
    )
    commitBuffer({ width: next.width, height: next.height, lines: next.lines })
    setCursor({ row: cursorAfter.row, col: cursorAfter.col })
    setIsFigureInsertOpen(false)
    queueMicrotask(() => inputRef.current?.focus())
  }, [commitBuffer, drawStyle, figureHeight, figureWidth, setCursor])

  const copySelection = useCallback(async () => {
    if (!selectionRect) return
    const originCell = selectionAnchorRef.current?.start
    const clip = copyRectFromBuffer(buffer, selectionRect, originCell)
    if (!clip) return
    setClipboard((s) => {
      const nextHistory = s.current ? [s.current, ...s.history] : s.history
      const history = nextHistory.slice(0, 20)
      return { current: clip, history }
    })
    try {
      setLastError(null)
      const platform = navigator.userAgent.toLowerCase().includes('windows') ? 'windows' : 'other'
      const fixedWidthLines = clip.lines.map((line) => padCells(line, clip.width))
      await writeClipboardText(normalizeForClipboard(fixedWidthLines.join('\n'), platform))
    } catch (err) {
      setLastError(`${t('clipboardError')}\n${String(err)}`)
    }
  }, [buffer, selectionRect, t])

  const deleteSelection = useCallback(() => {
    if (!selectionRect) return
    const next = applyRectFill(buffer, selectionRect, ' ')
    commitBuffer(next)
    clearSelection()
  }, [buffer, clearSelection, commitBuffer, selectionRect])

  const cutSelection = useCallback(async () => {
    await copySelection()
    deleteSelection()
  }, [copySelection, deleteSelection])

  const pasteClipboard = useCallback(() => {
    const at = cursor ?? { row: 0, col: 0 }
    const next = pasteRectIntoBuffer(buffer, at, clipboard.current)
    commitBuffer(next)
    clearSelection()
  }, [buffer, clearSelection, clipboard, commitBuffer, cursor])

  const pasteClipboardAt = useCallback(
    (at: Cell) => {
      if (!clipboard.current) return
      const next = pasteRectIntoBuffer(buffer, at, clipboard.current)
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
      const { cursor: currentCursor, getBuffer } = useEditorStore.getState()
    const currentBuffer = getBuffer()
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
          const col = toCells(displayLine.slice(0, found)).length
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
    const { getBuffer } = useEditorStore.getState()
    const currentBuffer = getBuffer()
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

      if (key === 'i' && e.shiftKey) {
        e.preventDefault()
        openFigureInsert()
        return
      }


      if (key === 's') {
        e.preventDefault()
        void saveBufferText(e.shiftKey ? { forceDialog: true } : undefined)
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
    openFigureInsert,
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
    const { cursor: currentCursor, getBuffer } = useEditorStore.getState()
    const currentBuffer = getBuffer()
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
    const { cursor: currentCursor, getBuffer } = useEditorStore.getState()
    const currentBuffer = getBuffer()
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
    const { cursor: currentCursor, getBuffer } = useEditorStore.getState()
    const currentBuffer = getBuffer()
    const at = currentCursor ? snapCursorToCellStartInBuffer(currentBuffer, currentCursor) : { row: 0, col: 0 }
    const anchor = enterAnchorRef.current ? snapCursorToCellStartInBuffer(currentBuffer, enterAnchorRef.current) : at
    const bounds = findEnclosingBoxBounds(currentBuffer.lines, currentBuffer.width, currentBuffer.height, anchor)
    const nextRow = bounds
      ? clampInt(anchor.row + 1, bounds.topInner, bounds.bottomInner)
      : clampInt(anchor.row + 1, 0, currentBuffer.height - 1)
    const nextCol = bounds ? clampInt(anchor.col, bounds.leftInner, bounds.rightInner) : clampInt(anchor.col, 0, currentBuffer.width - 1)
    setCursor({ row: nextRow, col: nextCol })
    enterAnchorRef.current = { row: nextRow, col: nextCol }
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
        enterAnchorRef.current = next
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
        const next = snapCursorToCellStart(start)
        setCursor(next)
        enterAnchorRef.current = next
        selectGestureRef.current = { start, current: start }
        selectionAnchorRef.current = { start, end: start }
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
        selectionAnchorRef.current = { start: sg.start, end: cell }
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

  const editorPane = (
    <>
      <div
        ref={viewportRef}
        className="ui-editor h-full w-full select-none overflow-auto outline-none"
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
          const inSelection = Boolean(selectionRect && isCellInRect(selectionRect, clicked))
          setContextMenu({ open: true, x: e.clientX, y: e.clientY, at: clicked, inSelection })
        }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className="relative">
          <pre
            ref={preRef}
            className="ui-editor-pre p-3 font-mono text-xs"
            style={editorFontFamily ? { fontFamily: editorFontFamily } : undefined}
          >
            {renderText}
          </pre>
          {metrics ? (
            <div
              className="pointer-events-none absolute"
              style={{
                left: metrics.paddingLeft,
                top: metrics.paddingTop,
                width: buffer.width * metrics.charWidth,
                height: buffer.height * metrics.lineHeight,
                backgroundImage:
                  'linear-gradient(to right, var(--ui-editor-grid) 1px, transparent 1px), linear-gradient(to bottom, var(--ui-editor-grid) 1px, transparent 1px)',
                backgroundSize: `${metrics.charWidth}px ${metrics.lineHeight}px`,
                outline: '3px solid var(--ui-editor-boundary)',
                outlineOffset: '0px'
              }}
            />
          ) : null}
          {metrics && selectionRect ? (
            <div className="pointer-events-none absolute inset-0">
              {Array.from({ length: selectionRect.bottom - selectionRect.top + 1 }, (_, i) => selectionRect.top + i).map((row) => (
                <div
                  key={`sel-${row}`}
                  className="absolute"
                  style={{
                    backgroundColor: 'var(--ui-editor-selection)',
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
                  className="absolute"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--ui-primary) 22%, transparent)',
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
              className="pointer-events-none absolute"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--ui-primary) 32%, transparent)',
                left: metrics.paddingLeft + findMatch.col * metrics.charWidth,
                top: metrics.paddingTop + findMatch.row * metrics.lineHeight,
                width: Math.max(0, Math.min(findQueryLen, buffer.width - findMatch.col)) * metrics.charWidth,
                height: metrics.lineHeight
              }}
            />
          ) : null}
          {tool === 'text' && cursor && metrics ? (
            <div
              className="pointer-events-none absolute z-20 bg-[var(--ui-editor-caret)]"
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
    </>
  )

  return (
    <div className="flex h-full w-full flex-col">
      <MenuBar
        language={language}
        onOpen={() => void openTextFile()}
        onNew={() => setIsNewOpen(true)}
        onSave={() => void saveBufferText()}
        onSaveAs={() => void saveBufferText({ forceDialog: true })}
        pinnedFiles={pinnedFiles}
        recentFiles={recentFiles}
        onOpenRecent={(path) => void openFileByPath(path)}
        onClearRecent={() => setRecentFiles([])}
        onManageRecent={() => setIsManageRecentOpen(true)}
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
        onInsertFigure={openFigureInsert}
        onFind={openFind}
        onReplace={openReplace}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      <SettingsModal
        open={isSettingsOpen}
        language={language}
        themeSetting={themeSetting}
        onThemeChange={onThemeSettingChange}
        onLanguageChange={onLanguageSettingChange}
        onClose={() => setIsSettingsOpen(false)}
      />
      <ManageRecentModal
        open={isManageRecentOpen}
        language={language}
        pinnedFiles={pinnedFiles}
        recentFiles={recentFiles}
        onOpenPath={(path) => void openFileByPath(path)}
        onTogglePin={togglePinRecent}
        onRemovePath={removeRecentPath}
        onClearRecent={() => setRecentFiles([])}
        onClose={() => setIsManageRecentOpen(false)}
      />
      <Toast message={toastMessage} onDone={clearToast} />
      <div className="flex min-h-0 flex-1 flex-col gap-3 bg-[var(--ui-bg)] p-3">
        <div className="flex flex-wrap items-center gap-2 rounded border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2 text-xs text-[var(--ui-text)]">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <IconButton label={t('new')} icon="file" onClick={() => setIsNewOpen(true)} />
              <IconButton label={t('open')} icon="file" onClick={() => void openTextFile()} />
              <IconButton label={t('save')} icon="save" onClick={() => void saveBufferText()} />
            </div>
          </div>

          <div className="flex items-center gap-2 border-l border-[var(--ui-border)] pl-2">
            <div className="flex items-center gap-1">
              <IconButton label={t('undo')} icon="undo" onClick={undo} disabled={isDrawing || isSelecting} />
              <IconButton label={t('redo')} icon="redo" onClick={redo} disabled={isDrawing || isSelecting} />
              <div className="flex flex-col items-center">
                <IconButton label={t('layers')} icon="layers" onClick={() => setShowLayersModal(true)} />
                <span className="mt-0.5 max-w-[60px] truncate text-[10px] font-medium text-[var(--ui-text)]">
                  {layers.find((l) => l.id === activeLayerId)?.name}
                </span>
              </div>
              <IconButton label={t('find')} icon="search" onClick={openFind} />
              <IconButton label={t('replace')} icon="replace" onClick={openReplace} />
            </div>
          </div>

          <div className="flex items-center gap-2 border-l border-[var(--ui-border)] pl-2">
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

          <div className="flex items-center gap-2 border-l border-[var(--ui-border)] pl-2">
            <div className="font-semibold">{t('insert')}</div>
            <div className="flex items-center gap-1">
              <IconButton label={t('insertFigure')} icon="rect" onClick={openFigureInsert} />
            </div>
          </div>

          {tool === 'free' ? (
            <div className="flex items-center gap-2 border-l border-[var(--ui-border)] pl-2">
              <span>{t('drawChar')}</span>
              <select
                className="ui-select px-2 py-0.5 text-xs"
                value={freeChar}
                onChange={(e) => setFreeChar(e.target.value)}
              >
                <option value="#">#</option>
                <option value="$">$</option>
                <option value="%">%</option>
              </select>
            </div>
          ) : null}

          <div className="flex items-center gap-2 border-l border-[var(--ui-border)] pl-2">
            <span>{t('style')}</span>
            <select
              className="ui-select px-2 py-0.5 text-xs"
              value={drawStyle}
              onChange={(e) => setDrawStyle(e.target.value as DrawStyle)}
              disabled={isDrawing || isSelecting}
            >
              <option value="ascii">{t('styleAscii')}</option>
              <option value="unicode">{t('styleUnicode')}</option>
            </select>
          </div>

          {tool === 'select' ? (
            <div className="flex flex-wrap items-center gap-2 border-l border-[var(--ui-border)] pl-2">
              <div className="flex items-center gap-2">
                <span>{t('selection')}</span>
                <span className="text-[var(--ui-text-dim)]">
                  {selectionRect ? `${selectionRect.left},${selectionRect.top}–${selectionRect.right},${selectionRect.bottom}` : '-'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="ui-btn px-2 py-1 disabled:opacity-40"
                  onClick={copySelection}
                  disabled={!selectionRect}
                >
                  {t('copy')}
                </button>
                <button
                  type="button"
                  className="ui-btn px-2 py-1 disabled:opacity-40"
                  onClick={cutSelection}
                  disabled={!selectionRect}
                >
                  {t('cut')}
                </button>
                <button
                  type="button"
                  className="ui-btn px-2 py-1 disabled:opacity-40"
                  onClick={pasteClipboard}
                  disabled={!clipboard.current}
                >
                  {t('paste')}
                </button>
                <button
                  type="button"
                  className="ui-btn px-2 py-1 disabled:opacity-40"
                  onClick={deleteSelection}
                  disabled={!selectionRect}
                >
                  {t('delete')}
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-2 border-l border-[var(--ui-border)] pl-2">
            <span>{t('newline')}</span>
            <select
              className="ui-select px-2 py-0.5 text-xs"
              value={exportNewline}
              onChange={(e) => setExportNewline(e.target.value as ExportNewline)}
              disabled={isDrawing || isSelecting}
            >
              <option value="lf">LF</option>
              <option value="crlf">{t('crlfWindows')}</option>
            </select>
          </div>

          <label className="flex items-center gap-2 border-l border-[var(--ui-border)] pl-2">
            <input
              type="checkbox"
              checked={padRightOnSave}
              onChange={(e) => setPadRightOnSave(e.target.checked)}
              disabled={isDrawing || isSelecting}
            />
            <span>{t('padRightOnSave')}</span>
          </label>

          <div className="ml-auto text-xs text-[var(--ui-text-dim)]">
            {t('ctrlCmdS')} · Ctrl/Cmd+O · Esc
          </div>
        </div>

        {lastError ? (
          <div className="rounded border border-[color-mix(in_srgb,var(--ui-danger)_45%,transparent)] bg-[color-mix(in_srgb,var(--ui-danger)_16%,transparent)] px-3 py-2 text-xs text-[var(--ui-text)]">
            {lastError}
          </div>
        ) : null}

        <div className="relative min-h-0 flex-1">
          {editorPane}
        </div>
      </div>
      <StatusBar language={language} newlineMode={exportNewline} filePath={filePath} />

      {contextMenu.open ? (
        <div
          ref={contextMenuRef}
          className="fixed z-50 w-44 rounded border border-[var(--ui-border)] bg-[var(--ui-surface)] p-1 text-sm shadow-[var(--ui-shadow-md)]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[var(--ui-text)] hover:bg-[var(--ui-surface-2)] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!contextMenu.inSelection || !selectionRect}
            onClick={() => {
              setContextMenu({ open: false, x: 0, y: 0, at: null, inSelection: false })
              copySelection()
            }}
          >
            <span className="flex items-center gap-2">
              <span className="w-4 text-center text-[var(--ui-text-dim)]">⎘</span>
              <span>{t('copy')}</span>
            </span>
            <span className="text-xs text-[var(--ui-text-dim)]">Ctrl+C</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[var(--ui-text)] hover:bg-[var(--ui-surface-2)] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!contextMenu.inSelection || !selectionRect}
            onClick={() => {
              setContextMenu({ open: false, x: 0, y: 0, at: null, inSelection: false })
              cutSelection()
            }}
          >
            <span className="flex items-center gap-2">
              <span className="w-4 text-center text-[var(--ui-text-dim)]">✂</span>
              <span>{t('cut')}</span>
            </span>
            <span className="text-xs text-[var(--ui-text-dim)]">Ctrl+X</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[var(--ui-text)] hover:bg-[var(--ui-surface-2)] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!clipboard.current || !contextMenu.at}
            onClick={() => {
              const at = contextMenu.at
              if (!at) return
              pasteClipboardAt(at)
            }}
          >
            <span className="flex items-center gap-2">
              <span className="w-4 text-center text-[var(--ui-text-dim)]">⎀</span>
              <span>{t('paste')}</span>
            </span>
            <span className="text-xs text-[var(--ui-text-dim)]">Ctrl+V</span>
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
          <div className="w-full max-w-lg rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-[var(--ui-shadow-md)]">
            <div className="flex items-center justify-between border-b border-[var(--ui-border)] px-4 py-3">
              <div className="text-sm font-semibold text-[var(--ui-text)]">{t('find')}</div>
              <button
                type="button"
                className="ui-btn px-2 py-1 text-xs"
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
              <label className="mb-3 block text-xs font-semibold text-[var(--ui-text-muted)]">{t('search')}</label>
              <input
                ref={findInputRef}
                value={findQuery}
                onChange={(e) => setFindQuery(e.target.value)}
                className="ui-input mb-4 w-full px-3 py-2 text-sm"
              />
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-[var(--ui-text-dim)] tabular-nums">
                  {(currentFindIndex ?? -1) + 1}/{findMatches.length}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="ui-btn px-3 py-2 text-sm"
                    onClick={() => findPrev()}
                    disabled={findMatches.length === 0}
                  >
                    {t('findPrev')}
                  </button>
                <button
                  type="button"
                  className="ui-btn px-3 py-2 text-sm"
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
          <div className="w-full max-w-lg rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-[var(--ui-shadow-md)]">
            <div className="flex items-center justify-between border-b border-[var(--ui-border)] px-4 py-3">
              <div className="text-sm font-semibold text-[var(--ui-text)]">{t('replace')}</div>
              <button
                type="button"
                className="ui-btn px-2 py-1 text-xs"
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
              <label className="mb-1 block text-xs font-semibold text-[var(--ui-text-muted)]">{t('search')}</label>
              <input
                value={findQuery}
                onChange={(e) => setFindQuery(e.target.value)}
                className="ui-input mb-3 w-full px-3 py-2 text-sm"
              />
              <label className="mb-1 block text-xs font-semibold text-[var(--ui-text-muted)]">{t('replaceWith')}</label>
              <input
                ref={replaceInputRef}
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                className="ui-input mb-4 w-full px-3 py-2 text-sm"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="ui-btn px-3 py-2 text-sm"
                  onClick={() => findPrev()}
                  disabled={findMatches.length === 0}
                >
                  {t('findPrev')}
                </button>
                <button
                  type="button"
                  className="ui-btn px-3 py-2 text-sm"
                  onClick={() => replacePrev()}
                  disabled={findMatches.length === 0}
                >
                  {t('replacePrev')}
                </button>
                <button
                  type="button"
                  className="ui-btn px-3 py-2 text-sm"
                  onClick={() => findNext()}
                  disabled={findMatches.length === 0}
                >
                  {t('findNext')}
                </button>
                <button
                  type="button"
                  className="ui-btn px-3 py-2 text-sm"
                  onClick={replaceNext}
                  disabled={findMatches.length === 0}
                >
                  {t('replaceNext')}
                </button>
                <button
                  type="button"
                  className="ui-btn px-3 py-2 text-sm"
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
          <div className="w-full max-w-lg rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-[var(--ui-shadow-md)]">
            <div className="flex items-center justify-between border-b border-[var(--ui-border)] px-4 py-3">
              <div className="text-sm font-semibold text-[var(--ui-text)]">{t('newBuffer')}</div>
              <button
                type="button"
                className="ui-btn px-2 py-1 text-xs"
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
                    className="ui-btn px-3 py-2 text-sm"
                    onClick={() => {
                      newBuffer(t.width, t.height)
                      setFilePath(null)
                      setFileOrigin('none')
                      setIsNewOpen(false)
                      queueMicrotask(() => inputRef.current?.focus())
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="rounded border border-[var(--ui-border)] bg-[var(--ui-surface-2)] p-3">
                <div className="mb-2 text-xs font-semibold text-[var(--ui-text-muted)]">{t('custom')}</div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ui-text-muted)]">
                  <label className="flex items-center gap-2">
                    <span>{t('width')}</span>
                    <input
                      type="number"
                      min={1}
                      max={2000}
                      value={customWidth}
                      onChange={(e) => setCustomWidth(clampInt(Number(e.target.value), 1, 2000))}
                      className="ui-input w-24 px-2 py-1"
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
                      className="ui-input w-24 px-2 py-1"
                    />
                  </label>
                  <button
                    type="button"
                    className="ui-btn ml-auto px-3 py-1 text-xs"
                    onClick={() => {
                      newBuffer(customWidth, customHeight)
                      setFilePath(null)
                      setFileOrigin('none')
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

      {isFigureInsertOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsFigureInsertOpen(false)
          }}
        >
          <div className="w-full max-w-lg rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-[var(--ui-shadow-md)]">
            <div className="flex items-center justify-between border-b border-[var(--ui-border)] px-4 py-3">
              <div className="text-sm font-semibold text-[var(--ui-text)]">{t('insertFigure')}</div>
              <button
                type="button"
                className="ui-btn px-2 py-1 text-xs"
                onClick={() => setIsFigureInsertOpen(false)}
              >
                {t('close')}
              </button>
            </div>
            <div className="px-4 py-4">
              <div className="rounded border border-[var(--ui-border)] bg-[var(--ui-surface-2)] p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ui-text-muted)]">
                  <label className="flex items-center gap-2">
                    <span>{t('width')}</span>
                    <input
                      type="number"
                      min={1}
                      max={2000}
                      value={figureWidth}
                      onChange={(e) => setFigureWidth(clampInt(Number(e.target.value), 1, 2000))}
                      className="ui-input w-24 px-2 py-1"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <span>{t('height')}</span>
                    <input
                      type="number"
                      min={1}
                      max={2000}
                      value={figureHeight}
                      onChange={(e) => setFigureHeight(clampInt(Number(e.target.value), 1, 2000))}
                      className="ui-input w-24 px-2 py-1"
                    />
                  </label>
                  <button
                    type="button"
                    className="ui-btn ml-auto px-3 py-1 text-xs"
                    onClick={applyInsertFigure}
                  >
                    {t('insert')}
                  </button>
                </div>
              </div>
              <div className="mt-2 text-xs text-[var(--ui-text-dim)]">
                Ctrl+Shift+I
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showLayersModal && (
        <LayersModal
          onClose={() => setShowLayersModal(false)}
          layers={layers}
          activeLayerId={activeLayerId}
          addLayer={addLayer}
          removeLayer={removeLayer}
          selectLayer={selectLayer}
          toggleLayerVisibility={toggleLayerVisibility}
          toggleLayerLock={toggleLayerLock}
          setLayerName={setLayerName}
          text={TEXT[language]}
        />
      )}
    </div>
  )
}
