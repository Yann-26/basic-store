import { earlyAccessAt, resolveEarlyAccessHours, type Drop, type ProductDrop } from '@trs/shared'
import type { DropRepository } from './ports'

/** The upcoming published drop of each piece (the soonest when several), and the early-access hours. */
export async function upcomingDrops(drops: DropRepository | undefined, settings: Record<string, unknown>, now = new Date()) {
  const hours = resolveEarlyAccessHours(settings.drop_early_access_hours)
  const byProduct = new Map<string, Drop>()
  if (!drops) return { hours, byProduct }
  for (const drop of await drops.upcoming(now.toISOString())) {
    for (const id of drop.product_ids) if (!byProduct.has(id)) byProduct.set(id, drop)
  }
  return { hours, byProduct }
}

/** The drop as shown with a product. */
export function productDrop(drop: Drop, hours: number): ProductDrop {
  return { id: drop.id, title: drop.title, starts_at: drop.starts_at, early_access_at: earlyAccessAt(drop.starts_at, hours), preorders_open: drop.preorders_open !== false }
}

