import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { bufferToText, useEditorStore } from './store/editorStore'

type BufferTemplate = '80x24' | '120x80' | '160x100'

const TEMPLATES: Array<{ id: BufferTemplate; width: number; height: number; label: string }> = [
  { id: '80x24', width: 80, height: 24, label: '80×24' },
  { id: '120x80', width: 120, height: 80, label: '120×80' },
  { id: '160x100', width: 160, height: 100, label: '160×100' }
]

type ExportNewline = 'lf' | 'crlf'

type Language = 'ko' | 'en' | 'ja' | 'zh-Hant' | 'zh-Hans'

type TextKey =
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
    newline: '개행',
    crlfWindows: 'CRLF(Windows)',
    padRightOnSave: '저장 시 우측 공백 채우기',
    ctrlCmdS: 'Ctrl/Cmd+S',
    ln: '행',
    col: '열',
    buffer: '버퍼'
  },
  en: {
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
    newline: 'Newline',
    crlfWindows: 'CRLF (Windows)',
    padRightOnSave: 'Pad right spaces on save',
    ctrlCmdS: 'Ctrl/Cmd+S',
    ln: 'Ln',
    col: 'Col',
    buffer: 'Buffer'
  },
  ja: {
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
    newline: '改行',
    crlfWindows: 'CRLF(Windows)',
    padRightOnSave: '保存時に右側の空白を埋める',
    ctrlCmdS: 'Ctrl/Cmd+S',
    ln: '行',
    col: '列',
    buffer: 'バッファ'
  },
  'zh-Hant': {
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
    newline: '換行',
    crlfWindows: 'CRLF(Windows)',
    padRightOnSave: '儲存時補齊右側空白',
    ctrlCmdS: 'Ctrl/Cmd+S',
    ln: '行',
    col: '列',
    buffer: '緩衝區'
  },
  'zh-Hans': {
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

function TopBar({
  language,
  onLanguageChange,
  onNew,
  onSave,
  onUndo,
  onRedo
}: {
  language: Language
  onLanguageChange: (lang: Language) => void
  onNew: () => void
  onSave: () => void
  onUndo: () => void
  onRedo: () => void
}) {
  const t = useCallback((key: TextKey) => TEXT[language][key], [language])
  return (
    <div className="flex h-12 items-center gap-4 border-b border-slate-200 bg-white px-4">
      <div className="font-semibold text-slate-800">TxEditor</div>
      <select
        className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
        value={language}
        onChange={(e) => onLanguageChange(e.target.value as Language)}
      >
        {Object.entries(LANGUAGE_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
          onClick={onUndo}
        >
          {t('undo')}
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
          onClick={onRedo}
        >
          {t('redo')}
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
          onClick={onNew}
        >
          {t('new')}
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
          onClick={onSave}
        >
          {t('save')}
        </button>
      </div>
    </div>
  )
}

function StatusBar({ language, newlineMode }: { language: Language; newlineMode: ExportNewline }) {
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

function getRowColFromTextarea(text: string, selectionStart: number) {
  const s = text.replace(/\r\n/g, '\n')
  const idx = clampInt(selectionStart, 0, s.length)
  const before = s.slice(0, idx)
  const parts = before.split('\n')
  const row = parts.length - 1
  const col = parts[parts.length - 1]?.length ?? 0
  return { row, col }
}

export default function App() {
  const buffer = useEditorStore((s) => s.buffer)
  const newBuffer = useEditorStore((s) => s.newBuffer)
  const setBufferFromText = useEditorStore((s) => s.setBufferFromText)
  const setCursor = useEditorStore((s) => s.setCursor)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)

  const [isNewOpen, setIsNewOpen] = useState(false)
  const [customWidth, setCustomWidth] = useState(80)
  const [customHeight, setCustomHeight] = useState(24)
  const [language, setLanguage] = useState<Language>('ko')
  const [exportNewline, setExportNewline] = useState<ExportNewline>(() =>
    navigator.userAgent.includes('Windows') ? 'crlf' : 'lf'
  )
  const [padRightOnSave, setPadRightOnSave] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const editorText = useMemo(() => bufferToText(buffer), [buffer])
  const t = useCallback((key: TextKey) => TEXT[language][key], [language])

  const saveBufferText = useCallback(async () => {
    const path = await save({
      defaultPath: 'txeditor.txt',
      filters: [{ name: 'Text', extensions: ['txt'] }]
    })
    if (!path) return
    const contents = normalizeNewlines(bufferToText(buffer, { padRight: padRightOnSave }), exportNewline)
    await invoke('write_text_file', { path, contents })
  }, [buffer, exportNewline, padRightOnSave])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      const ctrlOrMeta = e.ctrlKey || e.metaKey
      if (!ctrlOrMeta) return

      if (key === 's') {
        e.preventDefault()
        void saveBufferText()
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
  }, [redo, saveBufferText, undo])

  return (
    <div className="flex h-full w-full flex-col">
      <TopBar
        language={language}
        onLanguageChange={setLanguage}
        onNew={() => setIsNewOpen(true)}
        onSave={() => void saveBufferText()}
        onUndo={undo}
        onRedo={redo}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs text-slate-700">
            {buffer.width}×{buffer.height}
          </div>
          <div className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
            <span>{t('newline')}</span>
            <select
              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs"
              value={exportNewline}
              onChange={(e) => setExportNewline(e.target.value as ExportNewline)}
            >
              <option value="lf">LF</option>
              <option value="crlf">{t('crlfWindows')}</option>
            </select>
          </div>
          <label className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={padRightOnSave}
              onChange={(e) => setPadRightOnSave(e.target.checked)}
            />
            <span>{t('padRightOnSave')}</span>
          </label>
          <div className="ml-auto text-xs text-slate-600">{t('ctrlCmdS')}</div>
        </div>

        <textarea
          ref={textareaRef}
          value={editorText}
          onChange={(e) => {
            setBufferFromText(e.target.value)
            const { row, col } = getRowColFromTextarea(e.target.value, e.target.selectionStart ?? 0)
            setCursor({ row, col })
          }}
          onSelect={(e) => {
            const el = e.currentTarget
            const { row, col } = getRowColFromTextarea(el.value, el.selectionStart ?? 0)
            setCursor({ row, col })
          }}
          onClick={(e) => {
            const el = e.currentTarget
            const { row, col } = getRowColFromTextarea(el.value, el.selectionStart ?? 0)
            setCursor({ row, col })
          }}
          className="min-h-0 flex-1 resize-none rounded border border-slate-300 bg-white p-3 font-mono text-xs text-slate-800 outline-none"
          spellCheck={false}
          wrap="off"
        />
      </div>
      <StatusBar language={language} newlineMode={exportNewline} />

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
                      queueMicrotask(() => textareaRef.current?.focus())
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
                      queueMicrotask(() => textareaRef.current?.focus())
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
