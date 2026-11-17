import { describe, expect, it, vi } from 'vitest'
import type { Product } from '@trs/shared'
import { makeProductAdminUseCases } from '../products'
import type { FileStorage, ProductRepository } from '../../ports'

const SB = 'https://proj.supabase.co'
const product = { id: 'p1', name: 'Basket', slug: 'basket', colors: ['Noir', 'Or'], model_3d: { url: `${SB}/storage/v1/object/public/models/p1/old.glb` } } as unknown as Product

function setup() {
  const products = {
    findByIdOrSlug: vi.fn(async () => product),
    update: vi.fn(async (_id: string, data: Partial<Product>) => ({ ...product, ...data })),
  } as unknown as ProductRepository
  const storage = {
    createUploadUrl: vi.fn(async (bucket: string, path: string) => ({ uploadUrl: `${SB}/upload/${bucket}/${path}`, publicUrl: `${SB}/storage/v1/object/public/${bucket}/${path}` })),
    removeByUrls: vi.fn(async () => {}),
    upload: vi.fn(),
  } as unknown as FileStorage
  return { useCases: makeProductAdminUseCases({ products, storage, config: { supabaseUrl: SB } }), products, storage }
}

describe('3D model of a piece', () => {
  it('issues an upload URL in the piece’s folder, within the size limit', async () => {
    const t = setup()
    const r = await t.useCases.model3DUploadUrl('p1', { size: 5_000_000 })
    expect(r.publicUrl).toMatch(/\/models\/p1\/\d+-[\w-]+\.glb$/)
    await expect(t.useCases.model3DUploadUrl('p1', { size: 40 * 1024 * 1024 })).rejects.toMatchObject({ status: 400 })
  })

  it('saves cleaned settings, keeps only the piece’s colours and deletes the replaced file', async () => {
    const t = setup()
    const url = `${SB}/storage/v1/object/public/models/p1/new.glb`
    const saved = await t.useCases.setModel3D('p1', { url, colors: [{ color: 'Noir', variant: 'midnight' }, { color: 'Rose', tint: '#ff00aa' }], exposure: 1 })
    expect(saved.model_3d?.colors).toEqual([{ color: 'Noir', variant: 'midnight', tint: null, swatch: null }])
    expect(t.storage.removeByUrls).toHaveBeenCalledWith('models', [product.model_3d!.url])
  })

  it('refuses a model that was not uploaded for this piece', async () => {
    const t = setup()
    await expect(t.useCases.setModel3D('p1', { url: 'https://evil.test/x.glb' })).rejects.toMatchObject({ status: 400 })
    await expect(t.useCases.setModel3D('p1', { url: `${SB}/storage/v1/object/public/models/p2/x.glb` })).rejects.toMatchObject({ status: 400 })
  })

  it('removes the model and its file', async () => {
    const t = setup()
    const saved = await t.useCases.setModel3D('p1', null)
    expect(saved.model_3d).toBeNull()
    expect(t.storage.removeByUrls).toHaveBeenCalled()
  })
})
