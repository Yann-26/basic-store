import {
  normalizePromoCode,
  promoDiscount,
  promoLabel,
  promoProblem,
  referralSettings,
  PROMO_CODE_RE,
  type Order,
  type PromoCode,
  type SessionUser,
} from '@trs/shared'
import type { Mailer, OrderRepository, PromoCodeWrite, PromoRepository, SettingsRepository, UserRepository } from '../ports'
import { ConflictError, NotFoundError, ValidationError } from '@/domain/errors'
import { referralRewardEmail } from '../templates/emails'

export interface PromoDeps {
  promos: PromoRepository
  orders: OrderRepository
  settings: SettingsRepository
  users: UserRepository
  mailer: Mailer
  config: { appUrl: string }
}

/** The account a code is checked for (checkout always needs one). */
export interface PromoAccount {
  userId: string
  email?: string | null
  emailVerified?: boolean
}

export interface AppliedPromo {
  promo: PromoCode
  discount: number
  /** Referral code: the account that shared it. */
  referrerId: string | null
}

export type PromoInput = Omit<PromoCodeWrite, 'source' | 'owner_user_id' | 'source_order_id'>

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const REWARD_MONTHS = 6

function randomPart(n: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(n))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

/** "AMINA-7KQ4": the first name (letters only) then a random part. */
function referralCodeFor(firstName: string) {
  const name = firstName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 8)
  return `${name.length >= 2 ? name : 'AMI'}-${randomPart(4)}`
}

/** Promo codes (back-office), referral (customer area) and their use at checkout. */
export function makePromoUseCases(d: PromoDeps) {
  const shopUrl = d.config.appUrl.replace(/\/$/, '')

  async function previousOrders(account: PromoAccount) {
    const orders = await d.orders.listForAccount(account.userId, account.emailVerified ? (account.email ?? null) : null)
    return orders.filter((o) => o.status !== 'cancelled').length
  }

  async function uniqueCode(make: () => string) {
    for (let i = 0; i < 8; i++) {
      const code = make()
      if (!(await d.promos.codeExists(code))) return code
    }
    throw new ConflictError('Impossible de générer un code, réessayez.')
  }

  const api = {
    /**
     * The discount a code gives on a basket, for this account — or a clear
     * reason why it doesn't apply. Used by the checkout preview and by the
     * order itself (where the price is decided).
     */
    async apply(rawCode: string, subtotal: number, account: PromoAccount): Promise<AppliedPromo> {
      const code = normalizePromoCode(rawCode)
      if (!PROMO_CODE_RE.test(code)) throw new ValidationError('Ce code n’existe pas.')
      const promo = await d.promos.findByCode(code)
      if (!promo) throw new ValidationError('Ce code n’existe pas.')

      let effective = promo
      if (promo.source === 'referral') {
        const referral = referralSettings(await d.settings.getAll().catch(() => ({})))
        if (!referral.enabled) throw new ValidationError('Le parrainage est suspendu pour le moment.')
        // The friend's discount follows the current settings, whatever the code was created with.
        effective = { ...promo, kind: 'percent', value: referral.friendPercent }
      }
      const needsHistory = effective.first_order_only || effective.source === 'referral'
      const [previous, usesByUser] = await Promise.all([
        needsHistory ? previousOrders(account) : Promise.resolve(0),
        d.promos.usesByUser(promo.id, account.userId),
      ])
      const problem = promoProblem(effective, { subtotal, userId: account.userId, previousOrders: previous, usesByUser })
      if (problem) throw new ValidationError(problem)
      return {
        promo: effective,
        discount: promoDiscount(effective, subtotal),
        referrerId: effective.source === 'referral' ? effective.owner_user_id : null,
      }
    },

    /** Checkout preview: what the code takes off this basket. */
    async quote(rawCode: string, subtotal: number, account: PromoAccount) {
      const applied = await api.apply(rawCode, subtotal, account)
      return {
        code: applied.promo.code,
        label: promoLabel(applied.promo),
        description: applied.promo.source === 'referral' ? 'Parrainage : remise sur votre première commande' : applied.promo.description,
        discount: applied.discount,
        subtotal,
        total: subtotal - applied.discount,
      }
    },

    /** Records the use once the order exists; false when the last use was just taken. */
    redeem(applied: AppliedPromo, orderId: string, userId: string) {
      return d.promos.redeem({ codeId: applied.promo.id, orderId, userId, amount: applied.discount })
    },

    /** A cancelled order gives its code back. */
    async onOrderCancelled(orderId: string) {
      await d.promos.release(orderId)
    },

    /**
     * A referred order was delivered: the referrer receives a credit, once,
     * as a code only their account can use, and an email.
     */
    async onOrderDelivered(order: Order) {
      const referrerId = order.referred_by_user_id
      if (!referrerId) return null
      const referral = referralSettings(await d.settings.getAll().catch(() => ({})))
      if (!referral.enabled || referral.rewardAmount <= 0) return null
      if (await d.promos.rewardExistsForOrder(order.id)) return null
      const referrer = await d.users.getSessionUser(referrerId)
      if (!referrer) return null

      const ends = new Date()
      ends.setMonth(ends.getMonth() + REWARD_MONTHS)
      let reward: PromoCode
      try {
        reward = await d.promos.create({
          code: await uniqueCode(() => `MERCI-${randomPart(6)}`),
          kind: 'fixed',
          value: referral.rewardAmount,
          description: `Merci pour votre parrainage (commande ${order.preorder_number})`,
          min_order: 0,
          max_uses: 1,
          per_account_limit: 1,
          starts_at: null,
          ends_at: ends.toISOString(),
          is_active: true,
          source: 'reward',
          owner_user_id: referrerId,
          source_order_id: order.id,
          first_order_only: false,
        })
      } catch (err) {
        // Another request already rewarded this order (unique per order).
        if ((err as { code?: string }).code === '23505') return null
        throw err
      }
      const friend = order.customers?.first_name ?? 'Votre filleul·e'
      void d.mailer.send({
        to: referrer.email,
        subject: `Merci pour votre parrainage : ${reward.code}`,
        html: referralRewardEmail({
          firstName: referrer.first_name,
          friendName: friend,
          code: reward.code,
          amount: reward.value,
          endsAt: ends.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
          shopUrl,
        }),
      })
      return reward
    },

    /** "Mon compte → Parrainage": the code to share (created on first visit) and what it brought. */
    async myReferral(user: SessionUser) {
      const referral = referralSettings(await d.settings.getAll().catch(() => ({})))
      let code = await d.promos.referralCodeOf(user.id)
      if (!code && referral.enabled) {
        try {
          code = await d.promos.create({
            code: await uniqueCode(() => referralCodeFor(user.first_name ?? '')),
            kind: 'percent',
            value: referral.friendPercent,
            description: 'Code de parrainage',
            min_order: 0,
            max_uses: null,
            per_account_limit: 1,
            starts_at: null,
            ends_at: null,
            is_active: true,
            source: 'referral',
            owner_user_id: user.id,
            first_order_only: true,
          })
        } catch (err) {
          // Two tabs at once: the other one created it.
          if ((err as { code?: string }).code !== '23505') throw err
          code = await d.promos.referralCodeOf(user.id)
        }
      }
      const [stats, rewards] = await Promise.all([d.promos.referredOrders(user.id), d.promos.rewardsOf(user.id)])
      return {
        enabled: referral.enabled,
        code: code?.code ?? null,
        link: code ? `${shopUrl}/?ref=${encodeURIComponent(code.code)}` : null,
        friend_discount: referral.friendPercent,
        reward_amount: referral.rewardAmount,
        referred: stats.orders,
        delivered: stats.delivered,
        rewards: rewards.map((r) => ({ code: r.code, value: r.value, used: r.uses > 0, ends_at: r.ends_at, active: r.is_active })),
      }
    },

    // ---------------------------------------------------------------- admin

    list(opts: { source?: PromoCode['source']; search?: string }) {
      return d.promos.list(opts)
    },

    async create(input: PromoInput) {
      const code = normalizePromoCode(input.code)
      if (await d.promos.codeExists(code)) throw new ConflictError(`Le code ${code} existe déjà.`)
      return d.promos.create({ ...input, code, source: 'manual', owner_user_id: null })
    },

    async update(id: string, input: Partial<PromoInput>) {
      const promo = await d.promos.findById(id)
      if (!promo) throw new NotFoundError('Code introuvable')
      const patch: Partial<PromoCodeWrite> = { ...input }
      if (input.code !== undefined) {
        const code = normalizePromoCode(input.code)
        if (code !== promo.code && promo.uses > 0) throw new ConflictError('Un code déjà utilisé ne peut pas être renommé : créez-en un nouveau.')
        if (await d.promos.codeExists(code, id)) throw new ConflictError(`Le code ${code} existe déjà.`)
        patch.code = code
      }
      // A referral code's discount follows the settings; only its activation is managed here.
      if (promo.source !== 'manual') {
        return d.promos.update(id, patch.is_active === undefined ? {} : { is_active: patch.is_active })
      }
      return d.promos.update(id, patch)
    },

    /** A code that was used stays (orders refer to it): it is switched off instead. */
    async remove(id: string) {
      const promo = await d.promos.findById(id)
      if (!promo) throw new NotFoundError('Code introuvable')
      if (promo.uses > 0) {
        await d.promos.update(id, { is_active: false })
        return { deleted: false, deactivated: true }
      }
      await d.promos.delete(id)
      return { deleted: true, deactivated: false }
    },

    referralStats() {
      return d.promos.referralStats()
    },
  }
  return api
}
