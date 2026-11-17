/** Customer reviews and the drop calendar: types and rules shared by the API and the shop. */

export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export interface ProductReview {
  id: string
  product_id: string
  user_id?: string | null
  order_id?: string | null
  /** "Awa K." — first name and initial only. */
  author_name: string
  rating: number
  title: string
  body: string
  photo_url: string | null
  status: ReviewStatus
  /** The shop's public answer. */
  admin_reply: string | null
  created_at: string
  /** Back-office list only. */
  product?: { id: string; name: string; slug: string } | null
}

export interface ReviewSummary {
  count: number
  /** One decimal, 0 when there is none. */
  average: number
  /** How many reviews give 1…5 stars (index 0 = 1 star). */
  distribution: [number, number, number, number, number]
}

export function summarizeReviews(ratings: number[]): ReviewSummary {
  const distribution: ReviewSummary['distribution'] = [0, 0, 0, 0, 0]
  let total = 0
  for (const r of ratings) {
    const stars = Math.min(5, Math.max(1, Math.round(r)))
    distribution[stars - 1]! += 1
    total += stars
  }
  return { count: ratings.length, average: ratings.length ? Math.round((total / ratings.length) * 10) / 10 : 0, distribution }
}

/** "Awa K." from a first and last name, never the full surname. */
export function reviewAuthorName(firstName?: string | null, lastName?: string | null): string {
  const first = (firstName ?? '').trim().split(/\s+/)[0] ?? ''
  const initial = (lastName ?? '').trim().charAt(0)
  return [first || 'Client', initial ? `${initial.toUpperCase()}.` : ''].filter(Boolean).join(' ')
}

export interface Drop {
  id: string
  title: string
  description: string
  image_url: string | null
  starts_at: string
  product_ids: string[]
  /** Where it happens when it is also in person (pop-up store…). */
  location: string
  is_published: boolean
  /** Pre-orders (deposit) taken before the release date; off: pieces kept for the opening (early access). */
  preorders_open: boolean
  created_at?: string
  /** Back-office: emails waiting for the opening. */
  reminders?: number
  /** Public list: the pieces of the drop. */
  products?: { id: string; name: string; slug: string; image: string | null; price: number }[]
}

export type DropState = 'upcoming' | 'live' | 'past'

/** A drop is "live" for its first 48 hours. */
export const DROP_LIVE_HOURS = 48

export function dropState(startsAt: string, now = new Date()): DropState {
  const start = new Date(startsAt).getTime()
  if (start > now.getTime()) return 'upcoming'
  return now.getTime() - start < DROP_LIVE_HOURS * 3_600_000 ? 'live' : 'past'
}

const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')
const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

/** An .ics event (one hour) so a visitor can put the drop in their own calendar. */
export function dropIcs(drop: Pick<Drop, 'id' | 'title' | 'description' | 'starts_at' | 'location'>, opts: { shopName: string; url: string; now?: Date }): string {
  const start = new Date(drop.starts_at)
  const end = new Date(start.getTime() + 3_600_000)
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${icsText(opts.shopName)}//Drops//FR`,
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:drop-${drop.id}@${icsText(opts.shopName.replace(/\s+/g, '').toLowerCase())}`,
    `DTSTAMP:${icsDate(opts.now ?? new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(`${opts.shopName} — ${drop.title}`)}`,
    `DESCRIPTION:${icsText(`${drop.description ? `${drop.description}\n\n` : ''}${opts.url}`)}`,
    ...(drop.location ? [`LOCATION:${icsText(drop.location)}`] : []),
    `URL:${opts.url}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(drop.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

/** Hours before a drop opens during which its subscribers can already order (back-office setting). */
export const DEFAULT_EARLY_ACCESS_HOURS = 24

/** A drop's pieces: not yet orderable, open to its subscribers only, or open to everyone. */
export type DropAccess = 'closed' | 'early' | 'open'

/** The early-access hours set in the back-office (0 turns it off), or the default. */
export function resolveEarlyAccessHours(value: unknown): number {
  if (value === undefined || value === null || value === '') return DEFAULT_EARLY_ACCESS_HOURS
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.min(168, Math.round(n)) : DEFAULT_EARLY_ACCESS_HOURS
}

/** When the subscribers of a drop can start ordering (ISO). */
export function earlyAccessAt(startsAt: string, earlyHours: number): string {
  return new Date(new Date(startsAt).getTime() - earlyHours * 3_600_000).toISOString()
}

export function dropAccess(startsAt: string, earlyHours: number, now = new Date()): DropAccess {
  const start = new Date(startsAt).getTime()
  if (now.getTime() >= start) return 'open'
  return earlyHours > 0 && now.getTime() >= start - earlyHours * 3_600_000 ? 'early' : 'closed'
}

/** The upcoming drop a piece belongs to, as the shop shows it. */
export interface ProductDrop {
  id: string
  title: string
  starts_at: string
  /** When the drop's subscribers can order; equals starts_at when early access is off. */
  early_access_at: string
  /** Reservations (deposit) open before the release date. */
  preorders_open: boolean
}
