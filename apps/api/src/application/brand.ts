import { BRAND } from '@trs/shared'

/**
 * The shop's identity as the back-office sets it (`settings` table). Emails and
 * notifications read it here instead of the code defaults, so renaming the shop
 * in the dashboard renames it everywhere.
 */
export interface BrandProfile {
  name: string
  tagline: string
  address: string
  color: string
}

const DEFAULTS: BrandProfile = {
  name: BRAND.name,
  tagline: BRAND.tagline,
  address: BRAND.address,
  color: BRAND.colors.gold,
}

let current: BrandProfile = DEFAULTS
let loadedAt = 0
const TTL_MS = 60_000

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : '')

export const brand = (): Readonly<BrandProfile> => current

export function applyBrandSettings(all: Record<string, unknown>): void {
  const place = [text(all.store_address), text(all.store_city)].filter(Boolean).join(', ')
  const color = text(all.primary_color)
  current = {
    name: text(all.store_name) || DEFAULTS.name,
    tagline: text(all.store_tagline) || DEFAULTS.tagline,
    address: place || DEFAULTS.address,
    color: /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULTS.color,
  }
  loadedAt = Date.now()
}

/** Reloads the identity at most once a minute; a failure keeps the last known one. */
export async function refreshBrand(load: () => Promise<Record<string, unknown>>): Promise<void> {
  if (Date.now() - loadedAt < TTL_MS) return
  loadedAt = Date.now()
  try {
    applyBrandSettings(await load())
  } catch {
    /* keep serving with the previous identity */
  }
}

/** For tests. */
export function resetBrand(): void {
  current = DEFAULTS
  loadedAt = 0
}
