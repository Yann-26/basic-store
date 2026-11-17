/**
 * Catalogue taxonomy: the store sells every kind of wearable, not only shoes.
 * Each category declares which size system its products use.
 */

export type SizeSystem = 'apparel' | 'shoes' | 'kids' | 'one-size' | 'custom'

export type ProductCategoryId = 'clothing' | 'shoes' | 'bags' | 'accessories' | 'jewelry'

export interface ProductCategory {
  id: ProductCategoryId
  label: string
  description: string
  sizeSystem: SizeSystem
  subcategories: string[]
}

export const PRODUCT_CATEGORIES: readonly ProductCategory[] = [
  {
    id: 'clothing',
    label: 'Vêtements',
    description: 'T-shirts, chemises, robes, ensembles, vestes…',
    sizeSystem: 'apparel',
    subcategories: ['T-shirts', 'Chemises', 'Polos', 'Sweats & Hoodies', 'Vestes & Manteaux', 'Pantalons', 'Jeans', 'Shorts', 'Robes', 'Jupes', 'Ensembles', 'Sportswear', 'Traditionnel'],
  },
  {
    id: 'shoes',
    label: 'Chaussures',
    description: 'Sneakers, mocassins, sandales, talons, bottes…',
    sizeSystem: 'shoes',
    subcategories: ['Sneakers', 'Basketball', 'Running', 'Mocassins', 'Derbies', 'Sandales', 'Talons', 'Bottes'],
  },
  {
    id: 'bags',
    label: 'Sacs',
    description: 'Sacs à main, sacs à dos, pochettes, bagagerie…',
    sizeSystem: 'one-size',
    subcategories: ['Sacs à main', 'Sacs à dos', 'Pochettes', 'Sacoches', 'Bagagerie'],
  },
  {
    id: 'accessories',
    label: 'Accessoires',
    description: 'Casquettes, ceintures, lunettes, écharpes…',
    sizeSystem: 'one-size',
    subcategories: ['Casquettes & Chapeaux', 'Ceintures', 'Lunettes', 'Écharpes', 'Chaussettes', 'Portefeuilles', 'Cravates'],
  },
  {
    id: 'jewelry',
    label: 'Bijoux & Montres',
    description: 'Montres, colliers, bracelets, bagues…',
    sizeSystem: 'one-size',
    subcategories: ['Montres', 'Colliers', 'Bracelets', 'Bagues', "Boucles d'oreilles"],
  },
] as const

export const CATEGORY_IDS = PRODUCT_CATEGORIES.map((c) => c.id) as ProductCategoryId[]

export type Gender = 'men' | 'women' | 'unisex' | 'kids'

export const GENDERS: readonly { id: Gender; label: string }[] = [
  { id: 'women', label: 'Femme' },
  { id: 'men', label: 'Homme' },
  { id: 'unisex', label: 'Unisexe' },
  { id: 'kids', label: 'Enfant' },
]

export const SIZE_SYSTEMS: Record<SizeSystem, { label: string; sizes: string[] }> = {
  apparel: { label: 'Taille', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] },
  shoes: { label: 'Pointure', sizes: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'] },
  kids: { label: 'Âge', sizes: ['2A', '4A', '6A', '8A', '10A', '12A', '14A'] },
  'one-size': { label: 'Taille', sizes: ['TU'] },
  custom: { label: 'Taille', sizes: [] },
}

/** Label for "one size fits all". */
export const ONE_SIZE = 'TU'

export function getCategory(id: string | null | undefined): ProductCategory | undefined {
  return PRODUCT_CATEGORIES.find((c) => c.id === normalizeCategory(id))
}

/**
 * Maps legacy / free-text categories (from the sneaker-only era: "Basketball",
 * "lifestyle"…) onto the new taxonomy so old products keep showing up.
 */
export function normalizeCategory(raw: string | null | undefined): ProductCategoryId {
  const value = (raw || '').trim().toLowerCase()
  if ((CATEGORY_IDS as string[]).includes(value)) return value as ProductCategoryId
  if (/(sac|bag)/.test(value)) return 'bags'
  if (/(bijou|jewel|montre|watch)/.test(value)) return 'jewelry'
  if (/(access|casquette|cap|lunette|ceinture)/.test(value)) return 'accessories'
  if (/(v[eê]tement|cloth|shirt|robe|pantalon|hoodie|veste)/.test(value)) return 'clothing'
  return 'shoes'
}

export function sizeLabelFor(category: string | null | undefined): string {
  const cat = getCategory(category)
  return SIZE_SYSTEMS[cat?.sizeSystem ?? 'custom'].label
}

/** Sizes are stored as text (e.g. "M", "42", "TU"). Normalises legacy numeric arrays. */
export function normalizeSizes(sizes: unknown): string[] {
  if (!Array.isArray(sizes)) return []
  return sizes
    .map((s) => String(s ?? '').trim().toUpperCase())
    .filter((s) => s.length > 0 && s.length <= 12)
}

/** A product without explicit sizes is sold as one size. */
export function effectiveSizes(sizes: unknown): string[] {
  const list = normalizeSizes(sizes)
  return list.length > 0 ? list : [ONE_SIZE]
}

/**
 * `oldest` (first products added) is used by the home showcase, not offered in the shop filters.
 * `shuffle` mixes the catalogue in a random order that stays stable for a given seed (see shuffleBySeed).
 */
export type ProductSort = 'shuffle' | 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'name'

export const PRODUCT_SORTS: readonly { id: ProductSort; label: string }[] = [
  { id: 'shuffle', label: 'Découverte' },
  { id: 'newest', label: 'Nouveautés' },
  { id: 'price_asc', label: 'Prix croissant' },
  { id: 'price_desc', label: 'Prix décroissant' },
  { id: 'name', label: 'Nom A → Z' },
]

/** 32-bit FNV-1a hash. */
function fnv1a(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Random-looking order that is deterministic for a seed: the same seed always
 * gives the same order, so paging through a shuffled list never repeats or
 * skips an item, while a new seed gives a completely different order.
 */
export function shuffleBySeed<T>(items: readonly T[], key: (item: T) => string, seed: number): T[] {
  return items
    .map((item) => ({ item, rank: fnv1a(`${seed}:${key(item)}`) }))
    .sort((a, b) => a.rank - b.rank)
    .map((x) => x.item)
}

const colorKey = (c: string) =>
  c
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

/** "Bleu" = "bleu " = "Blèu": colours are typed by hand in the back-office. */
export function sameColor(a: string | null | undefined, b: string | null | undefined): boolean {
  return Boolean(a && b) && colorKey(a!) === colorKey(b!)
}

/** Photos tagged with a colour of the product; photos without (or with a removed colour) are shared. */
export function photosOfColor<M extends { color?: string | null }>(media: readonly M[], colors: readonly string[], color: string): M[] {
  return media.filter((m) => sameColor(m.color, color) && colors.some((c) => sameColor(c, color)))
}

/**
 * Gallery for the chosen colour: its own photos first, then the shared ones.
 * Without a choice, or when that colour has no photo yet, every photo.
 */
export function galleryForColor<M extends { color?: string | null }>(media: readonly M[], colors: readonly string[], color: string | null): M[] {
  if (!color) return [...media]
  const own = photosOfColor(media, colors, color)
  if (own.length === 0) return [...media]
  const shared = media.filter((m) => !m.color || !colors.some((c) => sameColor(c, m.color)))
  return [...own, ...shared]
}

/** True once the preorders of a piece sold to a goal have closed: it can no longer be ordered. */
export function preordersClosed(product: { preorder_deadline?: string | null }, now: Date = new Date()): boolean {
  if (!product.preorder_deadline) return false
  const end = Date.parse(product.preorder_deadline)
  return !Number.isNaN(end) && end <= now.getTime()
}

/** A numbered series whose every piece has been given: the piece is sold out for good. */
export function seriesComplete(product: { series_size?: number | null; pieces_numbered?: number }): boolean {
  return !!product.series_size && (product.pieces_numbered ?? 0) >= product.series_size
}

/** Pieces of a numbered series still to be given, or null when the piece is not numbered. */
export function seriesLeft(product: { series_size?: number | null; pieces_numbered?: number }): number | null {
  return product.series_size ? Math.max(0, product.series_size - (product.pieces_numbered ?? 0)) : null
}

/** "N° 27 / 50", or "N° 27 et 28 / 50" for several pieces of the same line; '' before numbering. */
export function formatPieceNumbers(numbers: number[] | undefined, seriesSize?: number | null): string {
  if (!numbers || numbers.length === 0) return ''
  const list = numbers.length === 1 ? String(numbers[0]) : `${numbers.slice(0, -1).join(', ')} et ${numbers[numbers.length - 1]}`
  return `N° ${list}${seriesSize ? ` / ${seriesSize}` : ''}`
}
