import type { Product } from '@trs/shared'

/**
 * "Pour vous": products close to what the customer bought — same collection
 * first, then brand, category and gender — never something they already own.
 * Customers with no purchase get the newest featured pieces.
 */
export function recommend(purchased: Product[], catalog: Product[], limit = 4): Product[] {
  const owned = new Set(purchased.map((p) => p.id))
  const available = catalog.filter((p) => p.is_active && p.status !== 'unavailable' && !owned.has(p.id))
  if (purchased.length === 0) {
    return [...available].sort((a, b) => Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured))).slice(0, limit)
  }

  const count = <K extends keyof Product>(key: K) => {
    const m = new Map<unknown, number>()
    for (const p of purchased) if (p[key]) m.set(p[key], (m.get(p[key]) ?? 0) + 1)
    return m
  }
  const collections = count('collection_id')
  const brands = count('brand_id')
  const categories = count('category')
  const genders = count('gender')

  const score = (p: Product) =>
    (collections.get(p.collection_id) ?? 0) * 4 +
    (brands.get(p.brand_id) ?? 0) * 3 +
    (categories.get(p.category) ?? 0) * 2 +
    (genders.get(p.gender) ?? 0) * 1 +
    (p.is_featured ? 0.5 : 0)

  return available
    .map((p, i) => ({ p, s: score(p), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.p)
}
