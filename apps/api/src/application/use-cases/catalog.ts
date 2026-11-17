import { slugify, type Brand, type Product, type Collection, type Exclusive, type ProductListQuery } from '@trs/shared'
import type { BrandRepository, CollectionRepository, DropRepository, ExclusiveRepository, ProductRepository, SettingsRepository } from '../ports'
import { productDrop, upcomingDrops } from '../drop-gate'
import { ConflictError, NotFoundError, ValidationError } from '@/domain/errors'

export interface CatalogDeps {
  products: ProductRepository
  brands: BrandRepository
  collections: CollectionRepository
  exclusives: ExclusiveRepository
  settings: SettingsRepository
  /** Upcoming drops: shown with their pieces ("sortie le…", early access). */
  drops?: DropRepository
}

/** The 3D ring of the home page: products picked in the back-office, in their order. */
export const SHOWCASE_SETTING = 'showcase_product_ids'
export const SHOWCASE_MAX = 12
const SHOWCASE_DEFAULT = 5
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Product ids stored in the setting (tolerates a JSON string, ignores anything that isn't an id). */
export function showcaseIds(value: unknown): string[] {
  let list = value
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list)
    } catch {
      return []
    }
  }
  if (!Array.isArray(list)) return []
  return [...new Set(list.filter((v): v is string => typeof v === 'string' && UUID.test(v)))].slice(0, SHOWCASE_MAX)
}

type BrandInput = Partial<Omit<Brand, 'id' | 'slug' | 'created_at'>> & { name?: string }
type CollectionInput = Partial<Omit<Collection, 'id' | 'slug' | 'created_at' | 'brand'>> & { name?: string }
type ExclusiveInput = Partial<Omit<Exclusive, 'id' | 'slug' | 'created_at' | 'brand'>> & { name?: string }

export function makeCatalogUseCases({ products, brands, collections, exclusives, settings, drops }: CatalogDeps) {
  /** Adds its upcoming drop to each piece that belongs to one. */
  async function withDrops<T extends Product>(list: T[]): Promise<T[]> {
    if (!drops || list.length === 0) return list
    const { hours, byProduct } = await upcomingDrops(drops, await settings.getAll().catch(() => ({} as Record<string, unknown>)))
    if (byProduct.size === 0) return list
    return list.map((p) => {
      const drop = byProduct.get(p.id)
      return drop ? { ...p, drop: productDrop(drop, hours) } : p
    })
  }

  return {
    // ------------------------------------------------------------- public
    async listProducts(query: ProductListQuery) {
      const page = await products.list(query)
      return { ...page, items: await withDrops(page.items) }
    },

    async getProduct(slug: string) {
      const product = await products.findByIdOrSlug(slug)
      if (!product) throw new NotFoundError('Produit introuvable')
      // A series made from its preorders shows how many pieces are already paid.
      const [withDrop] = await withDrops([product])
      // Real orders only (deposit paid at least): "3 précommandes ces dernières 24 h".
      const since = new Date(Date.now() - 24 * 3_600_000).toISOString()
      const [recent, count] = await Promise.all([
        products.recentPreorders ? products.recentPreorders(product.id, since).catch(() => 0) : Promise.resolve(0),
        product.preorder_goal ? products.preorderPieces(product.id) : Promise.resolve(undefined),
      ])
      return { ...withDrop!, recent_preorders: recent, ...(count === undefined ? {} : { preorder_count: count }) }
    },

    /** Picked products in the admin's order; until some are picked, the first ones added. */
    async showcase() {
      const ids = showcaseIds((await settings.getAll())[SHOWCASE_SETTING])
      if (ids.length > 0) {
        const byId = new Map((await products.findManyByIds(ids)).map((p) => [p.id, p]))
        const picked = ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => p !== undefined && p.is_active)
        if (picked.length > 0) return picked
      }
      return (await products.list({ limit: SHOWCASE_DEFAULT, sort: 'oldest' })).items
    },

    async relatedProducts(slug: string, limit = 8) {
      const product = await products.findByIdOrSlug(slug)
      if (!product) throw new NotFoundError('Produit introuvable')
      // An exclusive piece suggests pieces of the same exclusivité; a regular one, regular pieces.
      const exclusive = product.is_exclusive ? (product.exclusive?.slug ?? 'only') : undefined
      const { items } = await products.list(
        exclusive ? { exclusive, limit: limit + 1 } : { category: product.category, gender: product.gender ?? undefined, limit: limit + 1 },
      )
      return items.filter((p) => p.id !== product.id).slice(0, limit)
    },

    listBrands(opts: { activeOnly: boolean }) {
      return brands.list(opts)
    },

    async listCollections(opts: { activeOnly: boolean; brandSlug?: string }) {
      if (!opts.brandSlug) return collections.list({ activeOnly: opts.activeOnly })
      const brand = await brands.findBySlug(opts.brandSlug)
      if (!brand) return []
      return collections.list({ activeOnly: opts.activeOnly, brandId: brand.id })
    },

    listExclusives(opts: { activeOnly: boolean }) {
      return exclusives.list(opts)
    },

    async getExclusive(slug: string) {
      const exclusive = await exclusives.findBySlug(slug)
      if (!exclusive || !exclusive.is_active) throw new NotFoundError('Exclusivité introuvable')
      return exclusive
    },

    // -------------------------------------------------------------- admin
    async createBrand(input: BrandInput & { name: string }) {
      const slug = slugify(input.name)
      if (!slug) throw new ValidationError('Nom invalide')
      if (await brands.findBySlug(slug)) throw new ConflictError('Une marque porte déjà ce nom')
      return brands.create({
        name: input.name,
        slug,
        description: input.description ?? '',
        logo_url: input.logo_url ?? '',
        banner_url: input.banner_url ?? '',
        is_active: input.is_active ?? true,
        sort_order: input.sort_order ?? 0,
      })
    },

    async updateBrand(id: string, input: BrandInput) {
      if (!(await brands.findById(id))) throw new NotFoundError('Marque introuvable')
      const patch: Partial<Brand> = { ...input }
      if (input.name) {
        patch.slug = slugify(input.name)
        const dup = await brands.findBySlug(patch.slug)
        if (dup && dup.id !== id) throw new ConflictError('Une marque porte déjà ce nom')
      }
      return brands.update(id, patch)
    },

    async deleteBrand(id: string) {
      if (!(await brands.findById(id))) throw new NotFoundError('Marque introuvable')
      const [cols, excl, prods] = await Promise.all([collections.countByBrand(id), exclusives.countByBrand(id), products.countByBrand(id)])
      if (cols > 0) throw new ConflictError(`Impossible : ${cols} collection(s) rattachée(s) à cette marque`)
      if (excl > 0) throw new ConflictError(`Impossible : ${excl} exclusivité(s) rattachée(s) à cette marque`)
      if (prods > 0) throw new ConflictError(`Impossible : ${prods} produit(s) rattaché(s) à cette marque`)
      await brands.delete(id)
    },

    async createCollection(input: CollectionInput & { name: string }) {
      if (input.brand_id && !(await brands.findById(input.brand_id))) throw new NotFoundError('Marque introuvable')
      const slug = slugify(input.name)
      if (await collections.findBySlug(slug)) throw new ConflictError('Une collection porte déjà ce nom')
      return collections.create({
        name: input.name,
        slug,
        brand_id: input.brand_id || null,
        description: input.description ?? '',
        image_url: input.image_url ?? '',
        banner_url: input.banner_url ?? '',
        is_active: input.is_active ?? true,
        sort_order: input.sort_order ?? 0,
      })
    },

    async updateCollection(id: string, input: CollectionInput) {
      if (!(await collections.findById(id))) throw new NotFoundError('Collection introuvable')
      if (input.brand_id && !(await brands.findById(input.brand_id))) throw new NotFoundError('Marque introuvable')
      const patch: Partial<Collection> = { ...input }
      if ('brand_id' in input) patch.brand_id = input.brand_id || null
      if (input.name) {
        patch.slug = slugify(input.name)
        const dup = await collections.findBySlug(patch.slug)
        if (dup && dup.id !== id) throw new ConflictError('Une collection porte déjà ce nom')
      }
      return collections.update(id, patch)
    },

    async deleteCollection(id: string) {
      if (!(await collections.findById(id))) throw new NotFoundError('Collection introuvable')
      const count = await products.countByCollection(id)
      if (count > 0) throw new ConflictError(`Impossible : ${count} produit(s) dans cette collection`)
      await collections.delete(id)
    },

    async createExclusive(input: ExclusiveInput & { name: string }) {
      if (input.brand_id && !(await brands.findById(input.brand_id))) throw new NotFoundError('Marque introuvable')
      const slug = slugify(input.name)
      if (!slug) throw new ValidationError('Nom invalide')
      if (await exclusives.findBySlug(slug)) throw new ConflictError('Une exclusivité porte déjà ce nom')
      return exclusives.create({
        name: input.name,
        slug,
        brand_id: input.brand_id || null,
        description: input.description ?? '',
        image_url: input.image_url ?? '',
        banner_url: input.banner_url ?? '',
        is_active: input.is_active ?? true,
        sort_order: input.sort_order ?? 0,
      })
    },

    async updateExclusive(id: string, input: ExclusiveInput) {
      if (!(await exclusives.findById(id))) throw new NotFoundError('Exclusivité introuvable')
      if (input.brand_id && !(await brands.findById(input.brand_id))) throw new NotFoundError('Marque introuvable')
      const patch: Partial<Exclusive> = { ...input }
      if ('brand_id' in input) patch.brand_id = input.brand_id || null
      if (input.name) {
        patch.slug = slugify(input.name)
        const dup = await exclusives.findBySlug(patch.slug)
        if (dup && dup.id !== id) throw new ConflictError('Une exclusivité porte déjà ce nom')
      }
      return exclusives.update(id, patch)
    },

    async deleteExclusive(id: string) {
      if (!(await exclusives.findById(id))) throw new NotFoundError('Exclusivité introuvable')
      const count = await products.countByExclusive(id)
      if (count > 0) throw new ConflictError(`Impossible : ${count} produit(s) dans cette exclusivité`)
      await exclusives.delete(id)
    },
  }
}
