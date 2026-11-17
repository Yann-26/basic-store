import { normalizeSizeStock, normalizeSizes, sameColor, slugify, type Product, type ProductListQuery } from '@trs/shared'
import type { FileStorage, ProductRepository, ProductWrite } from '../ports'
import { NotFoundError, ValidationError } from '@/domain/errors'

export interface ProductAdminDeps {
  products: ProductRepository
  storage: FileStorage
  /** Tells the subscribers about a published piece; a failure never blocks saving the product. */
  announce?: (product: Product) => Promise<unknown>
}

export type ProductInput = Partial<ProductWrite> & { notify_subscribers?: boolean }

const MEDIA_BUCKET = 'products'

export function makeProductAdminUseCases({ products, storage, announce }: ProductAdminDeps) {
  async function tellSubscribers(product: Product) {
    try {
      await announce?.(product)
    } catch (error) {
      console.error(JSON.stringify({ level: 'error', msg: 'product.announce_failed', product: product.id, error: error instanceof Error ? error.message : String(error) }))
    }
  }

  async function uniqueSlug(name: string, exceptId?: string) {
    const base = slugify(name) || `produit-${Date.now()}`
    let slug = base
    for (let i = 2; await products.slugExists(slug, exceptId); i++) slug = `${base}-${i}`
    return slug
  }

  function clean(input: ProductInput): ProductInput {
    const out: ProductInput = { ...input }
    if (input.sizes) out.sizes = [...new Set(normalizeSizes(input.sizes))]
    if (input.colors) out.colors = [...new Set(input.colors.map((c) => c.trim()).filter(Boolean))]
    if (input.features) out.features = input.features.map((f) => f.trim()).filter(Boolean)
    if (input.tags) out.tags = [...new Set(input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))]
    if (input.compare_at_price != null && input.price != null && input.compare_at_price <= input.price) {
      out.compare_at_price = null
    }
    return out
  }

  async function removeStoredMedia(urls: string[]) {
    await storage.removeByUrls(MEDIA_BUCKET, urls)
  }

  return {
    list(query: ProductListQuery) {
      return products.list({ ...query, includeInactive: true })
    },

    async get(idOrSlug: string) {
      const product = await products.findByIdOrSlug(idOrSlug, { includeInactive: true })
      if (!product) throw new NotFoundError('Produit introuvable')
      return product
    },

    async create(input: ProductInput & { name: string; price: number; category: ProductWrite['category'] }) {
      const { notify_subscribers: notify, ...fields } = input
      const data = clean(fields)
      const product = await products.create({
        name: input.name,
        slug: await uniqueSlug(input.name),
        description: data.description ?? '',
        price: input.price,
        compare_at_price: data.compare_at_price ?? null,
        category: input.category,
        subcategory: data.subcategory ?? null,
        gender: data.gender ?? 'unisex',
        status: data.status ?? 'available',
        stock: data.stock ?? 0,
        sizes: data.sizes ?? [],
        size_stock: normalizeSizeStock(data.sizes ?? [], data.size_stock),
        low_stock_threshold: data.low_stock_threshold ?? 3,
        colors: data.colors ?? [],
        materials: data.materials ?? null,
        features: data.features ?? [],
        tags: data.tags ?? [],
        is_featured: data.is_featured ?? false,
        is_active: data.is_active ?? true,
        release_date: data.release_date || null,
        brand_id: data.brand_id || null,
        collection_id: data.collection_id || null,
      })
      if (notify !== false) await tellSubscribers(product)
      return product
    },

    async update(idOrSlug: string, rawInput: ProductInput) {
      const { notify_subscribers: notify, ...input } = rawInput
      const existing = await products.findByIdOrSlug(idOrSlug, { includeInactive: true })
      if (!existing) throw new NotFoundError('Produit introuvable')
      const data = clean(input)
      if (input.name && input.name !== existing.name) data.slug = await uniqueSlug(input.name, existing.id)
      if ('brand_id' in input) data.brand_id = input.brand_id || null
      if ('collection_id' in input) data.collection_id = input.collection_id || null
      if ('release_date' in input) data.release_date = input.release_date || null
      // Quantities only move through the stock (each change logged): here they just follow the sizes.
      delete data.stock
      delete data.size_stock
      if (input.sizes) data.size_stock = normalizeSizeStock(data.sizes ?? existing.sizes, existing.size_stock)
      const updated = await products.update(existing.id, data)
      // A piece first published later (it was saved as hidden) is announced then.
      if (notify !== false && !existing.is_active && updated.is_active) await tellSubscribers(updated)
      return updated
    },

    async remove(idOrSlug: string): Promise<{ deactivated: boolean }> {
      const existing = await products.findByIdOrSlug(idOrSlug, { includeInactive: true })
      if (!existing) throw new NotFoundError('Produit introuvable')
      if (await products.hasOrders(existing.id)) {
        // Keep order history intact: archive instead of deleting.
        await products.update(existing.id, { is_active: false })
        return { deactivated: true }
      }
      const media = await products.listMedia(existing.id)
      await removeStoredMedia(media.map((m) => m.file_path))
      await products.delete(existing.id)
      return { deactivated: false }
    },

    async deleteMedia(mediaId: string) {
      const media = await products.findMedia(mediaId)
      if (!media) throw new NotFoundError('Média introuvable')
      await removeStoredMedia([media.file_path])
      await products.deleteMedia(mediaId)
      if (media.is_main && media.product_id) {
        const next = (await products.listMedia(media.product_id)).find((m) => m.media_type === 'image')
        if (next) await products.setMainMedia(media.product_id, next.id)
      }
    },

    /** Tags a photo with one of the product's colours (null: shown for every colour). */
    async setMediaColor(mediaId: string, color: string | null) {
      const media = await products.findMedia(mediaId)
      if (!media?.product_id) throw new NotFoundError('Média introuvable')
      const product = await products.findByIdOrSlug(media.product_id, { includeInactive: true })
      const match = color ? product?.colors.find((c) => sameColor(c, color)) : null
      if (color && !match) throw new ValidationError(`« ${color} » n’est pas une couleur de ce produit`)
      await products.setMediaColor(mediaId, match ?? null)
      return { ...media, color: match ?? null }
    },

    async setMainMedia(idOrSlug: string, mediaId: string) {
      const product = await products.findByIdOrSlug(idOrSlug, { includeInactive: true })
      if (!product) throw new NotFoundError('Produit introuvable')
      const media = await products.findMedia(mediaId)
      if (!media || media.product_id !== product.id) throw new NotFoundError('Média introuvable pour ce produit')
      if (media.media_type !== 'image') throw new ValidationError('Seules les images peuvent être principales')
      await products.setMainMedia(product.id, mediaId)
    },
  }
}
