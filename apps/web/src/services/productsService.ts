import type { Product, ProductListQuery } from '@trs/shared'
import { http, toQuery } from '../core/http'
import { prepareUpload } from '../core/uploadPrep'
import type { ProductPage } from './catalogService'

export type { Product, ProductMedia } from '@trs/shared'

export type ProductPayload = Partial<
  Omit<Product, 'id' | 'slug' | 'brand' | 'collection' | 'exclusive' | 'product_media' | 'created_at' | 'updated_at'>
> & {
  /** Email the subscribers about this piece when it is published (default: yes). Not stored. */
  notify_subscribers?: boolean
}

/** Admin product management (includes inactive products). */
export const productsService = {
  async getAll(params: ProductListQuery = {}): Promise<Product[]> {
    const page = await http.get<ProductPage>(`/admin/products${toQuery({ limit: 100, ...params })}`)
    return page.items
  },
  getById(id: string) {
    return http.get<Product>(`/admin/products/${id}`)
  },
  create(data: ProductPayload) {
    return http.post<Product>('/admin/products', data)
  },
  update(id: string, data: ProductPayload) {
    return http.put<Product>(`/admin/products/${id}`, data)
  },
  delete(id: string) {
    return http.delete<{ success: boolean; deactivated: boolean; message: string }>(`/admin/products/${id}`)
  },
  async uploadMedia(productId: string, file: File, _mediaType: 'image' | 'video', isMain = false, color: string | null = null) {
    const form = new FormData()
    form.append('file', await prepareUpload(file))
    form.append('productId', productId)
    form.append('isMain', String(isMain))
    if (color) form.append('color', color)
    form.append('folder', 'products')
    return http.upload<{ url: string; mediaId?: string }>('/admin/upload', form)
  },
  async uploadFile(file: File, folder: 'hero' | 'settings' | 'products' = 'settings') {
    const form = new FormData()
    form.append('file', await prepareUpload(file))
    form.append('folder', folder)
    return http.upload<{ url: string }>('/admin/upload', form)
  },
  deleteMedia(mediaId: string) {
    return http.delete(`/admin/media/${mediaId}`)
  },
  setMediaColor(mediaId: string, color: string | null) {
    return http.patch(`/admin/media/${mediaId}`, { color })
  },
  setMainImage(productId: string, mediaId: string) {
    return http.put(`/admin/products/${productId}/media/${mediaId}/main`, {})
  },
}
