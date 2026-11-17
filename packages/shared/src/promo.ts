import { formatCurrency } from './format'

/**
 * Promo codes and referral: the rules shared by the API (which alone decides
 * the price) and the back-office (which shows them).
 */

export type PromoKind = 'percent' | 'fixed'
/** manual: created in the back-office; referral: a customer's code to share; reward: given to a referrer. */
export type PromoSource = 'manual' | 'referral' | 'reward'

export interface PromoCode {
  id: string
  code: string
  kind: PromoKind
  /** Percent (1–100) or an amount in FCFA. */
  value: number
  description: string
  /** Minimum basket, before discount (FCFA). */
  min_order: number
  /** Total uses allowed (null: unlimited). */
  max_uses: number | null
  /** Uses allowed per account. */
  per_account_limit: number
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  source: PromoSource
  /** referral: the account sharing the code; reward: the only account that can use it. */
  owner_user_id: string | null
  /** Only for an account's first order. */
  first_order_only: boolean
  uses: number
  created_at: string
}

export interface ReferralSettings {
  enabled: boolean
  /** Discount the friend gets on their first order, in percent. */
  friendPercent: number
  /** Credit the referrer receives once the friend's order is delivered (FCFA). */
  rewardAmount: number
}

export const DEFAULT_REFERRAL: ReferralSettings = { enabled: true, friendPercent: 10, rewardAmount: 5000 }
export const PROMO_CODE_RE = /^[A-Z0-9][A-Z0-9-]{2,29}$/

export function normalizePromoCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '')
}

export function referralSettings(s: Record<string, unknown>): ReferralSettings {
  const num = (v: unknown, d: number, min: number, max: number) => {
    const n = Number(v)
    return Number.isFinite(n) && v !== '' && v !== null && v !== undefined ? Math.min(max, Math.max(min, Math.round(n))) : d
  }
  const on = s.referral_enabled
  return {
    enabled: on === undefined || on === null ? DEFAULT_REFERRAL.enabled : on === true || on === 'true',
    friendPercent: num(s.referral_friend_discount, DEFAULT_REFERRAL.friendPercent, 1, 50),
    rewardAmount: num(s.referral_reward_amount, DEFAULT_REFERRAL.rewardAmount, 0, 1_000_000),
  }
}

/** What a code takes off a basket of `subtotal` (never more than the basket). */
export function promoDiscount(code: Pick<PromoCode, 'kind' | 'value'>, subtotal: number): number {
  if (subtotal <= 0 || code.value <= 0) return 0
  const raw = code.kind === 'percent' ? Math.round((subtotal * Math.min(100, code.value)) / 100) : Math.round(code.value)
  return Math.min(subtotal, Math.max(0, raw))
}

/** "-10 %" or "-5 000 F CFA". */
export function promoLabel(code: Pick<PromoCode, 'kind' | 'value'>): string {
  return code.kind === 'percent' ? `-${code.value} %` : `-${formatCurrency(code.value)}`
}

/**
 * Why a code can't be used on this basket, or null when it can. Checks that
 * need the account (owner, first order, uses per account) are passed in.
 */
export function promoProblem(
  code: PromoCode,
  ctx: { subtotal: number; now?: Date; userId?: string | null; previousOrders?: number; usesByUser?: number },
): string | null {
  const now = ctx.now ?? new Date()
  if (!code.is_active) return 'Ce code n’est plus actif.'
  if (code.starts_at && new Date(code.starts_at) > now) return 'Ce code n’est pas encore valable.'
  if (code.ends_at && new Date(code.ends_at) < now) return 'Ce code a expiré.'
  if (code.max_uses !== null && code.uses >= code.max_uses) return 'Ce code a déjà été utilisé le nombre de fois prévu.'
  if (ctx.subtotal < code.min_order) return `Ce code s’applique à partir de ${formatCurrency(code.min_order)} d’achat.`
  if (code.source === 'referral' && ctx.userId && code.owner_user_id === ctx.userId) return 'Votre code de parrainage est à partager : il ne s’applique pas à vos propres commandes.'
  if (code.source === 'reward' && code.owner_user_id && ctx.userId !== code.owner_user_id) return 'Ce code est réservé à un autre compte.'
  if ((code.first_order_only || code.source === 'referral') && (ctx.previousOrders ?? 0) > 0) return 'Ce code est réservé à une première commande.'
  if (ctx.usesByUser !== undefined && ctx.usesByUser >= code.per_account_limit) return 'Vous avez déjà utilisé ce code.'
  return null
}
