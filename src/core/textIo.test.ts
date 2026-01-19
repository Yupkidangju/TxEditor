import { describe, expect, it } from 'vitest'

import { ensureDefaultExtension, isValidSavePath, normalizeForClipboard, normalizeForSave, stripUtf8Bom } from './textIo'

describe('textIo', () => {
  it('stripUtf8Bom removes BOM at start', () => {
    expect(stripUtf8Bom('\uFEFFabc')).toBe('abc')
    expect(stripUtf8Bom('abc')).toBe('abc')
  })

  it('normalizeForSave normalizes newlines and strips NUL', () => {
    expect(normalizeForSave('a\r\nb\rc\u0000d\n', 'lf')).toBe('a\nb\ncd\n')
    expect(normalizeForSave('a\r\nb\rc\u0000d\n', 'crlf')).toBe('a\r\nb\r\ncd\r\n')
  })

  it('normalizeForClipboard uses CRLF on windows', () => {
    expect(normalizeForClipboard('a\nb\r\nc\rd', 'windows')).toBe('a\r\nb\r\nc\r\nd')
  })

  it('ensureDefaultExtension keeps existing extension and adds .txt otherwise', () => {
    expect(ensureDefaultExtension('C:\\a\\b\\file.txt', 'txt')).toBe('C:\\a\\b\\file.txt')
    expect(ensureDefaultExtension('C:\\a\\b\\file', 'txt')).toBe('C:\\a\\b\\file.txt')
    expect(ensureDefaultExtension('.env', 'txt')).toBe('.env')
  })

  it('isValidSavePath validates windows file name basics', () => {
    expect(isValidSavePath('C:\\a\\b\\good.txt', 'windows')).toBe(true)
    expect(isValidSavePath('C:\\a\\b\\bad<.txt', 'windows')).toBe(false)
    expect(isValidSavePath('C:\\a\\b\\con.txt', 'windows')).toBe(false)
    expect(isValidSavePath('C:\\a\\b\\trail. ', 'windows')).toBe(false)
  })
})

