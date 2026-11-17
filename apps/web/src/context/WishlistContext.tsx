import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import type { Product } from '@trs/shared'
import { readJSON, writeJSON } from '../core/storage'

/** Minimal snapshot so the wishlist renders without refetching. */
export interface WishlistEntry {
  id: string
  slug: string
  name: string
  price: number
  compare_at_price?: number | null
  image: string
  category: string
  addedAt: string
}

interface WishlistContextType {
  items: WishlistEntry[]
  count: number
  has: (id: string) => boolean
  toggle: (product: Product) => void
  remove: (id: string) => void
}

const KEY = 'wishlist'
const WishlistContext = createContext<WishlistContextType | null>(null)

export function mainImage(product: Pick<Product, 'product_media'>): string {
  const media = product.product_media ?? []
  return (media.find((m) => m.is_main && m.media_type === 'image') ?? media.find((m) => m.media_type === 'image'))?.file_path ?? ''
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WishlistEntry[]>(() => readJSON<WishlistEntry[]>(KEY, []))
  useEffect(() => {
    writeJSON(KEY, items)
  }, [items])

  const has = useCallback((id: string) => items.some((i) => i.id === id), [items])

  const toggle = useCallback((product: Product) => {
    setItems((prev) => {
      if (prev.some((i) => i.id === product.id)) {
        toast('Retiré de vos favoris', { icon: '♡' })
        return prev.filter((i) => i.id !== product.id)
      }
      toast.success('Ajouté à vos favoris', { icon: '★' })
      return [
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
        ...prev,
      ].slice(0, 100)
    })
  }, [])

  const remove = useCallback((id: string) => setItems((prev) => prev.filter((i) => i.id !== id)), [])

  const value = useMemo(() => ({ items, count: items.length, has, toggle, remove }), [items, has, toggle, remove])
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWishlist(): WishlistContextType {
  const context = useContext(WishlistContext)
  if (!context) throw new Error('useWishlist must be used within WishlistProvider')
  return context
}
