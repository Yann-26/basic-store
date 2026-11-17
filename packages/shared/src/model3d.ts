/**
 * A piece's real-time 3D model (GLB) and how the shop shows it: which colour
 * of the piece matches which look of the model, the detail points, the
 * starting angle. Shared by the API (validation) and the shop (viewer).
 */

export type Vec3 = [number, number, number]

/** How one colour of the piece shows on the model. */
export interface Model3DColor {
  /** A colour of the product, as written in `product.colors`. */
  color: string
  /** Name of a material variant inside the GLB (KHR_materials_variants): real leather, fabric… */
  variant?: string | null
  /** Otherwise: the hex colour given to the tinted material(s). */
  tint?: string | null
  /** Colour of the round swatch (defaults to the tint). */
  swatch?: string | null
}

/** Finish of one material of the model, set once in the back-office. */
export interface Model3DMaterial {
  name: string
  /** 0 = mirror, 1 = matte. */
  roughness: number
  /** 0 = fabric, leather; 1 = metal. */
  metalness: number
}

export interface Model3DHotspot {
  id: string
  /** Point on the model, in the model's own space (after centring and scaling). */
  position: Vec3
  /** Surface direction there: the point hides when it faces away. */
  normal: Vec3
  title: string
  text: string
}

export interface Model3DView {
  /** Horizontal angle around the piece, in degrees. */
  azimuth: number
  /** Vertical angle from above, in degrees (90 = level). */
  polar: number
}

export interface Product3D {
  enabled: boolean
  /** Public URL of the GLB (Supabase Storage, models bucket). */
  url: string
  /** Size of the file in bytes, shown before loading. */
  size?: number | null
  colors: Model3DColor[]
  /** Material names recoloured in tint mode (empty: none). */
  tint_materials: string[]
  hotspots: Model3DHotspot[]
  /** Finish overrides per material name. */
  materials: Model3DMaterial[]
  view: Model3DView | null
  /** Brightness of the scene (0.5–2). */
  exposure: number
}

export const MAX_MODEL_BYTES = 30 * 1024 * 1024
export const MAX_HOTSPOTS = 8

const HEX_RE = /^#[0-9a-f]{6}$/i
const finite = (n: unknown, fallback = 0) => (typeof n === 'number' && Number.isFinite(n) ? n : fallback)
const vec = (v: unknown): Vec3 => {
  const a = Array.isArray(v) ? v : []
  return [finite(a[0]), finite(a[1]), finite(a[2])]
}
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** A stored value, cleaned: anything unexpected is dropped rather than trusted. */
export function parseProduct3D(raw: unknown): Product3D | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const url = str(r.url, 2048)
  if (!/^https:\/\//.test(url)) return null
  const colors = (Array.isArray(r.colors) ? r.colors : [])
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>
      const tint = str(o.tint, 7)
      const swatch = str(o.swatch, 7)
      return {
        color: str(o.color, 40),
        variant: str(o.variant, 80) || null,
        tint: HEX_RE.test(tint) ? tint.toLowerCase() : null,
        swatch: HEX_RE.test(swatch) ? swatch.toLowerCase() : null,
      }
    })
    .filter((c) => c.color && (c.variant || c.tint))
    .slice(0, 30)
  const hotspots = (Array.isArray(r.hotspots) ? r.hotspots : [])
    .map((h, i) => {
      const o = (h ?? {}) as Record<string, unknown>
      return { id: str(o.id, 40) || `h${i}`, position: vec(o.position), normal: vec(o.normal), title: str(o.title, 60), text: str(o.text, 300) }
    })
    .filter((h) => h.title)
    .slice(0, MAX_HOTSPOTS)
  const unit = (n: unknown, d: number) => Math.max(0, Math.min(1, finite(n, d)))
  const materials = (Array.isArray(r.materials) ? r.materials : [])
    .map((m) => {
      const o = (m ?? {}) as Record<string, unknown>
      return { name: str(o.name, 80), roughness: unit(o.roughness, 0.5), metalness: unit(o.metalness, 0) }
    })
    .filter((m) => m.name)
    .slice(0, 30)
  const v = r.view as Record<string, unknown> | null | undefined
  return {
    enabled: r.enabled !== false,
    url,
    size: typeof r.size === 'number' && r.size > 0 ? Math.round(r.size) : null,
    colors,
    tint_materials: (Array.isArray(r.tint_materials) ? r.tint_materials : []).map((m) => str(m, 80)).filter(Boolean).slice(0, 10),
    hotspots,
    materials,
    view: v && typeof v === 'object' ? { azimuth: Math.max(-180, Math.min(180, finite(v.azimuth))), polar: Math.max(10, Math.min(170, finite(v.polar, 80))) } : null,
    exposure: Math.max(0.5, Math.min(2, finite(r.exposure, 1))),
  }
}

/** The way a product colour shows on the model, if it has one (case-insensitive). */
export function model3DColor(model: Product3D, color: string | null | undefined): Model3DColor | null {
  if (!color) return null
  const key = color.trim().toLowerCase()
  return model.colors.find((c) => c.color.trim().toLowerCase() === key) ?? null
}

/** Whether a URL is a file of this product in the models bucket of this Supabase project. */
export function isOwnModelUrl(url: string, supabaseUrl: string, productId: string): boolean {
  const base = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/models/${productId}/`
  return url.startsWith(base) && !url.slice(base.length).includes('..')
}
