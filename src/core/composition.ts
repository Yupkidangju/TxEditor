import {
  type Layer,
  type TextBuffer,
  toCells,
  CONTINUATION_CELL,
  TRANSPARENT_CELL,
  cellDisplayWidth
} from './cells'

function setCharInGrid(row: string[], col: number, ch: string, width: number) {
  if (col < 0 || col >= width) return

  // 1. Handle clearing previous content at current position
  // If we are overwriting a tail (CONTINUATION_CELL), clear its head
  if (row[col] === CONTINUATION_CELL) {
    let start = col - 1
    while (start >= 0 && row[start] === CONTINUATION_CELL) start -= 1
    if (start >= 0) row[start] = ' '
  } 
  // If we are overwriting a head (wide char), clear its tail
  else if (cellDisplayWidth(row[col] ?? ' ') === 2) {
    if (col + 1 < width && row[col + 1] === CONTINUATION_CELL) {
      row[col + 1] = ' '
    }
  }

  // 2. Set the new character
  row[col] = ch

  // 3. Handle wide character placement
  if (cellDisplayWidth(ch) === 2) {
    if (col + 1 < width) {
      // We need to place a tail at col+1.
      // First, check what we are overwriting at col+1.
      
      const nextCh = row[col + 1]
      if (nextCh === CONTINUATION_CELL) {
         // It was a tail of something else? 
         // Since we cleared row[col] (head or tail), if row[col+1] was a tail, its head was row[col].
         // But we just overwrote row[col].
         // So row[col+1] is now an orphan tail, which we will overwrite with NEW tail.
         // So this is fine.
      } else if (cellDisplayWidth(nextCh ?? ' ') === 2) {
         // It was a head. We must clear its tail at col+2.
         if (col + 2 < width && row[col + 2] === CONTINUATION_CELL) {
           row[col + 2] = ' '
         }
      }
      
      row[col + 1] = CONTINUATION_CELL
    } else {
      // Not enough space for wide char at edge. Replace with space.
      row[col] = ' '
    }
  }
}

export function compositeBuffers(layers: Layer[], width: number, height: number): TextBuffer {
  // Initialize grid with spaces
  const grid: string[][] = []
  for (let r = 0; r < height; r += 1) {
    grid[r] = new Array(width).fill(' ')
  }

  for (const layer of layers) {
    if (!layer.visible) continue

    for (let r = 0; r < height; r += 1) {
      if (r >= layer.buffer.height) continue
      
      const line = layer.buffer.lines[r] ?? ''
      const cells = toCells(line)
      
      let col = 0
      let i = 0
      while (i < cells.length) {
        if (col >= width) break
        
        const ch = cells[i]
        
        // Handle transparency (Space is also transparent per Designs.md)
        if (ch === TRANSPARENT_CELL || ch === ' ') {
           col += 1
           i += 1
           continue
        }
        
        const w = cellDisplayWidth(ch)
        
        if (w === 2) {
           setCharInGrid(grid[r], col, ch, width)
           col += 2
           
           // Consume implicit tail if present in source
           if (i + 1 < cells.length && cells[i + 1] === CONTINUATION_CELL) {
             i += 1
           }
        } else {
           setCharInGrid(grid[r], col, ch, width)
           col += 1
        }
        i += 1
      }
    }
  }

  const lines = grid.map(row => row.join(''))
  return { width, height, lines }
}
