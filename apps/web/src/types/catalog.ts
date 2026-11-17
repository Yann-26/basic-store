import type { Product } from '@trs/shared'

export type { Brand, Collection, Product, ProductMedia } from '@trs/shared'

/** @deprecated kept for older imports — use `Product`. */
export type CatalogProduct = Product

export interface CollectionFormData {
  name: string
  description: string
  image_url: string
  banner_url: string
  is_active: boolean
  sort_order: number
}
