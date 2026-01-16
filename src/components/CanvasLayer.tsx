import { useEffect, useMemo, useRef, useState } from 'react'
import { Circle, Layer, Rect, Stage } from 'react-konva'
import { useEditorStore } from '../store/editorStore'

type Size = { width: number; height: number }

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize({ width, height })
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, size }
}

export default function CanvasLayer() {
  const gridCellSize = useEditorStore((s) => s.gridCellSize)
  const { ref, size } = useElementSize<HTMLDivElement>()

  const dots = useMemo(() => {
    const width = Math.max(0, Math.floor(size.width))
    const height = Math.max(0, Math.floor(size.height))
    if (!width || !height || gridCellSize <= 0) return []

    const maxDots = 9000
    const cols = Math.floor(width / gridCellSize)
    const rows = Math.floor(height / gridCellSize)

    const points: Array<{ x: number; y: number }> = []
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        points.push({ x: c * gridCellSize, y: r * gridCellSize })
        if (points.length >= maxDots) return points
      }
    }
    return points
  }, [gridCellSize, size.height, size.width])

  return (
    <div ref={ref} className="h-full w-full bg-white">
      {size.width > 0 && size.height > 0 ? (
        <Stage width={size.width} height={size.height}>
          <Layer>
            <Rect x={0} y={0} width={size.width} height={size.height} fill="white" />
            {dots.map((p, i) => (
              <Circle key={i} x={p.x} y={p.y} radius={0.75} fill="#CBD5E1" />
            ))}
          </Layer>
        </Stage>
      ) : null}
    </div>
  )
}

