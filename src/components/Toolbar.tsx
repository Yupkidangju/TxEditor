import { useEffect } from 'react'
import { useEditorStore, type ToolType } from '../store/editorStore'

type ToolButton = { tool: ToolType; label: string; hotkey: string }

const TOOL_BUTTONS: ToolButton[] = [
  { tool: 'select', label: 'S', hotkey: 'S' },
  { tool: 'box', label: 'B', hotkey: 'B' },
  { tool: 'arrow', label: 'A', hotkey: 'A' },
  { tool: 'line', label: 'L', hotkey: 'L' },
  { tool: 'text', label: 'T', hotkey: 'T' }
]

export default function Toolbar() {
  const activeTool = useEditorStore((s) => s.activeTool)
  const setActiveTool = useEditorStore((s) => s.setActiveTool)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return

      const key = e.key.toLowerCase()
      const tool = TOOL_BUTTONS.find((b) => b.hotkey.toLowerCase() === key)?.tool
      if (!tool) return
      setActiveTool(tool)
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setActiveTool])

  return (
    <div className="flex h-full w-16 flex-col items-center gap-2 border-r border-slate-200 bg-white p-2">
      <div className="text-xs font-semibold text-slate-700">Tool</div>
      <div className="flex w-full flex-col gap-2">
        {TOOL_BUTTONS.map((b) => {
          const isActive = b.tool === activeTool
          return (
            <button
              key={b.tool}
              type="button"
              onClick={() => setActiveTool(b.tool)}
              className={[
                'w-full rounded border px-0 py-2 text-sm font-semibold',
                isActive
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              ].join(' ')}
              aria-pressed={isActive}
              title={`${b.tool} (${b.hotkey})`}
            >
              {b.label}
            </button>
          )
        })}
      </div>

      <div className="mt-auto w-full rounded border border-slate-200 bg-slate-50 p-2 text-[10px] text-slate-700">
        <div className="font-semibold">Active</div>
        <div className="uppercase">{activeTool}</div>
      </div>
    </div>
  )
}
