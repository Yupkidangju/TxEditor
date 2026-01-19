export type PlatformId = 'windows' | 'other'

export function stripUtf8Bom(text: string) {
  if (!text) return ''
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

function toLf(text: string) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

export function normalizeForSave(text: string, newline: 'lf' | 'crlf') {
  const noNull = text.replace(/\u0000/g, '')
  const lf = toLf(noNull)
  return newline === 'crlf' ? lf.replace(/\n/g, '\r\n') : lf
}

export function normalizeForClipboard(text: string, platform: PlatformId) {
  const noNull = text.replace(/\u0000/g, '')
  const lf = toLf(noNull)
  return platform === 'windows' ? lf.replace(/\n/g, '\r\n') : lf
}

export function basename(path: string) {
  const parts = path.split(/[\\/]/)
  const last = parts[parts.length - 1]
  return last || path
}

export function dirname(path: string) {
  const parts = path.split(/[\\/]/)
  if (parts.length <= 1) return ''
  return parts.slice(0, -1).join(path.includes('\\') ? '\\' : '/')
}

export function joinPath(dir: string, file: string) {
  if (!dir) return file
  const sep = dir.includes('\\') ? '\\' : '/'
  const trimmed = dir.endsWith('\\') || dir.endsWith('/') ? dir.slice(0, -1) : dir
  return `${trimmed}${sep}${file}`
}

export function hasExtension(path: string) {
  const base = basename(path)
  if (!base || base === '.' || base === '..') return false
  if (base.endsWith('.')) return false
  return base.includes('.')
}

export function ensureDefaultExtension(path: string, extWithoutDot: string) {
  if (hasExtension(path)) return path
  return `${path}.${extWithoutDot}`
}

function isReservedWindowsBaseName(baseUpper: string) {
  if (baseUpper === 'CON' || baseUpper === 'PRN' || baseUpper === 'AUX' || baseUpper === 'NUL') return true
  if (/^COM[1-9]$/.test(baseUpper)) return true
  if (/^LPT[1-9]$/.test(baseUpper)) return true
  return false
}

export function isValidSavePath(path: string, platform: PlatformId) {
  if (!path) return false
  if (path.includes('\u0000')) return false
  if (path.endsWith('\\') || path.endsWith('/')) return false

  const base = basename(path)
  if (!base || base === '.' || base === '..') return false

  if (platform !== 'windows') return true

  if (/[<>:"/\\|?*]/.test(base)) return false
  if (base.endsWith(' ') || base.endsWith('.')) return false

  const dot = base.lastIndexOf('.')
  const bare = dot >= 0 ? base.slice(0, dot) : base
  if (isReservedWindowsBaseName(bare.toUpperCase())) return false
  return true
}

