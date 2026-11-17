import { isOwnModelUrl, normalizeSizes, parseProduct3D, sameColor, slugify, MAX_MODEL_BYTES, type Product, type ProductListQuery } from '@trs/shared'
import type { FileStorage, ProductRepository, ProductWrite } from '../ports'
import { NotFoundError, ValidationError } from '@/domain/errors'

export interface ProductAdminDeps {
  products: ProductRepository
  storage: FileStorage
  /** Tells the subscribers about a published piece; a failure never blocks saving the product. */
  announce?: (product: Product) => Promise<unknown>
  /** Where the 3D models are stored (the Supabase project). */
  config?: { supabaseUrl?: string }
}

export type ProductInput = Partial<ProductWrite> & { notify_subscribers?: boolean }

const MEDIA_BUCKET = 'products'
const MODEL_BUCKET = 'models'

export function makeProductAdminUseCases({ products, storage, announce, config }: ProductAdminDeps) {
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

  /**
   * Keeps the flag and the group consistent: an explicit `false` makes the piece
   * regular (and drops its group); otherwise a piece in an exclusivité is exclusive.
   */
  function exclusivity(isExclusive: boolean | undefined, exclusiveId: string | null | undefined) {
    if (isExclusive === false) return { is_exclusive: false, exclusive_id: null }
    const groupId = exclusiveId || null
    const flag = isExclusive === true || groupId !== null
    return { is_exclusive: flag, exclusive_id: flag ? groupId : null }
  }

  async function removeStoredMedia(urls: string[]) {
    await storage.removeByUrls(MEDIA_BUCKET, urls)
  }

  return {
    /**
     * A one-time URL for the back-office to upload a GLB straight to Storage
     * (models are bigger than what a serverless request accepts).
     */
    async model3DUploadUrl(idOrSlug: string, input: { size: number }) {
      const product = await products.findByIdOrSlug(idOrSlug, { includeInactive: true })
      if (!product) throw new NotFoundError('Produit introuvable')
      if (input.size > MAX_MODEL_BYTES) throw new ValidationError('Modèle trop lourd (30 Mo maximum) : compressez-le (meshopt ou Draco, textures en WebP).')
      return storage.createUploadUrl(MODEL_BUCKET, `${product.id}/${Date.now()}-${crypto.randomUUID()}.glb`)
    },

    /** Saves the 3D model and its settings (null removes it); the replaced file is deleted. */
    async setModel3D(idOrSlug: string, raw: unknown | null) {
      const product = await products.findByIdOrSlug(idOrSlug, { includeInactive: true })
      if (!product) throw new NotFoundError('Produit introuvable')
      const model = raw === null ? null : parseProduct3D(raw)
      if (raw !== null && !model) throw new ValidationError('Modèle 3D invalide')
      if (model && !isOwnModelUrl(model.url, config?.supabaseUrl ?? '', product.id)) throw new ValidationError('Le modèle doit être envoyé depuis le back-office.')
      // Only colours of the piece can be linked to a look of the model.
      if (model) model.colors = model.colors.filter((c) => product.colors.some((pc) => sameColor(pc, c.color)))
      const updated = await products.update(product.id, { model_3d: model })
      const previous = product.model_3d?.url
      if (previous && previous !== model?.url) await storage.removeByUrls(MODEL_BUCKET, [previous])
      return updated
    },

    list(query: ProductListQuery) {
      // The back-office sees every piece, exclusive or not, unless it filters.
      return products.list({ ...query, exclusive: query.exclusive ?? 'all', includeInactive: true })
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
        colors: data.colors ?? [],
        materials: data.materials ?? null,
        features: data.features ?? [],
        tags: data.tags ?? [],
        is_featured: data.is_featured ?? false,
        is_active: data.is_active ?? true,
        release_date: data.release_date || null,
        series_size: data.series_size ?? null,
        preorder_goal: data.preorder_goal ?? null,
        preorder_deadline: data.preorder_deadline || null,
        brand_id: data.brand_id || null,
        collection_id: data.collection_id || null,
        ...exclusivity(data.is_exclusive, data.exclusive_id),
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
      if ('is_exclusive' in input || 'exclusive_id' in input) {
        // An unchanged flag counts as "not said" so that giving a regular piece a group makes it exclusive.
        const flag = input.is_exclusive ?? (existing.is_exclusive ? true : undefined)
        Object.assign(data, exclusivity(flag, 'exclusive_id' in input ? input.exclusive_id : existing.exclusive_id))
      }
      if ('release_date' in input) data.release_date = input.release_date || null
      if ('series_size' in input) {
        const size = input.series_size ?? null
        const given = existing.pieces_numbered ?? 0
        if (size != null && size < given) throw new ValidationError(`${given} pièces de cette série sont déjà numérotées : la série ne peut pas être plus petite`)
        data.series_size = size
      }
      if ('preorder_goal' in input) data.preorder_goal = input.preorder_goal ?? null
      if ('preorder_deadline' in input) data.preorder_deadline = input.preorder_deadline || null
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
