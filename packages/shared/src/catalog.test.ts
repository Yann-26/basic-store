import { describe, expect, it } from 'vitest'
import { formatPieceNumbers, galleryForColor, photosOfColor, preordersClosed, sameColor, seriesComplete, seriesLeft, shuffleBySeed } from './catalog'

const ids = Array.from({ length: 40 }, (_, i) => `product-${i}`)
const shuffle = (seed: number) => shuffleBySeed(ids, (id) => id, seed)

describe('shuffleBySeed', () => {
  it('keeps every item exactly once', () => {
    expect([...shuffle(7)].sort()).toEqual([...ids].sort())
  })

  it('gives the same order for the same seed, so pages never overlap', () => {
    const order = shuffle(42)
    expect(shuffle(42)).toEqual(order)
    const pages = [order.slice(0, 12), order.slice(12, 24), order.slice(24)]
    expect(new Set(pages.flat()).size).toBe(ids.length)
  })

  it('changes the order with the seed and does not keep the upload order', () => {
    expect(shuffle(1)).not.toEqual(shuffle(2))
    expect(shuffle(1)).not.toEqual(ids)
  })
})

describe('photos per colour', () => {
  const colors = ['Jaune', 'bleu', 'Noir']
  const media = [
    { id: 'j1', color: 'jaune' },
    { id: 'b1', color: 'Bleu' },
    { id: 'shared', color: null },
    { id: 'b2', color: 'bleu ' },
    { id: 'old', color: 'Vert' }, // colour removed from the product since
  ]
  const ids = (m: { id: string }[]) => m.map((x) => x.id)

  it('matches colours regardless of case, accents and spaces', () => {
    expect(sameColor('Bleu', ' bleu')).toBe(true)
    expect(sameColor('Écru', 'ecru')).toBe(true)
    expect(sameColor('bleu', null)).toBe(false)
  })

  it('shows the chosen colour first, then photos shared by every colour', () => {
    expect(ids(galleryForColor(media, colors, 'bleu'))).toEqual(['b1', 'b2', 'shared', 'old'])
    expect(ids(photosOfColor(media, colors, 'BLEU'))).toEqual(['b1', 'b2'])
  })

  it('shows everything without a choice or when the colour has no photo yet', () => {
    expect(ids(galleryForColor(media, colors, null))).toHaveLength(5)
    expect(ids(galleryForColor(media, colors, 'Noir'))).toHaveLength(5)
    expect(photosOfColor(media, colors, 'Vert')).toEqual([])
  })
})

describe('preordersClosed', () => {
  const now = new Date('2026-11-21T19:00:00Z')
  it('is open without a closing date, or before it', () => {
    expect(preordersClosed({}, now)).toBe(false)
    expect(preordersClosed({ preorder_deadline: null }, now)).toBe(false)
    expect(preordersClosed({ preorder_deadline: '2026-11-21T19:00:01Z' }, now)).toBe(false)
  })
  it('is closed from the closing date on', () => {
    expect(preordersClosed({ preorder_deadline: '2026-11-21T19:00:00Z' }, now)).toBe(true)
    expect(preordersClosed({ preorder_deadline: '2026-11-20T10:00:00Z' }, now)).toBe(true)
  })
  it('ignores an unreadable date', () => {
    expect(preordersClosed({ preorder_deadline: 'bientôt' }, now)).toBe(false)
  })
})

describe('numbered series', () => {
  it('knows when a series is complete and what it has left', () => {
    expect(seriesComplete({ series_size: 50, pieces_numbered: 50 })).toBe(true)
    expect(seriesComplete({ series_size: 50, pieces_numbered: 49 })).toBe(false)
    expect(seriesComplete({ series_size: null, pieces_numbered: 0 })).toBe(false)
    expect(seriesLeft({ series_size: 50, pieces_numbered: 47 })).toBe(3)
    expect(seriesLeft({ series_size: null })).toBeNull()
  })

  it('writes the numbers of a line', () => {
    expect(formatPieceNumbers([27], 50)).toBe('N° 27 / 50')
    expect(formatPieceNumbers([27, 28, 29], 50)).toBe('N° 27, 28 et 29 / 50')
    expect(formatPieceNumbers([4])).toBe('N° 4')
    expect(formatPieceNumbers([], 50)).toBe('')
  })
})
