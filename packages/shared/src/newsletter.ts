/**
 * Newsletter campaigns: a campaign is a list of blocks designed in the
 * back-office and rendered to email HTML by the API.
 */

export type NewsletterBlock =
  | { id: string; type: 'heading'; text: string }
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'image'; url: string; alt: string; link?: string }
  | { id: string; type: 'video'; url: string; thumbnail?: string; caption?: string }
  | { id: string; type: 'button'; label: string; url: string }
  | { id: string; type: 'products'; title?: string; productIds: string[] }
  | { id: string; type: 'recommendations'; title?: string }
  | { id: string; type: 'divider' }

export type NewsletterBlockType = NewsletterBlock['type']

export const NEWSLETTER_BLOCK_LABELS: Record<NewsletterBlockType, string> = {
  heading: 'Titre',
  text: 'Texte',
  image: 'Image',
  video: 'Vidéo',
  button: 'Bouton',
  products: 'Produits',
  recommendations: 'Recommandations « Pour vous »',
  divider: 'Séparateur',
}

/** `all`: every consenting address; `buyers`: only consenting customers who already ordered. */
export type NewsletterAudience = 'all' | 'buyers'

export const NEWSLETTER_AUDIENCE_LABELS: Record<NewsletterAudience, string> = {
  all: 'Tous les abonnés (newsletter + clients ayant accepté)',
  buyers: 'Clients ayant déjà commandé (et ayant accepté)',
}

export type NewsletterStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled' | 'failed'

export const NEWSLETTER_STATUS_LABELS: Record<NewsletterStatus, string> = {
  draft: 'Brouillon',
  scheduled: 'Programmée',
  sending: 'En cours d’envoi',
  sent: 'Envoyée',
  cancelled: 'Annulée',
  failed: 'Échec',
}

export interface NewsletterCampaign {
  id: string
  title: string
  subject: string
  preheader: string
  blocks: NewsletterBlock[]
  audience: NewsletterAudience
  status: NewsletterStatus
  scheduled_at: string | null
  started_at: string | null
  finished_at: string | null
  recipients_count: number
  sent_count: number
  failed_count: number
  created_at: string
  updated_at: string
}

export const NEWSLETTER_MAX_BLOCKS = 40
export const NEWSLETTER_MAX_PRODUCTS = 6

/** YouTube video id from the usual URL shapes, else null. */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\.|^m\./, '')
    if (host === 'youtu.be') return /^[\w-]{11}$/.test(u.pathname.slice(1)) ? u.pathname.slice(1) : null
    if (host === 'youtube.com') {
      const v = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})/)?.[1] ?? null
      return v && /^[\w-]{11}$/.test(v) ? v : null
    }
    return null
  } catch {
    return null
  }
}

/** Poster image for a video block: the uploaded one, else YouTube's, else none. */
export function videoThumbnail(block: { url: string; thumbnail?: string }): string | null {
  if (block.thumbnail) return block.thumbnail
  const id = youtubeId(block.url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}
