import { describe, expect, it, vi } from 'vitest'
import type { Product } from '@trs/shared'
import { cleanHandle, makeEngagementUseCases } from '../engagement'
import type { ContactRepository, InstagramPost, InstagramRepository, Mailer, ProductRepository } from '../../ports'

describe('cleanHandle', () => {
  it('normalises the ways people write an Instagram handle', () => {
    expect(cleanHandle('@Awa.Style')).toBe('awa.style')
    expect(cleanHandle('https://www.instagram.com/awa_style/')).toBe('awa_style')
    expect(cleanHandle('  ')).toBeNull()
    expect(cleanHandle('not a handle!')).toBeNull()
  })
})

describe('community looks feed', () => {
  it('attaches the worn pieces, skipping inactive or deleted products', async () => {
    const post = { id: 'l1', image_url: 'x', is_published: true, posted_at: '', product_ids: ['p1', 'p2', 'gone'] } as InstagramPost
    const product = (id: string, is_active: boolean) =>
      ({ id, name: id.toUpperCase(), slug: id, is_active, product_media: [{ media_type: 'image', file_path: `${id}.jpg` }] }) as unknown as Product
    const uc = makeEngagementUseCases({
      contact: {} as ContactRepository,
      mailer: {} as Mailer,
      config: {},
      instagram: { list: vi.fn(async () => [post]) } as unknown as InstagramRepository,
      products: { findManyByIds: vi.fn(async () => [product('p1', true), product('p2', false)]) } as unknown as ProductRepository,
    })
    const [look] = await uc.instagramFeed(9)
    expect(look!.products).toEqual([{ id: 'p1', name: 'P1', slug: 'p1', image: 'p1.jpg' }])
  })
})
