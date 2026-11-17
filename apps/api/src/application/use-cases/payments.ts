import { randomInt } from 'node:crypto'
import {
  LEGACY_PREFIXES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_REFERENCE_PREFIX,
  formatCurrency,
  paymentProgress,
  type ManualPaymentMethod,
  type Order,
  type PaymentKind,
  type PaymentMethod,
  type PaymentStatus,
  type SessionUser,
} from '@trs/shared'
import type { Mailer, OrderRepository, PaymentGateway, PaymentRepository } from '../ports'
import { actorOf, authorize } from '../authorization'
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '@/domain/errors'
import { balanceReminderEmail, paymentReceivedEmail } from '../templates/emails'

export interface PaymentDeps {
  payments: PaymentRepository
  orders: OrderRepository
  gateway: PaymentGateway
  /** Receipts and reminders; optional so tests can leave it out. */
  mailer?: Mailer
  config: { appUrl: string; adminEmail?: string }
}

export interface ManualPaymentInput {
  amount: number
  method: ManualPaymentMethod
  note?: string | null
}

const REFERENCE_RE = new RegExp(`^(${[PAYMENT_REFERENCE_PREFIX, ...LEGACY_PREFIXES].join('|')})-\\d+-[A-Z0-9]+$`)
const MIN_AMOUNT = 100
const MAX_AMOUNT = 10_000_000
const CURRENCY = 'XOF'
/** An open Paystack checkout is handed out again instead of creating a new transaction. */
const CHECKOUT_REUSE_MS = 30 * 60_000
const REFERENCE_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function newReference() {
  // randomInt is uniform (no modulo bias)
  const suffix = Array.from({ length: 8 }, () => REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)]).join('')
  return `${PAYMENT_REFERENCE_PREFIX}-${Date.now()}-${suffix}`
}

/**
 * Online payments go through Paystack (Mobile Money — Wave, Orange, MTN, Moov —
 * and cards, in FCFA). A payment is created "pending" when the checkout opens
 * and only counts as money once Paystack itself confirms it, for at least the
 * expected amount in FCFA: on the customer's return (verify) or by the signed
 * webhook, whichever comes first.
 *   pending → success | failed,   success → refunded.
 * Each step is a conditional update, so the webhook and the return can never
 * both credit the order. Older Wave payments still waiting can be confirmed or
 * refused by an admin.
 */
export function makePaymentUseCases(d: PaymentDeps) {
  /** True if the gateway's answer pays at least what we expect, in our currency. */
  const pays = (result: { status: string; amount: number; currency: string | null }, expected: number) =>
    result.status === 'success' && result.amount + 1 >= expected && (result.currency ?? CURRENCY).toUpperCase() === CURRENCY

  const payUrl = (order: Pick<Order, 'preorder_number'>) => `${d.config.appUrl.replace(/\/$/, '')}/payer/${order.preorder_number}`
  const customerName = (order: Order) => `${order.customers?.first_name ?? ''} ${order.customers?.last_name ?? ''}`.trim() || 'cher client'
  const methodLabel = (method: PaymentMethod) => PAYMENT_METHOD_LABELS[method] ?? method

  /**
   * Money received for an order (online, Wave or by hand): adds it to the order,
   * confirms a pending order, writes the timeline and emails a receipt.
   */
  async function creditOrder(orderId: string, amount: number, kind: PaymentKind, method: PaymentMethod) {
    const before = await d.orders.findById(orderId)
    const after = await d.orders.applyPayment(orderId, amount)
    if (!before || !after) return
    const progress = paymentProgress({ total_price: after.total_price, amount_paid: after.amount_paid, payment_status: after.payment_status })
    const how = methodLabel(method).toLowerCase()
    const done = progress.outstanding === 0 ? ' — commande payée à 100 %' : ` — reste ${formatCurrency(progress.outstanding)}`

    if (before.status === 'pending') {
      await d.orders.update(orderId, { status: 'confirmed' })
      await d.orders.addTracking({ order_id: orderId, status: 'confirmed', notes: `Paiement reçu (${formatCurrency(amount)}, ${how}) — commande confirmée${done}` })
    } else if (before.status === 'cancelled') {
      // Paid after it was cancelled (late online payment): the shop must refund or reopen it by hand.
      await d.orders.addTracking({
        order_id: orderId,
        status: 'cancelled',
        notes: `⚠️ Paiement reçu après l’annulation : ${formatCurrency(amount)} (${how}) — à rembourser ou à traiter`,
      })
    } else {
      await d.orders.addTracking({
        order_id: orderId,
        status: before.status,
        notes: `${kind === 'deposit' ? 'Paiement' : 'Complément'} reçu : ${formatCurrency(amount)} (${how})${done}`,
      })
    }

    const email = before.customers?.email
    if (d.mailer && email) {
      await d.mailer
        .send({
          to: email,
          subject: progress.outstanding === 0 ? `Commande ${before.preorder_number} payée à 100 %` : `Paiement reçu — ${before.preorder_number}`,
          html: paymentReceivedEmail({
            preorderNumber: before.preorder_number,
            customerName: customerName(before),
            amount,
            methodLabel: methodLabel(method),
            total: progress.total,
            paid: progress.paid,
            outstanding: progress.outstanding,
            payUrl: payUrl(before),
          }),
        })
        .catch(() => false)
    }
  }

  /**
   * Idempotent: marks the payment successful and credits its order once.
   * The order is always taken from our own payment record, never from
   * client-supplied or gateway metadata.
   */
  async function markPaid(reference: string, info: { channel: string | null; paidAt: string | null }) {
    const payment = await d.payments.findByReference(reference)
    if (!payment) return
    const won = await d.payments.transition(reference, ['pending', 'failed'], {
      status: 'success',
      channel: info.channel ?? 'unknown',
      paid_at: info.paidAt ?? new Date().toISOString(),
    })
    // The webhook or the customer's return already recorded it: never credit twice.
    if (won && payment.order_id) await creditOrder(payment.order_id, payment.amount, payment.kind ?? 'deposit', payment.method ?? 'paystack')
  }

  /** Confirms a payment only if Paystack reports it successful for at least the expected amount. */
  async function confirmWithGateway(reference: string) {
    const payment = await d.payments.findByReference(reference)
    if (!payment || payment.status === 'success' || payment.status === 'refunded') return
    const result = await d.gateway.verify(reference)
    if (pays(result, payment.amount)) await markPaid(reference, { channel: result.channel, paidAt: result.paidAt })
  }

  /** A Wave payment (from before Paystack came back) by its reference, with its order. */
  async function openWavePayment(reference: string) {
    const ref = reference.trim().toUpperCase()
    if (!REFERENCE_RE.test(ref)) throw new ValidationError('Référence de paiement invalide')
    const payment = await d.payments.findByReference(ref)
    if (!payment || payment.method !== 'wave' || !payment.order_id) throw new NotFoundError('Paiement introuvable')
    const order = await d.orders.findById(payment.order_id)
    if (!order) throw new NotFoundError('Commande introuvable')
    return { ref, payment: payment as typeof payment & { metadata?: Record<string, unknown> | null }, order }
  }

  return {
    /**
     * Opens (or reopens) the Paystack checkout for what the caller's own order
     * still needs. The amount is decided here, never by the client.
     */
    async initialize(input: { orderId: string }, user: SessionUser) {
      const order = await d.orders.findById(input.orderId)
      if (!order) throw new NotFoundError('Commande introuvable')
      authorize({ actor: actorOf(user), action: 'payment:initialize', resource: order })
      if (order.status === 'cancelled') throw new ConflictError('Cette commande a été annulée')
      const progress = paymentProgress(order)
      if (progress.outstanding <= 0) throw new ConflictError('Cette commande est déjà payée à 100 %')
      // Online payment always settles everything still due (no deposit any more).
      const kind: PaymentKind = progress.paid > 0 ? 'balance' : 'deposit'
      const amount = progress.outstanding
      const email = order.customers?.email || user.email
      if (!email) throw new ValidationError('Email requis pour le paiement')
      if (!amount || amount < MIN_AMOUNT) throw new ValidationError(`Montant minimum : ${MIN_AMOUNT} FCFA`)
      if (amount > MAX_AMOUNT) throw new ValidationError('Montant supérieur à la limite autorisée')

      // A retry (double click, page refresh) gets the checkout already opened.
      const open = await d.payments.findOpenForOrder(order.id, new Date(Date.now() - CHECKOUT_REUSE_MS).toISOString())
      const openUrl = open?.metadata && typeof open.metadata.authorization_url === 'string' ? open.metadata.authorization_url : null
      if (open && openUrl && open.method === 'paystack' && open.amount === amount && (open.kind ?? 'deposit') === kind) {
        return { authorization_url: openUrl, reference: open.reference, amount, kind }
      }

      const reference = newReference()
      await d.payments.create({
        order_id: order.id,
        reference,
        amount,
        customer_email: email,
        customer_id: order.customer_id,
        metadata: { preorder_number: order.preorder_number, kind },
        kind,
        method: 'paystack',
      })
      try {
        const result = await d.gateway.initialize({
          email,
          amount,
          reference,
          callbackUrl: `${d.config.appUrl.replace(/\/$/, '')}/payment/callback`,
          metadata: { order_id: order.id, preorder_number: order.preorder_number, kind },
        })
        await d.payments.update(reference, { metadata: { preorder_number: order.preorder_number, kind, authorization_url: result.authorizationUrl } })
        return { authorization_url: result.authorizationUrl, reference, amount, kind }
      } catch (error) {
        await d.payments.transition(reference, ['pending'], { status: 'failed', error_message: 'Ouverture du paiement Paystack échouée' })
        throw error
      }
    },

    /**
     * The customer is back from Paystack: asks Paystack (never the browser)
     * whether it is paid, and records it once. Says only what the thank-you
     * page needs.
     */
    async verify(reference: string) {
      const ref = reference.trim().toUpperCase()
      if (!REFERENCE_RE.test(ref)) throw new ValidationError('Référence de paiement invalide')
      const payment = await d.payments.findByReference(ref)
      if (!payment) throw new NotFoundError('Paiement introuvable')
      const order = payment.order_id ? await d.orders.findById(payment.order_id) : null
      const base = {
        reference: ref,
        amount: payment.amount,
        kind: payment.kind ?? 'deposit',
        preorder_number: order?.preorder_number ?? null,
        first_name: order?.customers?.first_name ?? null,
      }
      if (payment.status === 'success') return { ...base, status: 'success' as const }

      const result = await d.gateway.verify(ref)
      if (pays(result, payment.amount)) {
        await markPaid(ref, { channel: result.channel, paidAt: result.paidAt })
        return { ...base, status: 'success' as const }
      }
      if (result.status === 'success') {
        // Paid, but not the amount or currency expected: never credited, left for the shop to check.
        console.error(JSON.stringify({ level: 'error', msg: 'payment.amount_mismatch', reference: ref, expected: payment.amount, paid: result.amount, currency: result.currency }))
        return { ...base, status: 'review' as const }
      }
      if (result.status === 'failed' || result.status === 'abandoned') await d.payments.transition(ref, ['pending'], { status: 'failed' })
      return { ...base, status: result.status }
    },

    /** Paystack's signed notifications (charge.success, charge.failed, refund.processed). */
    async handleWebhook(rawBody: string, signature: string | null) {
      if (!d.gateway.isValidWebhookSignature(rawBody, signature)) throw new UnauthorizedError('Signature invalide')
      let event: { event?: string; data?: Record<string, unknown> }
      try {
        event = JSON.parse(rawBody)
      } catch {
        throw new ValidationError('Notification illisible')
      }
      const data = event.data ?? {}
      switch (event.event) {
        case 'charge.success': {
          const reference = String(data.reference ?? '')
          // Re-checked with Paystack before anything is credited.
          if (REFERENCE_RE.test(reference)) await confirmWithGateway(reference)
          break
        }
        case 'charge.failed':
          // A late or replayed failure never overrides a recorded success.
          if (data.reference) await d.payments.transition(String(data.reference), ['pending'], { status: 'failed' })
          break
        case 'refund.processed': {
          const reference = data.transaction_reference ? String(data.transaction_reference) : ''
          const payment = reference ? await d.payments.findByReference(reference) : null
          // Only the caller that moves it to "refunded" takes the money off the order.
          if (payment && (await d.payments.transition(reference, ['success'], { status: 'refunded' })) && payment.order_id) {
            await d.orders.applyPayment(payment.order_id, -payment.amount)
            await d.orders.addTracking({
              order_id: payment.order_id,
              status: (await d.orders.findById(payment.order_id))?.status ?? 'confirmed',
              notes: `Paiement remboursé : ${formatCurrency(payment.amount)}`,
            })
          }
          break
        }
      }
      return { received: true }
    },

    /** Admin: an older Wave payment is in the Wave Business app — it now counts as money received. */
    async confirm(reference: string, admin: SessionUser) {
      const { ref, payment, order } = await openWavePayment(reference)
      if (payment.status !== 'pending') throw new ConflictError('Ce paiement a déjà été traité')
      const outstanding = paymentProgress(order).outstanding
      if (payment.amount > outstanding) {
        throw new ConflictError(`Ce paiement dépasse le reste à payer (${formatCurrency(outstanding)}) : refusez-le ou remboursez la différence`)
      }
      const won = await d.payments.transition(ref, ['pending'], {
        status: 'success',
        channel: 'wave',
        paid_at: new Date().toISOString(),
        recorded_by: admin.id,
      })
      if (won) await creditOrder(order.id, payment.amount, payment.kind ?? 'deposit', 'wave')
      return d.orders.findById(order.id)
    },

    /** Admin: no matching older Wave payment — it never counts. */
    async reject(reference: string, input: { reason?: string | null }, admin: SessionUser) {
      const { ref, payment, order } = await openWavePayment(reference)
      if (payment.status !== 'pending') throw new ConflictError('Ce paiement a déjà été traité')
      await d.payments.transition(ref, ['pending'], {
        status: 'failed',
        error_message: input.reason?.trim().slice(0, 300) || 'Paiement Wave non trouvé',
        recorded_by: admin.id,
      })
      return d.orders.findById(order.id)
    },

    /**
     * Admin: money received outside the website (cash at delivery, Mobile Money
     * to the shop's number…). Recorded as a successful payment so that the
     * order, the dashboard and the customer's account all show real money.
     */
    async recordManual(orderId: string, input: ManualPaymentInput, admin: SessionUser) {
      const order = await d.orders.findById(orderId)
      if (!order) throw new NotFoundError('Commande introuvable')
      if (order.status === 'cancelled') throw new ConflictError('Cette commande a été annulée')
      const progress = paymentProgress(order)
      if (progress.outstanding <= 0) throw new ConflictError('Cette commande est déjà payée à 100 %')
      if (!Number.isInteger(input.amount) || input.amount <= 0) throw new ValidationError('Montant invalide')
      if (input.amount > progress.outstanding) {
        throw new ValidationError(`Le montant dépasse le reste à payer (${formatCurrency(progress.outstanding)})`)
      }

      const kind: PaymentKind = progress.paid > 0 ? 'balance' : 'deposit'
      const now = new Date().toISOString()
      await d.payments.create({
        order_id: order.id,
        reference: newReference(),
        amount: input.amount,
        customer_email: order.customers?.email ?? '',
        customer_id: order.customer_id,
        metadata: { preorder_number: order.preorder_number, kind, recorded_by_email: admin.email },
        kind,
        method: input.method,
        received: { channel: input.method, paid_at: now, note: input.note?.trim() || null, recorded_by: admin.id },
      })
      await creditOrder(order.id, input.amount, kind, input.method)
      return d.orders.findById(order.id)
    },

    /** Admin: emails the customer what is left to pay, with the link to pay it online. */
    async remind(orderId: string) {
      const order = await d.orders.findById(orderId)
      if (!order) throw new NotFoundError('Commande introuvable')
      const progress = paymentProgress(order)
      if (progress.outstanding <= 0) throw new ConflictError('Cette commande est déjà payée à 100 %')
      const email = order.customers?.email
      const sent =
        !!email &&
        !!d.mailer &&
        (await d.mailer
          .send({
            to: email,
            subject: `Reste à régler — ${order.preorder_number}`,
            html: balanceReminderEmail({
              preorderNumber: order.preorder_number,
              customerName: customerName(order),
              total: progress.total,
              paid: progress.paid,
              outstanding: progress.outstanding,
              payUrl: payUrl(order),
            }),
          })
          .catch(() => false))
      if (sent) await d.orders.addTracking({ order_id: order.id, status: order.status, notes: `Rappel de paiement envoyé (${formatCurrency(progress.outstanding)})` })
      return { sent, email: email ?? null, outstanding: progress.outstanding, payUrl: payUrl(order) }
    },

    async list(opts: { status?: PaymentStatus; orderId?: string; page: number; limit: number }) {
      const [{ items, total }, all] = await Promise.all([d.payments.list(opts), d.payments.listAll()])
      const count = (s: PaymentStatus) => all.filter((p) => p.status === s).length
      return {
        payments: items,
        total,
        page: opts.page,
        totalPages: Math.ceil(total / opts.limit),
        stats: {
          totalRevenue: all.filter((p) => p.status === 'success').reduce((s, p) => s + p.amount, 0),
          totalPending: count('pending'),
          totalSuccess: count('success'),
          totalFailed: count('failed'),
          totalRefunded: count('refunded'),
          total: all.length,
        },
      }
    },
  }
}
