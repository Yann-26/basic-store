import { describe, expect, it } from 'vitest'
import { dropIcs, dropState, reviewAuthorName, summarizeReviews } from './reviews'

describe('reviews', () => {
  it('summarizes ratings', () => {
    expect(summarizeReviews([5, 4, 5, 3])).toEqual({ count: 4, average: 4.3, distribution: [0, 0, 1, 1, 2] })
    expect(summarizeReviews([])).toEqual({ count: 0, average: 0, distribution: [0, 0, 0, 0, 0] })
  })
  it('never shows the full surname', () => {
    expect(reviewAuthorName('Awa Marie', 'koné')).toBe('Awa K.')
    expect(reviewAuthorName('', '')).toBe('Client')
  })
})

describe('drops', () => {
  const now = new Date('2026-11-01T12:00:00Z')
  it('is upcoming, live for 48 hours, then past', () => {
    expect(dropState('2026-11-02T00:00:00Z', now)).toBe('upcoming')
    expect(dropState('2026-10-31T00:00:00Z', now)).toBe('live')
    expect(dropState('2026-10-20T00:00:00Z', now)).toBe('past')
  })
  it('builds a calendar event with a reminder', () => {
    const ics = dropIcs(
      { id: 'd1', title: 'Capsule 02; noir', description: 'Six pièces', starts_at: '2026-11-07T18:00:00Z', location: 'Cocody, Abidjan' },
      { shopName: 'SCION CARON', url: 'https://shop.test/drops', now },
    )
    expect(ics).toContain('DTSTART:20261107T180000Z')
    expect(ics).toContain('DTEND:20261107T190000Z')
    expect(ics).toContain('SUMMARY:SCION CARON — Capsule 02\\; noir')
    expect(ics).toContain('LOCATION:Cocody\\, Abidjan')
    expect(ics).toContain('TRIGGER:-PT30M')
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR')
  })
})
