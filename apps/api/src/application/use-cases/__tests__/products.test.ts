import { describe, expect, it, vi } from 'vitest'
import type { Product } from '@trs/shared'
import { makeProductAdminUseCases } from '../products'
import type { FileStorage, ProductRepository } from '../../ports'

const GROUP = '11111111-1111-4111-8111-111111111111'

function setup(existing: Partial<Product> = {}, announce = vi.fn(async () => undefined)) {
  const product = { id: 'p1', name: 'Ja 4', slug: 'ja-4', price: 1000, category: 'shoes', status: 'available', stock: 1, sizes: [], colors: [], features: [], is_active: true, is_exclusive: false, exclusive_id: null, ...existing } as Product
  const products = {
    findByIdOrSlug: vi.fn(async () => product),
    slugExists: vi.fn(async () => false),
    create: vi.fn(async (data) => ({ ...product, ...data })),
    update: vi.fn(async (_id, data) => ({ ...product, ...data })),
    list: vi.fn(async () => ({ items: [], total: 0 })),
    findMedia: vi.fn(async (id: string) => (id === 'm1' ? { id: 'm1', product_id: 'p1', file_path: 'x', media_type: 'image', is_main: false } : null)),
    setMediaColor: vi.fn(async () => undefined),
  } as unknown as ProductRepository
  return { uc: makeProductAdminUseCases({ products, storage: {} as FileStorage, announce }), products, announce }
}

describe('product exclusivity', () => {
  it('a piece put in an exclusivité becomes exclusive', async () => {
    const { uc, products } = setup()
    await uc.update('p1', { exclusive_id: GROUP })
    expect(products.update).toHaveBeenCalledWith('p1', expect.objectContaining({ is_exclusive: true, exclusive_id: GROUP }))
  })

  it('un-flagging a piece removes it from its exclusivité', async () => {
    const { uc, products } = setup({ is_exclusive: true, exclusive_id: GROUP })
    await uc.update('p1', { is_exclusive: false })
    expect(products.update).toHaveBeenCalledWith('p1', expect.objectContaining({ is_exclusive: false, exclusive_id: null }))
  })

  it('an exclusive piece may have no group', async () => {
    const { uc, products } = setup()
    await uc.create({ name: 'Rare', price: 5000, category: 'shoes', is_exclusive: true })
    expect(products.create).toHaveBeenCalledWith(expect.objectContaining({ is_exclusive: true, exclusive_id: null }))
  })

  it('the back-office lists exclusive and regular pieces together', async () => {
    const { uc, products } = setup()
    await uc.list({})
    expect(products.list).toHaveBeenCalledWith(expect.objectContaining({ exclusive: 'all', includeInactive: true }))
  })
})

describe('photo colours', () => {
  it('tags a photo with the product’s own spelling of the colour', async () => {
    const { uc, products } = setup({ colors: ['Jaune', 'Bleu'] })
    expect((await uc.setMediaColor('m1', ' bleu')).color).toBe('Bleu')
    expect(products.setMediaColor).toHaveBeenCalledWith('m1', 'Bleu')
  })

  it('clears the colour (shared photo) and refuses colours the product doesn’t have', async () => {
    const { uc, products } = setup({ colors: ['Jaune'] })
    await uc.setMediaColor('m1', null)
    expect(products.setMediaColor).toHaveBeenCalledWith('m1', null)
    await expect(uc.setMediaColor('m1', 'Vert')).rejects.toMatchObject({ status: 400 })
    await expect(uc.setMediaColor('nope', 'Jaune')).rejects.toMatchObject({ status: 404 })
  })
})

describe('telling the subscribers about a new piece', () => {
  it('announces a piece when it is created, and does not store the notification flag', async () => {
    const { uc, products, announce } = setup()
    await uc.create({ name: 'Polo', price: 15000, category: 'clothing', notify_subscribers: true })
    expect(announce).toHaveBeenCalledTimes(1)
    expect(announce).toHaveBeenCalledWith(expect.objectContaining({ name: 'Polo' }))
    expect(products.create).toHaveBeenCalledWith(expect.not.objectContaining({ notify_subscribers: expect.anything() }))
  })

  it('announces by default, and not when the admin turns it off', async () => {
    const a = setup()
    await a.uc.create({ name: 'Polo', price: 15000, category: 'clothing' })
    expect(a.announce).toHaveBeenCalledTimes(1)
    const b = setup()
    await b.uc.create({ name: 'Polo', price: 15000, category: 'clothing', notify_subscribers: false })
    expect(b.announce).not.toHaveBeenCalled()
  })

  it('a failing announcement never blocks saving the piece', async () => {
    const { uc, products } = setup({}, vi.fn(async () => Promise.reject(new Error('smtp down'))))
    await expect(uc.create({ name: 'Polo', price: 15000, category: 'clothing' })).resolves.toMatchObject({ name: 'Polo' })
    expect(products.create).toHaveBeenCalled()
  })

  it('a piece saved as hidden is announced when it is first published, not on other edits', async () => {
    const hidden = setup({ is_active: false })
    await hidden.uc.update('p1', { price: 16000 })
    expect(hidden.announce).not.toHaveBeenCalled()
    await hidden.uc.update('p1', { is_active: true })
    expect(hidden.announce).toHaveBeenCalledTimes(1)

    const shown = setup({ is_active: true })
    await shown.uc.update('p1', { price: 17000 })
    expect(shown.announce).not.toHaveBeenCalled()
  })

  it('a collection no longer needs a brand', async () => {
    // brand_id is optional end to end: products and collections are saved without one
    const { uc, products } = setup()
    await uc.create({ name: 'Polo', price: 15000, category: 'clothing', collection_id: GROUP })
    expect(products.create).toHaveBeenCalledWith(expect.objectContaining({ brand_id: null, collection_id: GROUP }))
  })
})
