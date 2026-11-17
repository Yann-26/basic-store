/**
 * Marketing content kept in the settings (Back-office → Marketing): the
 * lookbook shootings and the "produit en mouvement" reel of the home page.
 * Values are parsed defensively: a broken entry is dropped, never shown.
 */

export interface LookbookShoot {
  id: string
  image: string
  title: string
  caption: string
  /** Pieces worn in the photo ("Shop the look"). */
  product_ids: string[]
}

export interface Lookbook {
  enabled: boolean
  title: string
  subtitle: string
  shoots: LookbookShoot[]
}

export interface MotionReel {
  enabled: boolean
  title: string
  /** Pieces shown one at a time, in order; empty → the newest pieces. */
  product_ids: string[]
  /** Seconds each piece stays on screen. */
  seconds: number
}

/** One piece hung on "Le portant": a photo uploaded for the rack (cut out on white), the piece it opens. */
export interface RackItem {
  id: string
  image: string
  /** Optional back view (Face / Dos switch). */
  back_image: string
  product_id: string
}

export interface Rack {
  enabled: boolean
  title: string
  /** Set by hand in Marketing → Le portant; empty → the newest pieces and their photos. */
  items: RackItem[]
}

export const DEFAULT_RACK: Rack = { enabled: true, title: 'Le portant', items: [] }

export const DEFAULT_LOOKBOOK: Lookbook = { enabled: true, title: 'Le shooting', subtitle: 'Nos pièces portées, de la rue au rendez-vous.', shoots: [] }
export const DEFAULT_MOTION_REEL: MotionReel = { enabled: true, title: 'En mouvement', product_ids: [], seconds: 6 }

const MAX_SHOOTS = 40
const asText = (v: unknown, max = 300) => (typeof v === 'string' ? v.slice(0, max) : '')
const asIds = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 24) : [])

function asObject(value: unknown): Record<string, unknown> | null {
  let v = value
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v)
    } catch {
      return null
    }
  }
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

export function parseLookbook(value: unknown): Lookbook {
  const o = asObject(value)
  if (!o) return DEFAULT_LOOKBOOK
  const shoots = (Array.isArray(o.shoots) ? o.shoots : [])
    .map((s) => asObject(s))
    .filter((s): s is Record<string, unknown> => !!s && typeof s.image === 'string' && s.image.length > 0)
    .slice(0, MAX_SHOOTS)
    .map((s, i) => ({ id: asText(s.id, 40) || `shoot-${i}`, image: asText(s.image, 2048), title: asText(s.title, 120), caption: asText(s.caption, 400), product_ids: asIds(s.product_ids) }))
  return {
    enabled: o.enabled !== false,
    title: asText(o.title, 80) || DEFAULT_LOOKBOOK.title,
    subtitle: asText(o.subtitle, 200),
    shoots,
  }
}

export function parseRack(value: unknown): Rack {
  const o = asObject(value)
  if (!o) return DEFAULT_RACK
  const items = (Array.isArray(o.items) ? o.items : [])
    .map((s) => asObject(s))
    .filter((s): s is Record<string, unknown> => !!s && typeof s.image === 'string' && s.image.length > 0)
    .slice(0, 12)
    .map((s, i) => ({ id: asText(s.id, 40) || `rack-${i}`, image: asText(s.image, 2048), back_image: asText(s.back_image, 2048), product_id: asText(s.product_id, 40) }))
  return { enabled: o.enabled !== false, title: asText(o.title, 60) || DEFAULT_RACK.title, items }
}

export function parseMotionReel(value: unknown): MotionReel {
  const o = asObject(value)
  if (!o) return DEFAULT_MOTION_REEL
  const seconds = Number(o.seconds)
  return {
    enabled: o.enabled !== false,
    title: asText(o.title, 80) || DEFAULT_MOTION_REEL.title,
    product_ids: asIds(o.product_ids),
    seconds: Number.isFinite(seconds) ? Math.min(15, Math.max(3, Math.round(seconds))) : DEFAULT_MOTION_REEL.seconds,
  }
}

/** The card shown once to a visitor on their first visit (Back-office → Marketing → Accueil). */
export interface WelcomeCard {
  enabled: boolean
  eyebrow: string
  title: string
  text: string
  /** Optional picture on the left (or top on phones). */
  image: string
  cta_label: string
  /** A path of the shop (/collection, /drops…) or a full https link. */
  cta_link: string
  /** Offer the newsletter right in the card. */
  newsletter: boolean
  /** Seconds before it appears. */
  delay: number
}

export const DEFAULT_WELCOME_CARD: WelcomeCard = {
  enabled: true,
  eyebrow: 'Bienvenue',
  title: 'Entrez dans la Maison',
  text: 'Des pièces pensées à Abidjan, produites en séries courtes. Découvrez la première collection et soyez prévenu·e de chaque nouveau drop.',
  image: '',
  cta_label: 'Découvrir la collection',
  cta_link: '/collection',
  newsletter: true,
  delay: 2,
}

/** The thank-you card shown once a payment is confirmed. */
export interface ThankYouCard {
  title: string
  text: string
  signature: string
}

export const DEFAULT_THANK_YOU: ThankYouCard = {
  title: 'Merci, {prenom}',
  text: 'Votre paiement est bien reçu et votre commande est confirmée. Nous la préparons avec soin, et vous écrivons à chaque étape.',
  signature: 'La Maison',
}

const safeLink = (v: unknown) => {
  const s = asText(v, 300)
  return s.startsWith('/') && !s.startsWith('//') ? s : /^https:\/\//.test(s) ? s : ''
}

export function parseWelcomeCard(raw: unknown): WelcomeCard {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  if (!raw || typeof raw !== 'object') return DEFAULT_WELCOME_CARD
  const delay = Number(o.delay)
  return {
    enabled: o.enabled !== false,
    eyebrow: asText(o.eyebrow, 60),
    title: asText(o.title, 90) || DEFAULT_WELCOME_CARD.title,
    text: asText(o.text, 400),
    image: /^https:\/\//.test(asText(o.image, 600)) ? asText(o.image, 600) : '',
    cta_label: asText(o.cta_label, 40),
    cta_link: safeLink(o.cta_link),
    newsletter: o.newsletter !== false,
    delay: Number.isFinite(delay) ? Math.min(20, Math.max(0, Math.round(delay))) : DEFAULT_WELCOME_CARD.delay,
  }
}

export function parseThankYou(raw: unknown): ThankYouCard {
  if (!raw || typeof raw !== 'object') return DEFAULT_THANK_YOU
  const o = raw as Record<string, unknown>
  return {
    title: asText(o.title, 90) || DEFAULT_THANK_YOU.title,
    text: asText(o.text, 400) || DEFAULT_THANK_YOU.text,
    signature: asText(o.signature, 60),
  }
}
