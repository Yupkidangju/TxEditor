import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./components/CanvasLayer', () => ({
  default: function CanvasLayerMock() {
    return <div />
  }
}))
import App from './App'

describe('App', () => {
  it('renders app shell', () => {
    const { getByText } = render(<App />)
    expect(getByText('TxEditor')).toBeTruthy()
  })
})
