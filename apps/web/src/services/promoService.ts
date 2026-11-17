import type { PromoCode } from '@trs/shared'
import { http, toQuery } from '../core/http'
import { readJSON, removeKey, writeJSON } from '../core/storage'

export interface PromoQuote {
  code: string
  kind: PromoCode['kind']
  value: number
  /** A friend's referral code. */
  referral: boolean
  discount: number
  subtotal: number
  total: number
}

export interface MyReferral {
  enabled: boolean
  code: string | null
  link: string | null
  friend_discount: number
  reward_amount: number
  referred: number
  delivered: number
  rewards: { code: string; value: number; used: boolean; ends_at: string | null; active: boolean }[]
}

export interface ReferralStat {
  referrer: { id: string; email: string; first_name: string; last_name: string }
  code: string | null
  orders: number
  delivered: number
  rewards: number
}

export type PromoCodeInput = Pick<
  PromoCode,
  'code' | 'kind' | 'value' | 'description' | 'min_order' | 'max_uses' | 'per_account_limit' | 'starts_at' | 'ends_at' | 'is_active' | 'first_order_only'
>

const REF_KEY = 'referral_code'
const REF_DAYS = 30

/** A friend's code from a shared link (?ref=…), kept 30 days for the checkout. */
export const referralMemory = {
  remember(code: string) {
    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 30)
    if (clean.length >= 3) writeJSON(REF_KEY, { code: clean, at: Date.now() })
  },
  read(): string | null {
    const saved = readJSON<{ code: string; at: number } | null>(REF_KEY, null)
    if (!saved?.code) return null
    if (Date.now() - saved.at > REF_DAYS * 86_400_000) {
      removeKey(REF_KEY)
      return null
    }
    return saved.code
  },
  forget() {
    removeKey(REF_KEY)
  },
}

export const promoService = {
  quote(promo_code: string, items: { product_id: string; size: string; color?: string; quantity: number }[]) {
    return http.post<PromoQuote>('/promo/quote', { promo_code, items })
  },
  myReferral() {
    return http.get<MyReferral>('/account/referral')
  },

  // back-office
  list(params: { source?: PromoCode['source']; search?: string } = {}) {
    return http.get<PromoCode[]>(`/admin/promo-codes${toQuery(params)}`)
  },
  create(input: PromoCodeInput) {
    return http.post<PromoCode>('/admin/promo-codes', input)
  },
  update(id: string, patch: Partial<PromoCodeInput>) {
    return http.put<PromoCode>(`/admin/promo-codes/${id}`, patch)
  },
  remove(id: string) {
    return http.delete<{ deleted: boolean; deactivated: boolean }>(`/admin/promo-codes/${id}`)
  },
  referrals() {
    return http.get<ReferralStat[]>('/admin/referrals')
  },
}
