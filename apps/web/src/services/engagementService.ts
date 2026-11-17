import { RECAPTCHA_ACTIONS, type DashboardAnalytics, type OrderStatus } from '@trs/shared'
import { http, toQuery } from '../core/http'

export interface InstagramPost {
  id: string
  image_url?: string | null
  caption?: string | null
  embed_code?: string | null
  post_url?: string | null
  permalink?: string | null
  likes?: number | null
  comments?: number | null
  is_published: boolean
  posted_at: string
  customer_name?: string | null
  customer_handle?: string | null
  customer_city?: string | null
  quote?: string | null
  product_ids?: string[]
  sort_order?: number
}

/** A loyal customer's look, with the pieces they wear. */
export interface CommunityLook extends InstagramPost {
  products: { id: string; name: string; slug: string; image: string | null }[]
}

export interface ContactMessage {
  id: string
  name: string
  email: string
  phone?: string | null
  subject: string
  message: string
  status: 'new' | 'read' | 'archived'
  created_at: string
}

export interface TrackingView {
  preorder_number: string
  status: OrderStatus
  payment_status: string
  total_price: number
  deposit_amount: number
  remaining_amount: number
  delivery_city: string | null
  estimated_delivery: string | null
  created_at: string
  customer: { first_name?: string; phone?: string | null } | null
  items: {
    product_name: string
    product_slug: string | null
    image: string | null
    size: string | null
    color: string | null
    quantity: number
    product_price: number
    /** Numbers of the pieces in their series (once the deposit is paid). */
    piece_numbers?: number[]
    series_size?: number | null
  }[]
  timeline: { status: OrderStatus; notes: string; location: string | null; created_at: string }[]
}

export const engagementService = {
  sendContact(data: { name: string; email: string; phone?: string; subject: string; message: string }) {
    return http.post<{ success: boolean }>('/contact', data, RECAPTCHA_ACTIONS.contact)
  },
  subscribe(email: string, source = 'footer') {
    return http.post<{ success: boolean; alreadySubscribed: boolean }>('/newsletter', { email, source }, RECAPTCHA_ACTIONS.newsletter)
  },
  track(preorderNumber: string) {
    return http.get<TrackingView>(`/tracking/${encodeURIComponent(preorderNumber.trim().toUpperCase())}`)
  },
  instagramFeed(limit = 9) {
    return http.get<CommunityLook[]>(`/instagram/feed${toQuery({ limit })}`)
  },

  // ----- admin
  analytics(days: number) {
    return http.get<DashboardAnalytics>(`/admin/dashboard/analytics${toQuery({ days })}`)
  },
  messages(status?: ContactMessage['status']) {
    return http.get<ContactMessage[]>(`/admin/messages${toQuery({ status })}`)
  },
  setMessageStatus(id: string, status: ContactMessage['status']) {
    return http.put(`/admin/messages/${id}`, { status })
  },
  instagramPosts() {
    return http.get<InstagramPost[]>('/admin/instagram/posts')
  },
  createInstagramPost(data: Partial<InstagramPost> & { hashtags?: string }) {
    return http.post<InstagramPost>('/admin/instagram/posts', data)
  },
  updateInstagramPost(id: string, data: Partial<InstagramPost>) {
    return http.put(`/admin/instagram/posts/${id}`, data)
  },
  deleteInstagramPost(id: string) {
    return http.delete(`/admin/instagram/posts/${id}`)
  },
}
