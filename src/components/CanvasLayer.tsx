import { useEffect, useMemo, useRef, useState } from 'react'
import { Arrow, Circle, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { createId, normalizeBox, type Shape } from '../core/shapes'
import { snapToGrid } from '../core/grid'
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
  const activeTool = useEditorStore((s) => s.activeTool)
  const shapes = useEditorStore((s) => s.shapes)
  const selectedShapeId = useEditorStore((s) => s.selectedShapeId)
  const addShape = useEditorStore((s) => s.addShape)
  const removeShape = useEditorStore((s) => s.removeShape)
  const updateShape = useEditorStore((s) => s.updateShape)
  const setSelectedShapeId = useEditorStore((s) => s.setSelectedShapeId)
  const setCursor = useEditorStore((s) => s.setCursor)
  const { ref, size } = useElementSize<HTMLDivElement>()
  const stageRef = useRef<import('konva/lib/Stage').Stage | null>(null)
  const transformerRef = useRef<import('konva/lib/shapes/Transformer').Transformer | null>(null)
  const draftRef = useRef<{ start: { x: number; y: number }; shape: Shape } | null>(null)
  const selectionRef = useRef<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(
    null
  )
  const [draftShape, setDraftShape] = useState<Shape | null>(null)
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null
  )
  const [textEditor, setTextEditor] = useState<{
    id: string
    value: string
    initialValue: string
    x: number
    y: number
    width: number
    height: number
    fontSize: number
  } | null>(null)
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null)

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return

      if (e.key === 'Escape') {
        draftRef.current = null
        setDraftShape(null)
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selectedShapeId) return
        removeShape(selectedShapeId)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [removeShape, selectedShapeId])

  useEffect(() => {
    const el = textAreaRef.current
    if (!textEditor || !el) return
    el.focus()
    el.select()
  }, [textEditor])

  useEffect(() => {
    const transformer = transformerRef.current
    const stage = stageRef.current
    if (!transformer || !stage) return

    if (activeTool !== 'select' || !selectedShapeId) {
      transformer.nodes([])
      transformer.getLayer()?.batchDraw()
      return
    }

    const selected = shapes.find((s) => s.id === selectedShapeId)
    if (!selected || selected.type !== 'box') {
      transformer.nodes([])
      transformer.getLayer()?.batchDraw()
      return
    }

    const node = stage.findOne(`#${selectedShapeId}`)
    transformer.nodes(node ? [node] : [])
    transformer.getLayer()?.batchDraw()
  }, [activeTool, selectedShapeId, shapes])

  const updateCursorFromEvent = () => {
    const stage = stageRef.current
    if (!stage) return
    const pos = stage.getPointerPosition()
    if (!pos) return
    setCursor(snapToGrid({ x: pos.x, y: pos.y }, gridCellSize))
  }

  const handleMouseMove = () => {
    updateCursorFromEvent()

    if (activeTool === 'select') {
      const selection = selectionRef.current
      const stage = stageRef.current
      if (selection && stage) {
        const pos = stage.getPointerPosition()
        if (pos) {
          const next = { ...selection, end: { x: pos.x, y: pos.y } }
          selectionRef.current = next
          const normalized = normalizeBox(next.start, next.end)
          setSelectionRect(normalized)
        }
      }
    }

    const draft = draftRef.current
    if (!draft) return
    const stage = stageRef.current
    if (!stage) return
    const pos = stage.getPointerPosition()
    if (!pos) return
    const end = snapToGrid({ x: pos.x, y: pos.y }, gridCellSize)

    if (draft.shape.type === 'box') {
      const normalized = normalizeBox(draft.start, end)
      const next: Shape = { ...draft.shape, ...normalized }
      draftRef.current = { ...draft, shape: next }
      setDraftShape(next)
      return
    }

    if (draft.shape.type === 'line' || draft.shape.type === 'arrow') {
      const next: Shape = { ...draft.shape, x2: end.x, y2: end.y }
      draftRef.current = { ...draft, shape: next }
      setDraftShape(next)
    }
  }

  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    updateCursorFromEvent()

    const stage = stageRef.current
    if (!stage) return
    const pos = stage.getPointerPosition()
    if (!pos) return
    const p = snapToGrid({ x: pos.x, y: pos.y }, gridCellSize)

    if (activeTool === 'select') {
      const target = e.target
      const isBackground = target === stage || (typeof target.name === 'function' && target.name() === 'background')
      if (!isBackground) return
      setSelectedShapeId(null)
      selectionRef.current = { start: { x: pos.x, y: pos.y }, end: { x: pos.x, y: pos.y } }
      setSelectionRect({ x: pos.x, y: pos.y, width: 0, height: 0 })
      return
    }

    if (activeTool === 'text') {
      addShape({ id: createId(), createdAt: Date.now(), type: 'text', x: p.x, y: p.y, text: 'Text' })
      return
    }

    const id = createId()
    const createdAt = Date.now()

    if (activeTool === 'box') {
      const shape: Shape = { id, createdAt, type: 'box', x: p.x, y: p.y, width: 0, height: 0 }
      draftRef.current = { start: p, shape }
      setDraftShape(shape)
      return
    }

    if (activeTool === 'line') {
      const shape: Shape = { id, createdAt, type: 'line', x1: p.x, y1: p.y, x2: p.x, y2: p.y }
      draftRef.current = { start: p, shape }
      setDraftShape(shape)
      return
    }

    if (activeTool === 'arrow') {
      const shape: Shape = { id, createdAt, type: 'arrow', x1: p.x, y1: p.y, x2: p.x, y2: p.y }
      draftRef.current = { start: p, shape }
      setDraftShape(shape)
    }
  }

  const handleMouseUp = () => {
    const selection = selectionRef.current
    if (activeTool === 'select' && selectionRect && selection) {
      const stage = stageRef.current
      if (stage) {
        const hits: Shape[] = []
        for (const shape of shapes) {
          const node = stage.findOne(`#${shape.id}`)
          if (!node) continue
          const rect = node.getClientRect()
          const intersects =
            rect.x < selectionRect.x + selectionRect.width &&
            rect.x + rect.width > selectionRect.x &&
            rect.y < selectionRect.y + selectionRect.height &&
            rect.y + rect.height > selectionRect.y
          if (intersects) hits.push(shape)
        }
        const picked = hits[hits.length - 1]
        setSelectedShapeId(picked ? picked.id : null)
      }
      selectionRef.current = null
      setSelectionRect(null)
      return
    }

    const draft = draftRef.current
    if (!draft) return
    const shape = draft.shape
    draftRef.current = null
    setDraftShape(null)

    if (shape.type === 'box') {
      if (shape.width <= 0 || shape.height <= 0) return
      addShape(shape)
      return
    }

    if (shape.type === 'line' || shape.type === 'arrow') {
      if (shape.x1 === shape.x2 && shape.y1 === shape.y2) return
      addShape(shape)
    }
  }

  const renderShape = (shape: Shape) => {
    const isSelected = shape.id === selectedShapeId
    const stroke = isSelected ? '#2563EB' : '#0F172A'

    if (shape.type === 'box') {
      return (
        <Rect
          key={shape.id}
          id={shape.id}
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          stroke={stroke}
          strokeWidth={2}
          draggable={activeTool === 'select' && isSelected}
          onMouseDown={(e) => {
            if (activeTool !== 'select') return
            e.cancelBubble = true
            setSelectedShapeId(shape.id)
          }}
          onDragEnd={(e) => {
            const node = e.target
            const snapped = snapToGrid({ x: node.x(), y: node.y() }, gridCellSize)
            node.position(snapped)
            updateShape(shape.id, (prev) => (prev.type === 'box' ? { ...prev, x: snapped.x, y: snapped.y } : prev))
          }}
          onTransformEnd={(e) => {
            const node = e.target
            const scaleX = node.scaleX()
            const scaleY = node.scaleY()

            const rawWidth = node.width() * scaleX
            const rawHeight = node.height() * scaleY

            node.scaleX(1)
            node.scaleY(1)

            const snappedPos = snapToGrid({ x: node.x(), y: node.y() }, gridCellSize)
            const snappedWidth = Math.max(
              gridCellSize,
              Math.round(rawWidth / gridCellSize) * gridCellSize
            )
            const snappedHeight = Math.max(
              gridCellSize,
              Math.round(rawHeight / gridCellSize) * gridCellSize
            )

            node.position(snappedPos)
            node.width(snappedWidth)
            node.height(snappedHeight)

            updateShape(shape.id, (prev) =>
              prev.type === 'box'
                ? { ...prev, x: snappedPos.x, y: snappedPos.y, width: snappedWidth, height: snappedHeight }
                : prev
            )
          }}
        />
      )
    }

    if (shape.type === 'line') {
      return (
        <Line
          key={shape.id}
          id={shape.id}
          points={[shape.x1, shape.y1, shape.x2, shape.y2]}
          stroke={stroke}
          strokeWidth={2}
          lineCap="round"
          hitStrokeWidth={12}
          draggable={activeTool === 'select' && isSelected}
          onMouseDown={(e) => {
            if (activeTool !== 'select') return
            e.cancelBubble = true
            setSelectedShapeId(shape.id)
          }}
          onDragEnd={(e) => {
            const node = e.target
            const dx = node.x()
            const dy = node.y()
            if (!dx && !dy) return

            const snappedDx = Math.round(dx / gridCellSize) * gridCellSize
            const snappedDy = Math.round(dy / gridCellSize) * gridCellSize

            node.position({ x: 0, y: 0 })
            updateShape(shape.id, (prev) => {
              if (prev.type !== 'line') return prev
              const next = {
                ...prev,
                x1: prev.x1 + snappedDx,
                y1: prev.y1 + snappedDy,
                x2: prev.x2 + snappedDx,
                y2: prev.y2 + snappedDy
              }
              return {
                ...next,
                x1: snapToGrid({ x: next.x1, y: next.y1 }, gridCellSize).x,
                y1: snapToGrid({ x: next.x1, y: next.y1 }, gridCellSize).y,
                x2: snapToGrid({ x: next.x2, y: next.y2 }, gridCellSize).x,
                y2: snapToGrid({ x: next.x2, y: next.y2 }, gridCellSize).y
              }
            })
          }}
        />
      )
    }

    if (shape.type === 'arrow') {
      return (
        <Arrow
          key={shape.id}
          id={shape.id}
          points={[shape.x1, shape.y1, shape.x2, shape.y2]}
          stroke={stroke}
          fill={stroke}
          strokeWidth={2}
          pointerLength={10}
          pointerWidth={10}
          hitStrokeWidth={12}
          draggable={activeTool === 'select' && isSelected}
          onMouseDown={(e) => {
            if (activeTool !== 'select') return
            e.cancelBubble = true
            setSelectedShapeId(shape.id)
          }}
          onDragEnd={(e) => {
            const node = e.target
            const dx = node.x()
            const dy = node.y()
            if (!dx && !dy) return

            const snappedDx = Math.round(dx / gridCellSize) * gridCellSize
            const snappedDy = Math.round(dy / gridCellSize) * gridCellSize

            node.position({ x: 0, y: 0 })
            updateShape(shape.id, (prev) => {
              if (prev.type !== 'arrow') return prev
              const next = {
                ...prev,
                x1: prev.x1 + snappedDx,
                y1: prev.y1 + snappedDy,
                x2: prev.x2 + snappedDx,
                y2: prev.y2 + snappedDy
              }
              return {
                ...next,
                x1: snapToGrid({ x: next.x1, y: next.y1 }, gridCellSize).x,
                y1: snapToGrid({ x: next.x1, y: next.y1 }, gridCellSize).y,
                x2: snapToGrid({ x: next.x2, y: next.y2 }, gridCellSize).x,
                y2: snapToGrid({ x: next.x2, y: next.y2 }, gridCellSize).y
              }
            })
          }}
        />
      )
    }

    const isEditing = textEditor?.id === shape.id
    return (
      <Text
        key={shape.id}
        id={shape.id}
        x={shape.x}
        y={shape.y}
        text={shape.text}
        fontSize={14}
        fill={stroke}
        opacity={isEditing ? 0 : 1}
        draggable={activeTool === 'select' && isSelected && !isEditing}
        onMouseDown={(e) => {
          if (activeTool !== 'select') return
          e.cancelBubble = true
          setSelectedShapeId(shape.id)
        }}
        onDblClick={(e) => {
          if (activeTool !== 'select') return
          e.cancelBubble = true
          setSelectedShapeId(shape.id)
          const node = e.target as unknown as import('konva/lib/shapes/Text').Text
          const absPos = node.getAbsolutePosition()
          const width = Math.max(80, node.width() || 0)
          const height = Math.max(24, node.height() || 0)
          const value = shape.text
          setTextEditor({
            id: shape.id,
            value,
            initialValue: value,
            x: absPos.x,
            y: absPos.y,
            width,
            height,
            fontSize: node.fontSize()
          })
        }}
        onDragEnd={(e) => {
          const node = e.target
          const snapped = snapToGrid({ x: node.x(), y: node.y() }, gridCellSize)
          node.position(snapped)
          updateShape(shape.id, (prev) => (prev.type === 'text' ? { ...prev, x: snapped.x, y: snapped.y } : prev))
        }}
      />
    )
  }

  return (
    <div ref={ref} className="relative h-full w-full bg-white">
      {textEditor ? (
        <textarea
          ref={(node) => {
            textAreaRef.current = node
          }}
          value={textEditor.value}
          style={{
            left: textEditor.x,
            top: textEditor.y,
            width: textEditor.width,
            height: textEditor.height,
            fontSize: textEditor.fontSize
          }}
          className="absolute z-10 resize-none rounded border border-blue-600 bg-white px-1 py-0.5 font-mono text-slate-900 outline-none"
          onChange={(e) => setTextEditor((s) => (s ? { ...s, value: e.target.value } : s))}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              setTextEditor(null)
              return
            }

            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (textEditor.value !== textEditor.initialValue) {
                updateShape(textEditor.id, (prev) =>
                  prev.type === 'text' ? { ...prev, text: textEditor.value } : prev
                )
              }
              setTextEditor(null)
            }
          }}
          onBlur={() => {
            if (textEditor.value !== textEditor.initialValue) {
              updateShape(textEditor.id, (prev) =>
                prev.type === 'text' ? { ...prev, text: textEditor.value } : prev
              )
            }
            setTextEditor(null)
          }}
        />
      ) : null}
      {size.width > 0 && size.height > 0 ? (
        <Stage
          ref={(node) => {
            stageRef.current = node
          }}
          width={size.width}
          height={size.height}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
        >
          <Layer>
            <Rect name="background" x={0} y={0} width={size.width} height={size.height} fill="white" />
            {dots.map((p, i) => (
              <Circle key={i} x={p.x} y={p.y} radius={0.75} fill="#CBD5E1" />
            ))}
            {shapes.map(renderShape)}
            {draftShape ? renderShape(draftShape) : null}
            {activeTool === 'select' && selectionRect ? (
              <Rect
                x={selectionRect.x}
                y={selectionRect.y}
                width={selectionRect.width}
                height={selectionRect.height}
                fill="rgba(37,99,235,0.12)"
                stroke="#2563EB"
                strokeWidth={1}
                listening={false}
              />
            ) : null}
            <Transformer
              ref={(node) => {
                transformerRef.current = node
              }}
              rotateEnabled={false}
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
            />
          </Layer>
        </Stage>
      ) : null}
    </div>
  )
}
