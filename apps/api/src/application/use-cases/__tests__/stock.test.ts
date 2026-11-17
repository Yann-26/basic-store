import { describe, expect, it, vi } from 'vitest'
import type { Product, SessionUser } from '@trs/shared'
import { makeStockUseCases } from '../stock'
import type { ProductRepository, StockRepository } from '../../ports'

const admin = { id: 'a1', email: 'admin@test.ci', role: 'admin' } as SessionUser
const shirt = { id: 'p1', name: 'Polo', sizes: ['S', 'M'], size_stock: { S: 1, M: 0 }, stock: 1, low_stock_threshold: 2, is_active: true } as unknown as Product
const cap = { id: 'p2', name: 'Casquette', sizes: [], stock: 0, is_active: true } as unknown as Product

function setup() {
  const stock = {
    adjust: vi.fn(async () => 4),
    movements: vi.fn(async () => ({ items: [], total: 0 })),
    overview: vi.fn(async () => ({ items: [shirt, cap], total: 2 })),
  } as unknown as StockRepository
  const products = { findByIdOrSlug: vi.fn(async (id: string) => [shirt, cap].find((p) => p.id === id) ?? null) } as unknown as ProductRepository
  return { uc: makeStockUseCases({ stock, products }), stock }
}

describe('stock', () => {
  it('flags low and sold-out products on the overview', async () => {
    const { uc } = setup()
    const page = await uc.overview({ page: 1, limit: 50 })
    expect(page.items.map((p) => [p.id, p.total_stock, p.low, p.out])).toEqual([
      ['p1', 1, true, false],
      ['p2', 0, false, true],
    ])
  })

  it('moves one size of a product, with a reason that matches the direction', async () => {
    const { uc, stock } = setup()
    await expect(uc.adjust({ product_id: 'p1', size: 'm', delta: 4, reason: 'restock' }, admin)).resolves.toMatchObject({ size: 'M', quantity: 4 })
    expect(stock.adjust).toHaveBeenCalledWith({ productId: 'p1', size: 'M', delta: 4, reason: 'restock', note: undefined, adminId: 'a1' })
    await uc.adjust({ product_id: 'p2', delta: -1, reason: 'sale_in_store' }, admin)
    expect(stock.adjust).toHaveBeenLastCalledWith(expect.objectContaining({ productId: 'p2', size: null }))

    await expect(uc.adjust({ product_id: 'p1', size: 'XL', delta: 1, reason: 'restock' }, admin)).rejects.toThrow(/taille/)
    await expect(uc.adjust({ product_id: 'p1', size: 'M', delta: -1, reason: 'restock' }, admin)).rejects.toThrow(/ajoute/)
    await expect(uc.adjust({ product_id: 'p1', size: 'M', delta: 1, reason: 'sale_in_store' }, admin)).rejects.toThrow(/retire/)
    await expect(uc.adjust({ product_id: 'nope', delta: 1, reason: 'adjustment' }, admin)).rejects.toMatchObject({ status: 404 })
  })
})
