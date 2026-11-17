import type { IconType } from 'react-icons'
import { FaFacebook, FaGoogle, FaInstagram, FaSnapchat, FaTelegram, FaTiktok, FaWhatsapp } from 'react-icons/fa'
import { FaXTwitter } from 'react-icons/fa6'
import { HiDevicePhoneMobile, HiEnvelope, HiGlobeAlt, HiLink, HiMagnifyingGlass } from 'react-icons/hi2'
import { AUDIENCE_SOURCE_LABELS, type AudienceStats } from '@trs/shared'

const SOURCE_ICONS: Record<string, IconType> = {
  whatsapp: FaWhatsapp,
  facebook: FaFacebook,
  instagram: FaInstagram,
  tiktok: FaTiktok,
  snapchat: FaSnapchat,
  telegram: FaTelegram,
  x: FaXTwitter,
  google: FaGoogle,
  search: HiMagnifyingGlass,
  email: HiEnvelope,
  referral: HiGlobeAlt,
  app: HiDevicePhoneMobile,
  direct: HiLink,
}

export const sourceLabel = (key: string) => AUDIENCE_SOURCE_LABELS[key] ?? key.replace(/_/g, ' ')
export const sourceIcon = (key: string): IconType => SOURCE_ICONS[key] ?? HiGlobeAlt

let regionNames: Intl.DisplayNames | null = null
export function countryName(code: string | null | undefined): string {
  if (!code) return 'Inconnu'
  try {
    regionNames ??= new Intl.DisplayNames(['fr'], { type: 'region' })
    return regionNames.of(code) ?? code
  } catch {
    return code
  }
}

/** 🇨🇮 from "CI" (regional indicator symbols). */
export const flag = (code: string | null | undefined) =>
  code && /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '🌍'

export const DEVICE_LABELS: Record<string, string> = { mobile: 'Téléphone', tablet: 'Tablette', desktop: 'Ordinateur' }

/** "/product/air-force-1-blanc" → "Produit · air force 1 blanc" */
export function pageLabel(path: string): string {
  if (path === '/') return 'Accueil'
  const [, section, slug] = path.split('/')
  const pretty = slug ? decodeURIComponent(slug).replace(/-/g, ' ') : ''
  const sections: Record<string, string> = {
    product: 'Produit',
    collection: 'Boutique',
    'rising-stars': 'Looks',
    looks: 'Looks',
    payer: 'Paiement',
    payment: 'Retour de paiement',
    panier: 'Panier',
    commande: 'Commande',
    track: 'Suivi de commande',
    contact: 'Contact',
    about: 'À propos',
    faq: 'FAQ',
    compte: 'Mon compte',
    wishlist: 'Favoris',
    login: 'Connexion',
    register: 'Inscription',
  }
  const name = sections[section ?? ''] ?? `/${section}`
  return pretty ? `${name} · ${pretty}` : name
}

export function trend(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0
  return Math.round(((current - previous) / previous) * 100)
}

/** The series with empty hours/days filled in, so a quiet day shows as 0 instead of disappearing. */
export function fillSeries(stats: AudienceStats): { t: string; visits: number; visitors: number }[] {
  const step = stats.hourly ? 3_600_000 : 86_400_000
  const byTime = new Map(stats.series.map((p) => [new Date(p.t).getTime(), p]))
  const start = new Date(stats.from)
  if (stats.hourly) start.setUTCMinutes(0, 0, 0)
  else start.setUTCHours(0, 0, 0, 0)
  const out: { t: string; visits: number; visitors: number }[] = []
  for (let t = start.getTime(); t <= new Date(stats.to).getTime(); t += step) {
    const p = byTime.get(t)
    out.push({ t: new Date(t).toISOString(), visits: p?.visits ?? 0, visitors: p?.visitors ?? 0 })
  }
  return out
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return "à l'instant"
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`
  if (s < 86_400) return `il y a ${Math.round(s / 3600)} h`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
