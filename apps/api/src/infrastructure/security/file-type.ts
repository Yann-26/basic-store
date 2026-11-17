/**
 * Identifies a media file from its first bytes ("magic numbers") instead of
 * trusting the browser-declared MIME type or the file name.
 */
export interface DetectedType {
  mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif' | 'video/mp4' | 'video/quicktime' | 'video/webm'
  ext: 'jpg' | 'png' | 'webp' | 'avif' | 'mp4' | 'mov' | 'webm'
  kind: 'image' | 'video'
}

const ascii = (b: Uint8Array, start: number, end: number) => String.fromCharCode(...b.subarray(start, end))
const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v)

const AVIF_BRANDS = new Set(['avif', 'avis'])
const QUICKTIME_BRANDS = new Set(['qt  '])
const MP4_BRANDS = new Set(['isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'mp71', 'avc1', 'M4V ', 'M4VH', 'M4VP', 'dash', 'MSNV', 'f4v '])

export function detectFileType(bytes: Uint8Array): DetectedType | null {
  if (bytes.length < 12) return null
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: 'jpg', kind: 'image' }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: 'image/png', ext: 'png', kind: 'image' }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp', kind: 'image' }

  // ISO base media (AVIF, MP4, MOV): size(4) 'ftyp' major-brand(4) minor(4) compatible-brands…
  if (ascii(bytes, 4, 8) === 'ftyp') {
    const boxSize = Math.min(bytes.length, ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0 || 32)
    const brands = [ascii(bytes, 8, 12)]
    for (let i = 16; i + 4 <= boxSize; i += 4) brands.push(ascii(bytes, i, i + 4))
    if (brands.some((b) => AVIF_BRANDS.has(b))) return { mime: 'image/avif', ext: 'avif', kind: 'image' }
    if (QUICKTIME_BRANDS.has(brands[0]!)) return { mime: 'video/quicktime', ext: 'mov', kind: 'video' }
    if (brands.some((b) => MP4_BRANDS.has(b))) return { mime: 'video/mp4', ext: 'mp4', kind: 'video' }
    return null
  }

  // Matroska/EBML container whose DocType is "webm"
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]) && ascii(bytes, 0, Math.min(bytes.length, 64)).includes('webm')) {
    return { mime: 'video/webm', ext: 'webm', kind: 'video' }
  }
  return null
}
