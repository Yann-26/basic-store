import { slugify, type Brand, type Collection, type ProductListQuery } from '@trs/shared'
import type { BrandRepository, CollectionRepository, ProductRepository, SettingsRepository } from '../ports'
import { ConflictError, NotFoundError, ValidationError } from '@/domain/errors'

export interface CatalogDeps {
  products: ProductRepository
  brands: BrandRepository
  collections: CollectionRepository
  settings: SettingsRepository
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

export function makeCatalogUseCases({ products, brands, collections, settings }: CatalogDeps) {
  return {
    // ------------------------------------------------------------- public
    listProducts(query: ProductListQuery) {
      return products.list(query)
    },

    async getProduct(slug: string) {
      const product = await products.findByIdOrSlug(slug)
      if (!product) throw new NotFoundError('Produit introuvable')
      return product
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
      const { items } = await products.list({ category: product.category, gender: product.gender ?? undefined, limit: limit + 1 })
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
      const [cols, prods] = await Promise.all([collections.countByBrand(id), products.countByBrand(id)])
      if (cols > 0) throw new ConflictError(`Impossible : ${cols} collection(s) rattachée(s) à cette marque`)
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
  }
}
