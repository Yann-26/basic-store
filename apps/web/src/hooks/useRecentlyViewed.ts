import { useCallback, useState } from 'react'
import type { Product } from '@trs/shared'
import { readJSON, writeJSON } from '../core/storage'
import { mainImage, type WishlistEntry } from '../context/WishlistContext'

const KEY = 'recently_viewed'
const MAX = 12

export function useRecentlyViewed() {
  const [items, setItems] = useState<WishlistEntry[]>(() => readJSON<WishlistEntry[]>(KEY, []))

  const track = useCallback((product: Product) => {
    setItems((prev) => {
      const next = [
        {
          id: product.id,
          slug: product.slug,
          name: product.name,
          price: product.price,
          compare_at_price: product.compare_at_price,
          image: mainImage(product),
          category: product.category,
          addedAt: new Date().toISOString(),
        },
        ...prev.filter((p) => p.id !== product.id),
      ].slice(0, MAX)
      writeJSON(KEY, next)
      return next
    })
  }, [])

  return { items, track }
}
