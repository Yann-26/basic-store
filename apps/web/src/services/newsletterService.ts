import type { NewsletterAudience, NewsletterBlock, NewsletterCampaign } from '@trs/shared'
import { http } from '../core/http'

export type CampaignInput = Pick<NewsletterCampaign, 'title' | 'subject' | 'preheader' | 'blocks' | 'audience'>

export interface NewsletterSubscriber {
  id: string
  email: string
  source: string | null
  created_at: string
  unsubscribed_at: string | null
}

/** Back-office newsletter campaigns + the customer's own email preferences. */
export const newsletterService = {
  list: () => http.get<NewsletterCampaign[]>('/admin/newsletter/campaigns'),
  get: (id: string) => http.get<NewsletterCampaign>(`/admin/newsletter/campaigns/${id}`),
  create: (data: CampaignInput) => http.post<NewsletterCampaign>('/admin/newsletter/campaigns', data),
  update: (id: string, data: Partial<CampaignInput>) => http.put<NewsletterCampaign>(`/admin/newsletter/campaigns/${id}`, data),
  remove: (id: string) => http.delete(`/admin/newsletter/campaigns/${id}`),
  preview: (data: { subject: string; preheader: string; blocks: NewsletterBlock[] }) => http.post<{ html: string }>('/admin/newsletter/preview', data),
  sendTest: (id: string) => http.post<{ sent: boolean; to: string; error: string | null }>(`/admin/newsletter/campaigns/${id}/test`),
  schedule: (id: string, at: Date) => http.post<NewsletterCampaign>(`/admin/newsletter/campaigns/${id}/schedule`, { at: at.toISOString() }),
  sendNow: (id: string) => http.post<NewsletterCampaign>(`/admin/newsletter/campaigns/${id}/send`),
  cancel: (id: string) => http.post<NewsletterCampaign>(`/admin/newsletter/campaigns/${id}/cancel`),
  audience: () => http.get<Record<NewsletterAudience, number>>('/admin/newsletter/audience'),
  subscribers: () => http.get<NewsletterSubscriber[]>('/admin/newsletter/subscribers'),
  removeSubscriber: (id: string) => http.delete(`/admin/newsletter/subscribers/${id}`),

  unsubscribe: (e: string, t: string) => http.post<{ unsubscribed: boolean; email: string }>('/newsletter/unsubscribe', { e, t }),
  getPreferences: () => http.get<{ marketingOptIn: boolean }>('/account/preferences'),
  setPreferences: (marketingOptIn: boolean) => http.put<{ marketingOptIn: boolean }>('/account/preferences', { marketingOptIn }),
}
