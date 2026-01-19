import { describe, expect, it } from 'vitest'
import { useEditorStore } from './editorStore'

describe('editorStore', () => {
  it('initializes with default buffer', () => {
    const store = useEditorStore.getState()
    const buffer = store.getBuffer()
    expect(buffer.width).toBe(80)
    expect(buffer.height).toBe(24)
    expect(store.past.length).toBe(0)
  })

  it('updates buffer and manages history', () => {
    // Reset store
    useEditorStore.getState().newBuffer(80, 24)
    const store = useEditorStore.getState()
    
    // Commit new buffer
    store.commitBuffer({ width: 80, height: 24, lines: ['line1'] })
    
    expect(useEditorStore.getState().getBuffer().lines[0]).toBe('line1')
    // newBuffer adds 1 entry (empty), commitBuffer adds another (previous state) -> 2 entries
    expect(useEditorStore.getState().past.length).toBe(2)
    expect(useEditorStore.getState().past.length).toBeGreaterThan(0)
  })

  it('limits history size for large buffers', () => {
    useEditorStore.getState().newBuffer(10, 10)
    const store = useEditorStore.getState()
    
    // Case 1: Small buffer
    for (let i = 0; i < 205; i++) {
      useEditorStore.getState().commitBuffer({ width: 10, height: 10, lines: [`${i}`] })
    }
    expect(useEditorStore.getState().past.length).toBe(200)
    
    // Case 2: Huge buffer
    useEditorStore.getState().newBuffer(2000, 2000)
    
    // Clear history manually for test isolation if needed, but newBuffer resets past/future partially?
    // Looking at code: newBuffer sets past to appendPast(s.past...). It appends the *previous* state to history.
    // So history grows.
    // We should reset history explicitly for this test case to be clean.
    useEditorStore.setState({ past: [], future: [] })
    
    const hugeBuffer = { width: 2000, height: 2000, lines: [] }
    
    for (let i = 0; i < 25; i++) {
       useEditorStore.getState().commitBuffer(hugeBuffer)
    }
    
    expect(useEditorStore.getState().past.length).toBe(20)
  })

  it('undo/redo works correctly', () => {
    useEditorStore.getState().newBuffer(10, 10)
    useEditorStore.setState({ past: [], future: [], cursor: null })
    
    const getStore = () => useEditorStore.getState()
    
    getStore().commitBuffer({ width: 10, height: 10, lines: ['A'] })
    getStore().commitBuffer({ width: 10, height: 10, lines: ['B'] })
    
    expect(getStore().getBuffer().lines[0]).toBe('B')
    
    getStore().undo()
    expect(getStore().getBuffer().lines[0]).toBe('A')
    
    getStore().undo()
    expect(getStore().getBuffer().lines[0]).toBe('') 
    
    getStore().redo()
    expect(getStore().getBuffer().lines[0]).toBe('A')
  })

  describe('Layer Management', () => {
    it('supports adding and removing layers', () => {
      useEditorStore.getState().newBuffer(10, 10)
      const store = useEditorStore.getState()
      
      expect(store.layers.length).toBe(1)
      const firstLayerId = store.layers[0].id
      
      store.addLayer()
      expect(useEditorStore.getState().layers.length).toBe(2)
      
      store.removeLayer(firstLayerId)
      expect(useEditorStore.getState().layers.length).toBe(1)
      expect(useEditorStore.getState().layers[0].id).not.toBe(firstLayerId)
    })

    it('toggles layer locking', () => {
      useEditorStore.getState().newBuffer(10, 10)
      const store = useEditorStore.getState()
      const layerId = store.layers[0].id
      
      // console.log('Layer ID:', layerId)
      // console.log('Initial locked:', store.layers[0].locked)
      
      expect(store.layers[0].locked).toBe(false)
      
      useEditorStore.getState().toggleLayerLock(layerId)
      
      const updatedLayer = useEditorStore.getState().layers.find(l => l.id === layerId)
      // console.log('Updated locked:', updatedLayer?.locked)
      
      expect(updatedLayer).toBeDefined()
      expect(updatedLayer?.locked).toBe(true)
      
      useEditorStore.getState().toggleLayerLock(layerId)
      expect(useEditorStore.getState().layers.find(l => l.id === layerId)?.locked).toBe(false)
    })

    it('prevents modification on locked layers', () => {
      useEditorStore.getState().newBuffer(10, 10)
      const store = useEditorStore.getState()
      const layerId = store.layers[0].id
      
      // Initial state
      store.commitBuffer({ width: 10, height: 10, lines: ['Initial'] })
      expect(useEditorStore.getState().getBuffer().lines[0]).toBe('Initial')
      
      // Lock layer
      useEditorStore.getState().toggleLayerLock(layerId)
      expect(useEditorStore.getState().layers.find(l => l.id === layerId)?.locked).toBe(true)
      
      // Attempt modification via commitBuffer
      useEditorStore.getState().commitBuffer({ width: 10, height: 10, lines: ['Modified'] })
      
      // Should still be 'Initial'
      expect(useEditorStore.getState().getBuffer().lines[0]).toBe('Initial')
      
      // Attempt modification via setBufferFromText
      useEditorStore.getState().setBufferFromText('Modified2')
      expect(useEditorStore.getState().getBuffer().lines[0]).toBe('Initial')
      
      // Unlock and modify
      useEditorStore.getState().toggleLayerLock(layerId)
      useEditorStore.getState().commitBuffer({ width: 10, height: 10, lines: ['Final'] })
      expect(useEditorStore.getState().getBuffer().lines[0]).toBe('Final')
    })
  })
})
