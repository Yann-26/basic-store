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
