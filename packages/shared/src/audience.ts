/** Storefront audience (Back-office → Audience). */

export const AUDIENCE_RANGES = ['today', '7d', '30d', '90d'] as const
export type AudienceRange = (typeof AUDIENCE_RANGES)[number]

/** Where a visit came from, as shown in the back-office. */
export const AUDIENCE_SOURCE_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  snapchat: 'Snapchat',
  telegram: 'Telegram',
  x: 'X (Twitter)',
  google: 'Google',
  search: 'Autres moteurs de recherche',
  email: 'Emails / newsletter',
  referral: 'Autres sites',
  app: 'Autre application',
  direct: 'Direct / non identifié',
}

/**
 * WhatsApp never tells a website whether a click came from a status, a
 * discussion or a group (and on iPhone, not even that it came from WhatsApp):
 * these tagged links fill the gap. Everywhere else, the general link is enough.
 */
export const WHATSAPP_LINKS = [
  { medium: 'status', label: 'Statut WhatsApp' },
  { medium: 'message', label: 'Discussion WhatsApp' },
  { medium: 'group', label: 'Groupe WhatsApp' },
] as const

/** utm_medium of WhatsApp visits → label ('' = the general link). */
export function whatsappLinkLabel(medium: string): string {
  const m = medium.toLowerCase()
  if (m === 'status' || m === 'statut') return 'Statut'
  if (m === 'message' || m === 'chat' || m === 'discussion') return 'Discussion'
  if (m === 'group' || m === 'groupe') return 'Groupe'
  if (!m) return 'Lien général'
  return m
}

export interface AudienceCount {
  key: string
  visits: number
}

export interface AudienceStats {
  range: AudienceRange
  from: string
  to: string
  hourly: boolean
  /** Distinct visitors (a visitor id changes every day, so a period sums daily visitors). */
  visitors: number
  /** Visits (sessions). */
  visits: number
  pageviews: number
  previous: { visitors: number; visits: number; pageviews: number }
  /** Visits active in the last 5 minutes. */
  live: number
  series: { t: string; visits: number; visitors: number }[]
  sources: AudienceCount[]
  countries: AudienceCount[]
  cities: (AudienceCount & { country: string | null })[]
  pages: { key: string; views: number }[]
  devices: AudienceCount[]
  /** WhatsApp visits by link type (key = utm_medium, '' = the general link). */
  whatsapp: AudienceCount[]
  recent: { at: string; source: string; country: string | null; city: string | null; device: string | null; path: string }[]
}
