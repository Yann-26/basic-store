import { describe, expect, it } from 'vitest'
import { isLowStock, isOutOfStock, normalizeSizeStock, stockForSize, totalStock } from './stock'

describe('stock', () => {
  const shirt = { stock: 0, sizes: ['S', 'M', 'L'], size_stock: { S: 2, M: 0, L: 5 } }
  const cap = { stock: 4, sizes: [] as string[] }

  it('reads the stock of one size, or of a one-size product', () => {
    expect(stockForSize(shirt, 'l')).toBe(5)
    expect(stockForSize(shirt, 'M')).toBe(0)
    expect(stockForSize(shirt, 'XL')).toBe(0)
    expect(stockForSize(cap)).toBe(4)
    expect(stockForSize(cap, 'TU')).toBe(4)
  })

  it('totals every size', () => {
    expect(totalStock(shirt)).toBe(7)
    expect(totalStock(cap)).toBe(4)
  })

  it('flags sold-out and low stock', () => {
    expect(isOutOfStock({ ...cap, stock: 0 })).toBe(true)
    expect(isOutOfStock({ ...cap, status: 'unavailable' })).toBe(true)
    expect(isLowStock({ ...cap, stock: 3 })).toBe(true)
    expect(isLowStock({ ...cap, stock: 3, low_stock_threshold: 1 })).toBe(false)
    expect(isLowStock({ ...cap, stock: 0 })).toBe(false)
  })

  it('cleans a size map from the back-office', () => {
    expect(normalizeSizeStock(['s', 'M'], { S: '3', m: -2, XL: 9 })).toEqual({ S: 3, M: 0 })
    expect(normalizeSizeStock(['M'], null)).toEqual({ M: 0 })
  })
})
