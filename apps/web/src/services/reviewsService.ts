import type { ProductReview, ReviewStatus, ReviewSummary } from '@trs/shared'
import { http, toQuery } from '../core/http'
import { prepareUpload } from '../core/uploadPrep'

export interface ProductReviews {
  summary: ReviewSummary
  reviews: ProductReview[]
}

export const reviewsService = {
  forProduct(slug: string) {
    return http.get<ProductReviews>(`/catalog/products/${encodeURIComponent(slug)}/reviews`)
  },
  mine(productId: string) {
    return http.get<{ can_review: boolean; review: ProductReview | null }>(`/account/reviews${toQuery({ product_id: productId })}`)
  },
  submit(input: { product_id: string; rating: number; title?: string; body?: string; photo_url?: string | null }) {
    return http.post<ProductReview>('/account/reviews', input)
  },
  async uploadPhoto(file: File) {
    const form = new FormData()
    form.append('file', await prepareUpload(file))
    return http.upload<{ url: string }>('/account/reviews/photo', form)
  },

  // back-office
  list(params: { status?: ReviewStatus; page?: number; limit?: number } = {}) {
    return http.get<{ items: ProductReview[]; total: number }>(`/admin/reviews${toQuery(params)}`)
  },
  moderate(id: string, patch: { status?: ReviewStatus; admin_reply?: string | null }) {
    return http.put<ProductReview>(`/admin/reviews/${id}`, patch)
  },
  remove(id: string) {
    return http.delete(`/admin/reviews/${id}`)
  },
}
