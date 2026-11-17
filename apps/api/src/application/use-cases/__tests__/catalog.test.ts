import { describe, expect, it, vi } from 'vitest'
import type { Product } from '@trs/shared'
import { makeCatalogUseCases, showcaseIds } from '../catalog'
import type { BrandRepository, CollectionRepository, ExclusiveRepository, ProductRepository, SettingsRepository } from '../../ports'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const C = '33333333-3333-4333-8333-333333333333'
const product = (id: string, is_active = true) => ({ id, name: id.slice(0, 2), is_active }) as unknown as Product

function setup(setting: unknown, rows = [product(A), product(B), product(C, false)]) {
  const products = {
    findManyByIds: vi.fn(async (ids: string[]) => rows.filter((r) => ids.includes(r.id))),
    list: vi.fn(async () => ({ items: [product('oldest-1'), product('oldest-2')], total: 2 })),
  } as unknown as ProductRepository
  const settings = { getAll: vi.fn(async () => ({ showcase_product_ids: setting })), upsertMany: vi.fn() } as unknown as SettingsRepository
  const uc = makeCatalogUseCases({ products, settings, brands: {} as BrandRepository, collections: {} as CollectionRepository, exclusives: {} as ExclusiveRepository })
  return { uc, products }
}

describe('3D showcase', () => {
  it('returns the picked products in the admin order, skipping hidden ones', async () => {
    const { uc } = setup([C, B, A])
    expect((await uc.showcase()).map((p) => p.id)).toEqual([B, A])
  })

  it('falls back to the first products added when nothing (usable) is picked', async () => {
    expect((await setup(undefined).uc.showcase()).map((p) => p.id)).toEqual(['oldest-1', 'oldest-2'])
    expect((await setup([C]).uc.showcase()).map((p) => p.id)).toEqual(['oldest-1', 'oldest-2'])
  })

  it('accepts a JSON string and ignores junk, duplicates and extra ids', () => {
    expect(showcaseIds(JSON.stringify([A, A, 'x', 3, B]))).toEqual([A, B])
    expect(showcaseIds('not json')).toEqual([])
    expect(showcaseIds(Array.from({ length: 20 }, (_, i) => `${String(i).padStart(8, '0')}-1111-4111-8111-111111111111`))).toHaveLength(12)
  })
})

describe('collections without a brand', () => {
  it('creates a collection with no brand, and keeps it brand-free when edited', async () => {
    const created: unknown[] = []
    const collections = {
      findBySlug: vi.fn(async () => null),
      findById: vi.fn(async () => ({ id: 'c1' })),
      create: vi.fn(async (data) => (created.push(data), { id: 'c1', ...data })),
      update: vi.fn(async (_id, data) => ({ id: 'c1', ...data })),
    } as unknown as CollectionRepository
    const brands = { findById: vi.fn(async () => null) } as unknown as BrandRepository
    const uc = makeCatalogUseCases({ products: {} as ProductRepository, settings: {} as SettingsRepository, brands, collections, exclusives: {} as ExclusiveRepository })
    await expect(uc.createCollection({ name: 'Capsule 01' })).resolves.toMatchObject({ name: 'Capsule 01', brand_id: null })
    await uc.updateCollection('c1', { brand_id: '' })
    expect(collections.update).toHaveBeenCalledWith('c1', expect.objectContaining({ brand_id: null }))
    expect(brands.findById).not.toHaveBeenCalled()
  })
})

describe('preorder gauge', () => {
  function withProduct(p: Partial<Product>) {
    const products = {
      findByIdOrSlug: vi.fn(async () => ({ id: A, name: 'Manches longues', is_active: true, ...p }) as Product),
      preorderPieces: vi.fn(async () => 14),
    } as unknown as ProductRepository
    const uc = makeCatalogUseCases({ products, settings: {} as SettingsRepository, brands: {} as BrandRepository, collections: {} as CollectionRepository, exclusives: {} as ExclusiveRepository })
    return { uc, products }
  }

  it('counts the paid pieces of a piece sold to a goal', async () => {
    const { uc, products } = withProduct({ preorder_goal: 30 })
    await expect(uc.getProduct('manches-longues')).resolves.toMatchObject({ preorder_goal: 30, preorder_count: 14 })
    expect(products.preorderPieces).toHaveBeenCalledWith(A)
  })

  it('does not count anything for a piece without a goal', async () => {
    const { uc, products } = withProduct({ preorder_goal: null })
    const got = await uc.getProduct('manches-longues')
    expect(got.preorder_count).toBeUndefined()
    expect(products.preorderPieces).not.toHaveBeenCalled()
  })
})
