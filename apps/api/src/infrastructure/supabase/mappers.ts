import { normalizeCategory, normalizeSizeStock, normalizeSizes, type Gender, type Product, type ProductMedia } from '@trs/shared'

type Row = Record<string, unknown>

const GENDERS: Gender[] = ['men', 'women', 'unisex', 'kids']

export function toProductMedia(row: Row): ProductMedia {
  return {
    id: String(row.id),
    product_id: row.product_id as string | undefined,
    file_path: String(row.file_path ?? ''),
    file_name: row.file_name as string | undefined,
    media_type: row.media_type === 'video' ? 'video' : 'image',
    is_main: Boolean(row.is_main),
    thumbnail_url: (row.thumbnail_url as string) ?? null,
    alt_text: (row.alt_text as string) ?? null,
    sort_order: (row.sort_order as number) ?? null,
    color: (row.color as string) || null,
  }
}

/** Maps a `products` row (with optional joins) to the domain Product. */
export function toProduct(row: Row): Product {
  const brand = (row.brands ?? null) as Product['brand']
  const collection = (row.collections ?? null) as Product['collection']
  const media = Array.isArray(row.product_media) ? (row.product_media as Row[]).map(toProductMedia) : []
  media.sort((a, b) => Number(b.is_main) - Number(a.is_main) || (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const gender = GENDERS.includes(row.gender as Gender) ? (row.gender as Gender) : null

  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    slug: String(row.slug ?? row.id),
    description: (row.description as string) ?? null,
    price: Number(row.price) || 0,
    compare_at_price: row.compare_at_price != null ? Number(row.compare_at_price) : null,
    category: normalizeCategory(row.category as string),
    subcategory: (row.subcategory as string) ?? null,
    gender,
    status: (['available', 'unavailable', 'limited'].includes(row.status as string) ? row.status : 'available') as Product['status'],
    stock: Number(row.stock) || 0,
    sizes: normalizeSizes(row.sizes),
    colors: Array.isArray(row.colors) ? (row.colors as string[]) : [],
    materials: (row.materials as string) ?? null,
    features: Array.isArray(row.features) ? (row.features as string[]) : [],
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    is_featured: Boolean(row.is_featured),
    is_active: row.is_active !== false,
    release_date: (row.release_date as string) ?? null,
    brand_id: (row.brand_id as string) ?? null,
    collection_id: (row.collection_id as string) ?? null,
    brand,
    collection,
    product_media: media,
    size_stock: normalizeSizeStock(normalizeSizes(row.sizes), row.size_stock),
    low_stock_threshold: row.low_stock_threshold == null ? 3 : Number(row.low_stock_threshold),
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  }
}
