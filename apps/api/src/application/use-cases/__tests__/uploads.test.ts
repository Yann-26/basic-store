import { describe, expect, it, vi } from 'vitest'
import { makeUploadUseCases } from '../uploads'
import type { FileStorage, ProductRepository } from '../../ports'

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(60).fill(1)])

function setup() {
  const storage = { upload: vi.fn(async (_b: string, path: string) => `https://cdn.test/${path}`), removeByUrls: vi.fn() } as unknown as FileStorage
  const products = { findByIdOrSlug: vi.fn(async () => null) } as unknown as ProductRepository
  return { uc: makeUploadUseCases({ storage, products }), storage }
}

describe('uploads', () => {
  it('stores under a random name with the extension and type of the real content', async () => {
    const { uc, storage } = setup()
    const file = new File([JPEG], 'photo.html', { type: 'text/html' })
    const res = await uc.upload({ file, folder: 'hero' })
    const [bucket, path, , type] = vi.mocked(storage.upload).mock.calls[0]!
    expect(bucket).toBe('hero')
    expect(path).toMatch(/^\d+-[0-9a-f-]{36}\.jpg$/)
    expect(type).toBe('image/jpeg')
    expect(res.type).toBe('image/jpeg')
  })

  it('refuses a disguised HTML file even when declared as an image', async () => {
    const { uc, storage } = setup()
    const file = new File(['<html><script>alert(document.cookie)</script></html>'], 'x.png', { type: 'image/png' })
    await expect(uc.upload({ file, folder: 'products' })).rejects.toMatchObject({ status: 400 })
    expect(storage.upload).not.toHaveBeenCalled()
  })

  it('refuses unknown folders', async () => {
    const { uc } = setup()
    await expect(uc.upload({ file: new File([JPEG], 'a.jpg'), folder: '../users' })).rejects.toMatchObject({ status: 400 })
  })
})
