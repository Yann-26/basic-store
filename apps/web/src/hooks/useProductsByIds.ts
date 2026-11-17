import { useEffect, useState } from 'react'
import type { Product } from '@trs/shared'
import { catalogService } from '../services/catalogService'

/** The pieces with these ids, in the same order (pieces that no longer exist are left out). */
export function useProductsByIds(ids: string[]): Product[] {
  const key = ids.join(',')
  const [products, setProducts] = useState<Product[]>([])
  useEffect(() => {
    let alive = true
    const wanted = key ? key.split(',') : []
    if (wanted.length === 0) {
      setProducts([])
      return
    }
    Promise.all(wanted.map((id) => catalogService.getProduct(id).catch(() => null))).then((list) => {
      if (alive) setProducts(list.filter((p): p is Product => !!p && p.is_active !== false))
    })
    return () => {
      alive = false
    }
  }, [key])
  return products
}
