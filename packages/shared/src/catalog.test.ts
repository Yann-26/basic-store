import { describe, expect, it } from 'vitest'
import { galleryForColor, photosOfColor, sameColor, shuffleBySeed } from './catalog'

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
