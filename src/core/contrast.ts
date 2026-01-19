export type RGBA = { r: number; g: number; b: number; a: number }

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(1, v))
}

function clamp255(v: number) {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(255, Math.round(v)))
}

function parseRgbChannel(vRaw: string) {
  const v = vRaw.trim()
  if (!v) return null
  if (v.endsWith('%')) {
    const n = Number.parseFloat(v.slice(0, -1))
    if (!Number.isFinite(n)) return null
    return clamp255((n / 100) * 255)
  }
  const n = Number.parseFloat(v)
  if (!Number.isFinite(n)) return null
  return clamp255(n)
}

function parseAlphaChannel(vRaw: string) {
  const v = vRaw.trim()
  if (!v) return null
  if (v.endsWith('%')) {
    const n = Number.parseFloat(v.slice(0, -1))
    if (!Number.isFinite(n)) return null
    return clamp01(n / 100)
  }
  const n = Number.parseFloat(v)
  if (!Number.isFinite(n)) return null
  return clamp01(n)
}

export function parseCssColor(input: string): RGBA | null {
  const s = input.trim().toLowerCase()
  if (!s) return null
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }

  if (s.startsWith('#')) {
    const hex = s.slice(1)
    if (hex.length === 3 || hex.length === 4) {
      const r = Number.parseInt(hex[0] + hex[0], 16)
      const g = Number.parseInt(hex[1] + hex[1], 16)
      const b = Number.parseInt(hex[2] + hex[2], 16)
      const a = hex.length === 4 ? Number.parseInt(hex[3] + hex[3], 16) / 255 : 1
      if ([r, g, b, a].some((n) => !Number.isFinite(n))) return null
      return { r, g, b, a: clamp01(a) }
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = Number.parseInt(hex.slice(0, 2), 16)
      const g = Number.parseInt(hex.slice(2, 4), 16)
      const b = Number.parseInt(hex.slice(4, 6), 16)
      const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1
      if ([r, g, b, a].some((n) => !Number.isFinite(n))) return null
      return { r, g, b, a: clamp01(a) }
    }
    return null
  }

  const m = s.match(/^rgba?\((.*)\)$/)
  if (m) {
    const body = m[1] ?? ''
    const parts = body
      .split('/')
      .map((p) => p.trim())
      .filter(Boolean)
    if (parts.length === 0 || parts.length > 2) return null
    const rgbPart = parts[0] ?? ''
    const alphaPart = parts.length === 2 ? parts[1] : null
    const rgbTokens = rgbPart
      .split(/[, ]+/)
      .map((t) => t.trim())
      .filter(Boolean)
    if (rgbTokens.length < 3) return null
    const r = parseRgbChannel(rgbTokens[0] ?? '')
    const g = parseRgbChannel(rgbTokens[1] ?? '')
    const b = parseRgbChannel(rgbTokens[2] ?? '')
    if (r == null || g == null || b == null) return null

    let a = 1
    if (alphaPart != null) {
      const aa = parseAlphaChannel(alphaPart)
      if (aa == null) return null
      a = aa
    } else if (rgbTokens.length >= 4) {
      const aa = parseAlphaChannel(rgbTokens[3] ?? '')
      if (aa == null) return null
      a = aa
    }
    return { r, g, b, a }
  }

  return null
}

function toLinearRgbChannel(v255: number) {
  const s = clamp255(v255) / 255
  if (s <= 0.04045) return s / 12.92
  return ((s + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(color: RGBA) {
  const r = toLinearRgbChannel(color.r)
  const g = toLinearRgbChannel(color.g)
  const b = toLinearRgbChannel(color.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function compositeOver(fg: RGBA, bg: RGBA): RGBA {
  const fa = clamp01(fg.a)
  const ba = clamp01(bg.a)
  const outA = fa + ba * (1 - fa)
  if (outA <= 0) return { r: 0, g: 0, b: 0, a: 0 }
  const r = (fg.r * fa + bg.r * ba * (1 - fa)) / outA
  const g = (fg.g * fa + bg.g * ba * (1 - fa)) / outA
  const b = (fg.b * fa + bg.b * ba * (1 - fa)) / outA
  return { r: clamp255(r), g: clamp255(g), b: clamp255(b), a: outA }
}

function normalizeColor(input: string | RGBA): RGBA | null {
  if (typeof input === 'string') return parseCssColor(input)
  return { r: clamp255(input.r), g: clamp255(input.g), b: clamp255(input.b), a: clamp01(input.a) }
}

export function contrastRatio(
  foreground: string | RGBA,
  background: string | RGBA,
  opts?: { backdrop?: string | RGBA }
) {
  const fg = normalizeColor(foreground)
  const bg = normalizeColor(background)
  if (!fg || !bg) return null

  const backdrop = normalizeColor(opts?.backdrop ?? { r: 255, g: 255, b: 255, a: 1 }) ?? { r: 255, g: 255, b: 255, a: 1 }
  const bgOpaque = bg.a < 1 ? compositeOver(bg, backdrop) : bg
  const fgOpaque = fg.a < 1 ? compositeOver(fg, bgOpaque) : fg

  const l1 = relativeLuminance(fgOpaque)
  const l2 = relativeLuminance(bgOpaque)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

