import { useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import CanvasLayer from './components/CanvasLayer'
import Toolbar from './components/Toolbar'
import { useEditorStore } from './store/editorStore'

type ExportState =
  | { status: 'idle'; text: string; error: string | null }
  | { status: 'loading'; text: string; error: string | null }
  | { status: 'ready'; text: string; error: string | null }

type ExportNewline = 'lf' | 'crlf'

function normalizeNewlines(text: string, mode: ExportNewline) {
  const lf = text.replace(/\r\n/g, '\n')
  return mode === 'crlf' ? lf.replace(/\n/g, '\r\n') : lf
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"]/g, (m) => {
    if (m === '&') return '&amp;'
    if (m === '<') return '&lt;'
    if (m === '>') return '&gt;'
    return '&quot;'
  })
}

function buildAsciiHtmlDocument(ascii: string) {
  const body = escapeHtml(ascii)
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TxEditor Export</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 24px; background: #fff; color: #111827; }
      pre {
        margin: 0;
        padding: 16px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        background: #fff;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Cascadia Mono\", \"D2Coding\", \"Courier New\", monospace;
        font-size: 12px;
        line-height: 1.2;
        tab-size: 4;
        white-space: pre;
      }
    </style>
  </head>
  <body>
    <pre>${body}</pre>
  </body>
</html>`
}

async function renderAsciiToPngBytes(ascii: string, opts: { fontSize: number; lineHeight: number; padding: number; scale: number }) {
  const lines = ascii.replace(/\r\n/g, '\n').split('\n')
  const maxCols = lines.reduce((m, l) => Math.max(m, l.length), 0)

  const measureCanvas = document.createElement('canvas')
  const mctx = measureCanvas.getContext('2d')
  if (!mctx) throw new Error('Canvas not supported')

  const fontFamily =
    'Consolas, \"Cascadia Mono\", \"D2Coding\", \"Courier New\", ui-monospace, monospace'
  mctx.font = `${opts.fontSize}px ${fontFamily}`
  const charWidth = Math.ceil(mctx.measureText('M').width)
  const rowHeight = Math.ceil(opts.fontSize * opts.lineHeight)

  const width = opts.padding * 2 + Math.max(1, maxCols) * charWidth
  const height = opts.padding * 2 + Math.max(1, lines.length) * rowHeight

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * opts.scale)
  canvas.height = Math.ceil(height * opts.scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  ctx.scale(opts.scale, opts.scale)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#0f172a'
  ctx.font = `${opts.fontSize}px ${fontFamily}`
  ctx.textBaseline = 'top'

  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], opts.padding, opts.padding + i * rowHeight)
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b)
      else reject(new Error('Failed to encode PNG'))
    }, 'image/png')
  })
  const buf = await blob.arrayBuffer()
  return Array.from(new Uint8Array(buf))
}

function TopBar({ onExport }: { onExport: () => void }) {
  return (
    <div className="flex h-12 items-center gap-4 border-b border-slate-200 bg-white px-4">
      <div className="font-semibold text-slate-800">TxEditor</div>
      <div className="flex items-center gap-3 text-sm text-slate-700">
        <button type="button" className="hover:text-slate-900">
          File
        </button>
        <button type="button" className="hover:text-slate-900">
          Edit
        </button>
        <button type="button" className="hover:text-slate-900">
          View
        </button>
        <button type="button" className="hover:text-slate-900">
          Help
        </button>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
          onClick={onExport}
        >
          Export UI
        </button>
      </div>
    </div>
  )
}

function StatusBar() {
  const gridCellSize = useEditorStore((s) => s.gridCellSize)
  const activeTool = useEditorStore((s) => s.activeTool)
  const cursor = useEditorStore((s) => s.cursor)
  const row = cursor ? Math.floor(cursor.y / gridCellSize) + 1 : null
  const col = cursor ? Math.floor(cursor.x / gridCellSize) + 1 : null
  return (
    <div className="flex h-8 items-center justify-between border-t border-slate-200 bg-white px-3 text-xs text-slate-700">
      <div>
        Ln: {row ?? '-'}, Col: {col ?? '-'}
      </div>
      <div className="flex items-center gap-3">
        <div>Tool: {activeTool}</div>
        <div>Snap: {gridCellSize}px</div>
        <div>UTF-8: Valid</div>
        <div>Windows Webview2 (Tauri)</div>
      </div>
    </div>
  )
}

export default function App() {
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const duplicateSelected = useEditorStore((s) => s.duplicateSelected)
  const shapes = useEditorStore((s) => s.shapes)
  const gridCellSize = useEditorStore((s) => s.gridCellSize)
  const canExport = shapes.length > 0

  const [isExportOpen, setIsExportOpen] = useState(false)
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle', text: '', error: null })
  const [exportNewline, setExportNewline] = useState<ExportNewline>(() => (navigator.userAgent.includes('Windows') ? 'crlf' : 'lf'))
  const [pngFontSize, setPngFontSize] = useState(12)
  const [pngLineHeight, setPngLineHeight] = useState(1.2)
  const exportTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  const exportMetrics = useMemo(() => {
    const raw = exportState.text
    if (!raw) return null
    const lines = raw.replace(/\r\n/g, '\n').split('\n')
    const maxCols = lines.reduce((m, l) => Math.max(m, l.length), 0)
    return { lines: lines.length, maxCols }
  }, [exportState.text])

  const exportFontDiagnostics = useMemo(() => {
    if (!isExportOpen) return null
    const el = exportTextareaRef.current
    if (!el) return null
    const cs = window.getComputedStyle(el)
    const font = cs.font || `${cs.fontSize} ${cs.fontFamily}`
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return { fontFamily: cs.fontFamily, fontSize: cs.fontSize, lineHeight: cs.lineHeight, monospaceLikely: null as boolean | null, charWidthPx: null as number | null }
    ctx.font = font
    const wM = ctx.measureText('M').width
    const wW = ctx.measureText('W').width
    const wi = ctx.measureText('i').width
    const mono = Math.abs(wM - wW) < 0.01 && Math.abs(wM - wi) < 0.01
    return { fontFamily: cs.fontFamily, fontSize: cs.fontSize, lineHeight: cs.lineHeight, monospaceLikely: mono, charWidthPx: Math.round(wM * 100) / 100 }
  }, [isExportOpen])

  const exportArgs = useMemo(() => ({ shapes, gridCellSize }), [gridCellSize, shapes])

  async function refreshExportText() {
    setExportState((prev) => ({ status: 'loading', text: prev.text, error: null }))
    try {
      const text = await invoke<string>('export_ascii', exportArgs)
      setExportState({ status: 'ready', text, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setExportState((prev) => ({ status: 'ready', text: prev.text, error: message }))
    }
  }

  async function copyExportText() {
    const text = exportState.text
    if (!text) return
    await navigator.clipboard.writeText(normalizeNewlines(text, exportNewline))
  }

  async function saveExportText() {
    const text = exportState.text
    if (!text) return
    const path = await save({
      defaultPath: 'txeditor.txt',
      filters: [{ name: 'Text', extensions: ['txt'] }],
    })
    if (!path) return
    await invoke('write_text_file', { path, contents: normalizeNewlines(text, exportNewline) })
  }

  async function saveExportHtml() {
    const text = exportState.text
    if (!text) return
    const path = await save({
      defaultPath: 'txeditor.html',
      filters: [{ name: 'HTML', extensions: ['html'] }],
    })
    if (!path) return
    await invoke('write_text_file', { path, contents: buildAsciiHtmlDocument(text) })
  }

  async function saveExportPng() {
    const text = exportState.text
    if (!text) return
    const path = await save({
      defaultPath: 'txeditor.png',
      filters: [{ name: 'PNG', extensions: ['png'] }],
    })
    if (!path) return
    const bytes = await renderAsciiToPngBytes(text, {
      fontSize: pngFontSize,
      lineHeight: pngLineHeight,
      padding: 16,
      scale: window.devicePixelRatio || 1,
    })
    await invoke('write_binary_file', { path, bytes })
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return

      const key = e.key.toLowerCase()
      const ctrlOrMeta = e.ctrlKey || e.metaKey
      if (!ctrlOrMeta) return

      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }

      if (key === 'y') {
        e.preventDefault()
        redo()
        return
      }

      if (key === 'd') {
        e.preventDefault()
        duplicateSelected()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [duplicateSelected, redo, undo])

  return (
    <div className="flex h-full w-full flex-col">
      <TopBar
        onExport={() => {
          setIsExportOpen(true)
          if (exportState.status === 'idle' || exportState.text === '') void refreshExportText()
        }}
      />
      <div className="flex min-h-0 flex-1">
        <Toolbar />
        <div className="min-h-0 flex-1">
          <CanvasLayer />
        </div>
      </div>
      <StatusBar />
      {isExportOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-3xl rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="text-sm font-semibold text-slate-800">Export</div>
              <button
                type="button"
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                onClick={() => setIsExportOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="px-4 py-3">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={exportState.status === 'loading' || !canExport}
                  onClick={() => void refreshExportText()}
                >
                  Refresh
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={exportState.status === 'loading' || exportState.text === ''}
                  onClick={() => void copyExportText()}
                >
                  Copy
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={exportState.status === 'loading' || exportState.text === ''}
                  onClick={() => void saveExportText()}
                >
                  Save .txt
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={exportState.status === 'loading' || exportState.text === ''}
                  onClick={() => void saveExportHtml()}
                >
                  Save .html
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={exportState.status === 'loading' || exportState.text === ''}
                  onClick={() => void saveExportPng()}
                >
                  Save .png
                </button>
                <div className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                  <span>개행</span>
                  <select
                    className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs"
                    value={exportNewline}
                    onChange={(e) => setExportNewline(e.target.value as ExportNewline)}
                  >
                    <option value="lf">LF</option>
                    <option value="crlf">CRLF(Windows)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                  <span>PNG</span>
                  <label className="flex items-center gap-1">
                    <span>폰트</span>
                    <input
                      type="number"
                      min={8}
                      max={32}
                      step={1}
                      value={pngFontSize}
                      onChange={(e) => setPngFontSize(Number(e.target.value))}
                      className="w-16 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    <span>줄간격</span>
                    <input
                      type="number"
                      min={1}
                      max={2}
                      step={0.05}
                      value={pngLineHeight}
                      onChange={(e) => setPngLineHeight(Number(e.target.value))}
                      className="w-16 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs"
                    />
                  </label>
                </div>
                <div className="ml-auto text-xs text-slate-600">
                  {exportState.status === 'loading' ? 'Generating…' : canExport ? 'Ready' : 'No shapes'}
                </div>
              </div>
              {exportState.error ? (
                <div className="mb-2 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {exportState.error}
                </div>
              ) : null}
              <div className="mb-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <div>언어: {navigator.language}</div>
                  <div>DPI: {window.devicePixelRatio || 1}</div>
                  <div>
                    화면: {window.screen.width}×{window.screen.height}
                  </div>
                  <div>
                    뷰포트: {window.innerWidth}×{window.innerHeight}
                  </div>
                  {exportMetrics ? (
                    <div>
                      텍스트: {exportMetrics.lines}줄 / {exportMetrics.maxCols}열
                    </div>
                  ) : null}
                  {exportFontDiagnostics ? (
                    <div>
                      폰트폭: {exportFontDiagnostics.charWidthPx ?? '-'}px / 고정폭: {exportFontDiagnostics.monospaceLikely === null ? '-' : exportFontDiagnostics.monospaceLikely ? '예' : '아니오'}
                    </div>
                  ) : null}
                </div>
                <div className="mt-1 text-slate-600">
                  텍스트 기반 출력은 고정폭(monospaced) 폰트/공백 유지 설정이 아니면 레이아웃이 달라질 수 있습니다. 문서/프린트 목적이면 .html 또는 .png를 권장합니다.
                </div>
              </div>
              <textarea
                value={exportState.text}
                readOnly
                ref={exportTextareaRef}
                className="h-[50vh] w-full resize-none rounded border border-slate-300 bg-white p-3 font-mono text-xs text-slate-800"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
