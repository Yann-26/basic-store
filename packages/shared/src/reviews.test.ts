import { describe, expect, it } from 'vitest'
import { reviewAuthorName, summarizeReviews } from './reviews'

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
