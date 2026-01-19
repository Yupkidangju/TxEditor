import { describe, expect, it } from 'vitest'

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { contrastRatio, parseCssColor } from './contrast'

describe('parseCssColor', () => {
  it('parses hex colors', () => {
    expect(parseCssColor('#000')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
    expect(parseCssColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(parseCssColor('#00000080')).toEqual({ r: 0, g: 0, b: 0, a: 128 / 255 })
  })

  it('parses rgb/rgba colors', () => {
    expect(parseCssColor('rgb(0 0 0)')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
    expect(parseCssColor('rgb(255,255,255)')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(parseCssColor('rgba(0, 0, 0, 0.5)')).toEqual({ r: 0, g: 0, b: 0, a: 0.5 })
    expect(parseCssColor('rgb(0 0 0 / 50%)')).toEqual({ r: 0, g: 0, b: 0, a: 0.5 })
  })
})

describe('contrastRatio', () => {
  it('returns 21 for pure black on white', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 6)
    expect(contrastRatio('rgb(0 0 0)', 'rgb(255 255 255)')).toBeCloseTo(21, 6)
  })

  it('returns 1 for identical colors', () => {
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1, 8)
  })

  it('distinguishes 4.5:1 threshold near gray on white', () => {
    const nearFail = contrastRatio('#777777', '#ffffff')
    const nearPass = contrastRatio('#767676', '#ffffff')
    expect(nearFail).not.toBeNull()
    expect(nearPass).not.toBeNull()
    expect(nearFail!).toBeLessThan(4.5)
    expect(nearPass!).toBeGreaterThanOrEqual(4.5)
  })

  it('meets 4.5:1 for core theme pairs in styles.css', () => {
    const css = readFileSync(path.resolve(process.cwd(), 'src', 'styles.css'), 'utf8').replace(/\r\n/g, '\n')
    const themeIds = [
      'light',
      'dark',
      'monokai',
      'kimble-dark',
      'dracula',
      'nord',
      'solarized-light',
      'solarized-dark'
    ] as const

    const extractBlockVars = (selector: string) => {
      const selectorIndex = css.indexOf(selector)
      if (selectorIndex < 0) return {}
      const openBraceIndex = css.indexOf('{', selectorIndex + selector.length)
      if (openBraceIndex < 0) return {}

      let depth = 0
      let closeBraceIndex = -1
      for (let i = openBraceIndex; i < css.length; i++) {
        const ch = css[i]
        if (ch === '{') depth++
        else if (ch === '}') depth--
        if (depth === 0) {
          closeBraceIndex = i
          break
        }
      }
      if (closeBraceIndex < 0) return {}

      const body = css.slice(openBraceIndex + 1, closeBraceIndex)
      const vars: Record<string, string> = {}
      for (const mm of body.matchAll(/(--ui-[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
        const k = (mm[1] ?? '').trim()
        const v = (mm[2] ?? '').trim()
        if (k && v) vars[k] = v
      }
      return vars
    }

    for (const id of themeIds) {
      const vars = extractBlockVars(`html[data-theme='${id}']`)
      const pairs: Array<[string, string, string]> = [
        ['--ui-text', '--ui-bg', `${id}: ui-text on ui-bg`],
        ['--ui-text', '--ui-surface', `${id}: ui-text on ui-surface`],
        ['--ui-editor-text', '--ui-editor-bg', `${id}: ui-editor-text on ui-editor-bg`],
        ['--ui-primary-contrast', '--ui-primary', `${id}: ui-primary-contrast on ui-primary`]
      ]

      for (const [fgKey, bgKey, label] of pairs) {
        const fg = vars[fgKey]
        const bg = vars[bgKey]
        expect(fg, `${label} missing ${fgKey}`).toBeTruthy()
        expect(bg, `${label} missing ${bgKey}`).toBeTruthy()
        expect(parseCssColor(fg!), `${label} unparsable fg`).not.toBeNull()
        expect(parseCssColor(bg!), `${label} unparsable bg`).not.toBeNull()
        const ratio = contrastRatio(fg!, bg!)
        expect(ratio, `${label} ratio null`).not.toBeNull()
        expect(ratio!, `${label} ratio`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})
