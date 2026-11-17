import { describe, expect, it } from 'vitest'
import { detectFileType } from '../file-type'

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)).concat(new Array(16).fill(0)))
const ftyp = (major: string, ...compat: string[]) => bytes([0, 0, 0, 16 + 4 * compat.length], 'ftyp', major, [0, 0, 0, 0], compat.join(''))

describe('detectFileType', () => {
  it('recognises the accepted formats from their content', () => {
    expect(detectFileType(bytes([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe('image/jpeg')
    expect(detectFileType(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mime).toBe('image/png')
    expect(detectFileType(bytes('RIFF', [0, 0, 0, 0], 'WEBPVP8 '))?.mime).toBe('image/webp')
    expect(detectFileType(ftyp('avif', 'mif1', 'miaf'))?.mime).toBe('image/avif')
    expect(detectFileType(ftyp('mif1', 'avif'))?.mime).toBe('image/avif')
    expect(detectFileType(ftyp('isom', 'iso2', 'mp41'))?.mime).toBe('video/mp4')
    expect(detectFileType(ftyp('qt  '))?.mime).toBe('video/quicktime')
    expect(detectFileType(bytes([0x1a, 0x45, 0xdf, 0xa3], [0x42, 0x82, 0x84], 'webm'))?.mime).toBe('video/webm')
  })

  it('rejects HTML, SVG, scripts and unknown containers whatever their name or declared type', () => {
    expect(detectFileType(bytes('<!doctype html><script>alert(1)</script>'))).toBeNull()
    expect(detectFileType(bytes('<svg xmlns="http://www.w3.org/2000/svg" onload="x()">'))).toBeNull()
    expect(detectFileType(bytes('%PDF-1.7'))).toBeNull()
    expect(detectFileType(ftyp('heic'))).toBeNull()
    expect(detectFileType(new Uint8Array([0xff, 0xd8]))).toBeNull()
  })
})
