import type { Collection, Product, ProductListQuery } from '@trs/shared'
import { http, toQuery } from '../core/http'
import type { CollectionFormData } from '../types/catalog'

export interface ProductPage {
  items: Product[]
  total: number
}

/** One shuffle per visit: the order is new on every page load but stays stable while paging. */
const SHUFFLE_SEED = Math.floor(Math.random() * 2_147_483_647)

export const catalogService = {
  getProducts(query: ProductListQuery = {}, signal?: AbortSignal) {
    const seed = query.sort === 'shuffle' ? (query.seed ?? SHUFFLE_SEED) : undefined
    return http.get<ProductPage>(`/catalog/products${toQuery({ ...query, seed })}`, signal)
  },
  getProduct(slug: string) {
    return http.get<Product>(`/catalog/products/${encodeURIComponent(slug)}`)
  },
  getRelated(slug: string) {
    return http.get<Product[]>(`/catalog/products/${encodeURIComponent(slug)}/related`)
  },
  /** Products of the home page's 3D ring, in the order picked in the back-office. */
  getShowcase(signal?: AbortSignal) {
    return http.get<Product[]>('/catalog/showcase', signal)
  },
  getCollections() {
    return http.get<Collection[]>('/catalog/collections')
  },

  // ----- admin
  getAllCollections() {
    return http.get<Collection[]>('/admin/catalog/collections')
  },
  createCollection(data: CollectionFormData) {
    return http.post<Collection>('/admin/catalog/collections', data)
  },
  updateCollection(id: string, data: Partial<CollectionFormData>) {
    return http.put<Collection>(`/admin/catalog/collections/${id}`, data)
  },
  deleteCollection(id: string) {
    return http.delete(`/admin/catalog/collections/${id}`)
  },
}
