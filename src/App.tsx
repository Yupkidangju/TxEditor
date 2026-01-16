import CanvasLayer from './components/CanvasLayer'
import Toolbar from './components/Toolbar'
import { useEditorStore } from './store/editorStore'

function TopBar() {
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
  return (
    <div className="flex h-8 items-center justify-between border-t border-slate-200 bg-white px-3 text-xs text-slate-700">
      <div>Ln: -, Col: -</div>
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
  return (
    <div className="flex h-full w-full flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Toolbar />
        <div className="min-h-0 flex-1">
          <CanvasLayer />
        </div>
      </div>
      <StatusBar />
    </div>
  )
}

