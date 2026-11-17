import {
  MAX_QUANTITY_PER_LINE,
  ORDER_STATUS_LABELS,
  STOCK_RELEASING_STATUSES,
  TRACKING_STEPS,
  canTransition,
  computeOrderTotals,
  generateOrderNumber,
  isValidOrderNumber,
  ONE_SIZE,
  resolveDeliverySettings,
  stockForSize,
  type CheckoutPaymentMode,
  type Customer,
  type DeliveryZone,
  type Order,
  type OrderItem,
  type OrderStatus,
} from '@trs/shared'
import type { CustomerRepository, Mailer, OrderRepository, ProductRepository, SettingsRepository } from '../ports'
import { ConflictError, EmailNotVerifiedError, NotFoundError, OutOfStockError, ValidationError } from '@/domain/errors'
import { adminNewOrderEmail, orderConfirmationEmail, statusUpdateEmail } from '../templates/emails'
import { brand } from '../brand'
import type { AppliedPromo, makePromoUseCases } from './promo'

export interface OrderDeps {
  orders: OrderRepository
  products: ProductRepository
  customers: CustomerRepository
  settings: SettingsRepository
  mailer: Mailer
  config: { appUrl: string; adminEmail?: string }
  /** Promo and referral codes (checkout discount, reward on delivery). */
  promo?: Pick<ReturnType<typeof makePromoUseCases>, 'apply' | 'redeem' | 'onOrderCancelled' | 'onOrderDelivered'>
  /** Asks the customer for a review once the order is delivered. */
  reviews?: { inviteAfterDelivery(order: Order): Promise<boolean> }
}

/** Online orders not paid after this delay are cancelled and their stock released. */
export const UNPAID_ONLINE_ORDER_TTL_MS = 2 * 3_600_000

export interface CreateOrderInput {
  customer: {
    firstName: string
    lastName: string
    phone: string
    whatsapp?: string | null
    email?: string | null
    city: string
    address: string
    notes?: string | null
  }
  items: { product_id: string; size?: string | null; color?: string | null; quantity: number }[]
  /** Online (100 % now, Paystack) or cash / Mobile Money on delivery. */
  payment_method: CheckoutPaymentMode
  delivery_zone: DeliveryZone
  /** Promo or referral code typed at checkout. */
  promo_code?: string | null
}

export interface UpdateOrderInput {
  status?: OrderStatus
  admin_notes?: string | null
  estimated_delivery?: string | null
  delivery_address?: string | null
  delivery_city?: string | null
  location?: string | null
  notify_customer?: boolean
}

const flag = (v: unknown, fallback: boolean) => (v === undefined || v === null ? fallback : v === true || v === 'true')

function maskPhone(phone?: string | null) {
  return phone ? `****${phone.slice(-4)}` : null
}

export function makeOrderUseCases(d: OrderDeps) {
  const trackingUrl = (n: string) => `${d.config.appUrl.replace(/\/$/, '')}/track?number=${encodeURIComponent(n)}`

  const PHONE_TAKEN =
    'Ce numéro de téléphone est déjà associé à un autre client. Utilisez un autre numéro ou contactez-nous sur WhatsApp.'

  /**
   * The customer record an order is attached to. With an account it is the record
   * of the account's (verified) email; a phone number typed in the form never
   * selects — nor overwrites — somebody else's record.
   */
  async function findOrCreateCustomer(c: CreateOrderInput['customer'], accountEmail: string | null): Promise<Customer> {
    const profile = {
      first_name: c.firstName,
      last_name: c.lastName,
      whatsapp: c.whatsapp || c.phone,
      city: c.city,
      address: c.address,
    }
    const email = accountEmail ?? c.email ?? null
    const [mine, byPhone] = await Promise.all([email ? d.customers.findByEmail(email) : null, d.customers.findByPhone(c.phone)])

    // Without an account nothing proves that an existing record is the caller's.
    if (!accountEmail && (mine || byPhone)) throw new ConflictError('Connectez-vous pour commander avec ces coordonnées.')
    if (byPhone && byPhone.id !== mine?.id) throw new ConflictError(PHONE_TAKEN)
    if (mine) return d.customers.update(mine.id, { ...profile, phone: c.phone })
    return d.customers.create({ ...profile, phone: c.phone, email, notes: c.notes || '' })
  }

  async function uniqueOrderNumber() {
    for (let i = 0; i < 6; i++) {
      const n = generateOrderNumber()
      if (!(await d.orders.numberExists(n))) return n
    }
    throw new ConflictError('Impossible de générer un numéro de commande, réessayez.')
  }

  /** The order lines, priced from the database (never from the client). */
  async function buildLines(items: CreateOrderInput['items']): Promise<Omit<OrderItem, 'id' | 'order_id'>[]> {
    const ids = [...new Set(items.map((i) => i.product_id))]
    const found = new Map((await d.products.findManyByIds(ids)).map((p) => [p.id, p]))

    const lines: Omit<OrderItem, 'id' | 'order_id'>[] = items.map((item) => {
      const product = found.get(item.product_id)
      if (!product || !product.is_active) throw new ValidationError('Un article de votre panier n’est plus disponible')
      if (product.status === 'unavailable') throw new ValidationError(`« ${product.name} » est actuellement indisponible`)

      const requested = (item.size ?? '').trim().toUpperCase()
      let size: string = ONE_SIZE
      if (product.sizes.length > 0) {
        if (!product.sizes.includes(requested)) {
          throw new ValidationError(`Taille « ${item.size ?? '—'} » indisponible pour « ${product.name} »`)
        }
        size = requested
      }
      const color = item.color && product.colors.includes(item.color) ? item.color : null

      return {
        product_id: product.id,
        product_name: product.name,
        product_price: product.price,
        size,
        color,
        quantity: Math.min(MAX_QUANTITY_PER_LINE, Math.max(1, Math.floor(item.quantity))),
      }
    })
    // A first check on the stock read now (the database checks again, atomically, when the order is written).
    const wanted = new Map<string, number>()
    for (const l of lines) {
      const key = `${l.product_id}|${l.size}`
      wanted.set(key, (wanted.get(key) ?? 0) + l.quantity)
    }
    for (const [key, qty] of wanted) {
      const [id, size] = key.split('|') as [string, string]
      const product = found.get(id)!
      const available = stockForSize(product, size)
      if (qty > available) throw new OutOfStockError(product.name, size, available)
    }
    return lines
  }

  const api = {
    /**
     * Public checkout. Prices always come from the database, never from the client.
     * The stock is taken when the order is written (all lines or none); a cash-on-delivery
     * order waits for the shop's call, an online one for its payment.
     */
    async create(input: CreateOrderInput, account?: { userId: string; emailVerified?: boolean; email?: string }) {
      if (account && !account.emailVerified) {
        throw new EmailNotVerifiedError('Confirmez votre adresse email pour passer commande. Un lien vous a été envoyé.')
      }
      const settings = await d.settings.getAll().catch(() => ({} as Record<string, unknown>))
      const maxItems = Number(settings.max_items_per_order) || 10
      const deliveryDays = Number(settings.delivery_days_max) || 5
      if (input.payment_method === 'online' && !flag(settings.online_payment_enabled, true)) {
        throw new ValidationError('Le paiement en ligne est momentanément indisponible : choisissez le paiement à la livraison.')
      }
      if (input.payment_method === 'cash_on_delivery' && !flag(settings.cash_on_delivery_enabled, true)) {
        throw new ValidationError('Le paiement à la livraison est momentanément indisponible : payez en ligne.')
      }

      const totalQty = input.items.reduce((s, i) => s + i.quantity, 0)
      if (totalQty > maxItems) throw new ValidationError(`Maximum ${maxItems} articles par commande`)

      const lines = await buildLines(input.items)
      const priced = lines.map((l) => ({ unitPrice: l.product_price, quantity: l.quantity }))
      const subtotal = computeOrderTotals(priced).subtotal

      // A promo or referral code: the discount is decided here, from the database.
      let applied: AppliedPromo | null = null
      if (input.promo_code?.trim()) {
        if (!d.promo) throw new ValidationError('Les codes promo ne sont pas disponibles pour le moment.')
        if (!account) throw new ValidationError('Connectez-vous pour utiliser un code.')
        applied = await d.promo.apply(input.promo_code, subtotal, { userId: account.userId, email: account.email, emailVerified: account.emailVerified })
      }
      const totals = computeOrderTotals(priced, {
        discount: applied?.discount ?? 0,
        zone: input.delivery_zone,
        payment: input.payment_method,
        delivery: resolveDeliverySettings(settings),
      })

      const customer = await findOrCreateCustomer(input.customer, account?.email ?? null)
      const orderNumber = await uniqueOrderNumber()
      const pickup = input.delivery_zone === 'pickup'

      const order = await d.orders.create(
        {
          preorder_number: orderNumber,
          customer_id: customer.id,
          user_id: account?.userId ?? null,
          status: 'pending',
          total_price: totals.total,
          // deposit_amount = what is paid online now; remaining_amount = what the rider (or the shop) collects.
          deposit_amount: totals.dueNow,
          deposit_percentage: input.payment_method === 'online' ? 100 : 0,
          remaining_amount: totals.dueOnDelivery,
          payment_method: input.payment_method,
          // A code that covers everything leaves nothing to pay.
          payment_status: totals.total === 0 ? 'paid' : 'pending',
          subtotal_price: totals.subtotal,
          discount_amount: totals.discount,
          delivery_zone: input.delivery_zone,
          delivery_fee: totals.deliveryFee,
          promo_code: applied?.promo.code ?? null,
          referred_by_user_id: applied?.referrerId ?? null,
          delivery_address: pickup ? 'Retrait en boutique' : input.customer.address,
          delivery_city: input.customer.city,
          customer_notes: input.customer.notes || '',
          estimated_delivery: new Date(Date.now() + deliveryDays * 86_400_000).toISOString().slice(0, 10),
        },
        lines,
      )
      // The units are taken atomically: if somebody bought the last one meanwhile, the order is undone.
      try {
        await d.orders.reserveStock(order.id)
      } catch (error) {
        await d.orders.delete(order.id)
        throw error
      }
      if (applied && d.promo && account) {
        // The use is counted atomically; if another order just took the last one, this order is undone.
        if (!(await d.promo.redeem(applied, order.id, account.userId))) {
          await d.orders.releaseStock(order.id, 'cancel')
          await d.orders.delete(order.id)
          throw new ConflictError('Ce code vient d’atteindre sa limite d’utilisation. Retirez-le pour commander.')
        }
      }
      await d.orders.addTracking({
        order_id: order.id,
        status: 'pending',
        notes: input.payment_method === 'online' ? 'Commande créée — en attente du paiement en ligne' : 'Commande créée — paiement à la livraison',
      })

      const customerName = `${input.customer.firstName} ${input.customer.lastName}`
      let emailSent = false
      if (customer.email && flag(settings.customer_order_confirmation, true)) {
        emailSent = await d.mailer.send({
          to: customer.email,
          subject: `Commande ${orderNumber} reçue | ${brand().name}`,
          html: orderConfirmationEmail({
            orderNumber,
            customerName,
            items: lines,
            subtotal: totals.subtotal,
            discount: totals.discount,
            promoCode: applied?.promo.code ?? null,
            deliveryFee: totals.deliveryFee,
            total: totals.total,
            paymentMethod: input.payment_method,
            zone: input.delivery_zone,
            city: input.customer.city,
            address: input.customer.address,
            trackingUrl: trackingUrl(orderNumber),
          }),
        })
      }
      if (d.config.adminEmail && flag(settings.admin_order_notification, true)) {
        void d.mailer.send({
          to: d.config.adminEmail,
          subject: `🛍️ Nouvelle commande ${orderNumber}`,
          html: adminNewOrderEmail({
            orderNumber,
            customerName,
            phone: input.customer.phone,
            total: totals.total,
            itemsCount: totals.itemCount,
            paymentMethod: input.payment_method,
            zone: input.delivery_zone,
            adminUrl: `${d.config.appUrl.replace(/\/$/, '')}/admin/orders`,
          }),
        })
      }

      return {
        success: true,
        order_id: order.id,
        customer_id: customer.id,
        preorder_number: orderNumber,
        payment_method: input.payment_method,
        subtotal_price: totals.subtotal,
        discount_amount: totals.discount,
        delivery_fee: totals.deliveryFee,
        total_price: totals.total,
        due_now: totals.dueNow,
        due_on_delivery: totals.dueOnDelivery,
        promo_code: applied?.promo.code ?? null,
        email_sent: emailSent,
      }
    },

    /** Checkout preview of a promo or referral code on the current basket. */
    async quotePromo(input: { promo_code: string; items: CreateOrderInput['items'] }, account: { userId: string; emailVerified?: boolean; email?: string }) {
      if (!d.promo) throw new ValidationError('Les codes promo ne sont pas disponibles pour le moment.')
      const lines = await buildLines(input.items)
      const subtotal = computeOrderTotals(lines.map((l) => ({ unitPrice: l.product_price, quantity: l.quantity }))).subtotal
      const applied = await d.promo.apply(input.promo_code, subtotal, account)
      return { code: applied.promo.code, kind: applied.promo.kind, value: applied.promo.value, referral: !!applied.referrerId, discount: applied.discount, subtotal, total: subtotal - applied.discount }
    },

    list(query: Parameters<OrderRepository['list']>[0]) {
      return d.orders.list(query)
    },

    async get(id: string) {
      const order = await d.orders.findById(id)
      if (!order) throw new NotFoundError('Commande introuvable')
      return order
    },

    async update(id: string, input: UpdateOrderInput) {
      const order = await d.orders.findById(id)
      if (!order) throw new NotFoundError('Commande introuvable')

      const patch: Partial<Order> & { delivered_at?: string } = {}
      // The payment status is never set by hand: it follows from the money recorded (payments).
      for (const key of ['admin_notes', 'estimated_delivery', 'delivery_address', 'delivery_city'] as const) {
        if (input[key] !== undefined) (patch as Record<string, unknown>)[key] = input[key]
      }
      const statusChanged = !!input.status && input.status !== order.status
      if (input.status) {
        if (!canTransition(order.status, input.status)) {
          throw new ConflictError(`Une commande « ${ORDER_STATUS_LABELS[order.status]} » ne peut plus être modifiée`)
        }
        patch.status = input.status
        // Delivering does not make an order paid: cash collected by the rider is recorded as a payment.
        if (input.status === 'delivered') patch.delivered_at = new Date().toISOString()
        if (input.status === 'returned') patch.returned_at = new Date().toISOString()
      }
      const updated = await d.orders.update(id, patch)

      // Cancelled or returned: the units go back on the shelves (once, whatever happens next).
      if (statusChanged && input.status && STOCK_RELEASING_STATUSES.includes(input.status)) {
        const released = await d.orders.releaseStock(id, input.status === 'returned' ? 'return' : 'cancel')
        if (released) {
          await d.orders.addTracking({ order_id: id, status: input.status, notes: 'Articles remis en stock' })
        }
      }

      if (statusChanged && input.status) {
        await d.orders.addTracking({
          order_id: id,
          status: input.status,
          notes: input.admin_notes || `Statut : ${ORDER_STATUS_LABELS[input.status]}`,
          location: input.location ?? null,
        })
        // The code goes back when the order is cancelled; a referred order rewards its referrer once delivered.
        if (d.promo && (input.status === 'cancelled' || input.status === 'returned' || input.status === 'delivered')) {
          try {
            if (input.status === 'cancelled' || input.status === 'returned') await d.promo.onOrderCancelled(id)
            else await d.promo.onOrderDelivered({ ...order, ...updated, customers: order.customers })
          } catch (err) {
            console.error(JSON.stringify({ level: 'error', msg: 'promo.order_status_hook', order: id, error: String(err) }))
          }
        }
        if (d.reviews && input.status === 'delivered') {
          void d.reviews.inviteAfterDelivery({ ...order, ...updated, customers: order.customers, order_items: order.order_items }).catch((err) =>
            console.error(JSON.stringify({ level: 'error', msg: 'reviews.invite', order: id, error: String(err) })),
          )
        }
        const email = order.customers?.email
        // Every status change is emailed unless the admin explicitly opts out.
        if (input.notify_customer !== false && email) {
          const step = TRACKING_STEPS.find((s) => s.status === input.status)
          await d.mailer.send({
            to: email,
            subject: `Votre commande ${order.preorder_number} : ${ORDER_STATUS_LABELS[input.status]}`,
            html: statusUpdateEmail({
              preorderNumber: order.preorder_number,
              customerName: `${order.customers?.first_name ?? ''} ${order.customers?.last_name ?? ''}`.trim(),
              statusLabel: ORDER_STATUS_LABELS[input.status],
              description: step?.description ?? '',
              trackingUrl: trackingUrl(order.preorder_number),
            }),
          })
        }
      }
      return updated
    },

    async remove(id: string) {
      const order = await d.orders.findById(id)
      if (!order) throw new NotFoundError('Commande introuvable')
      if (order.status === 'delivered' || order.status === 'returned') throw new ConflictError('Impossible de supprimer une commande livrée')
      if ((order.amount_paid ?? 0) > 0) throw new ConflictError('Cette commande a des paiements : annulez-la plutôt que de la supprimer')
      await d.orders.releaseStock(id, 'cancel')
      await d.promo?.onOrderCancelled(id)
      await d.orders.delete(id)
    },

    /**
     * Online orders never paid after a while are cancelled, so their units are sold again.
     * Called by the scheduler; returns how many were cancelled.
     */
    async expireUnpaidOnline(now = new Date()) {
      const before = new Date(now.getTime() - UNPAID_ONLINE_ORDER_TTL_MS).toISOString()
      const stale = await d.orders.listUnpaidOnline(before, 50)
      let cancelled = 0
      for (const order of stale) {
        try {
          await api.update(order.id, { status: 'cancelled', admin_notes: 'Annulée automatiquement : paiement en ligne non reçu', notify_customer: true })
          cancelled++
        } catch (error) {
          console.error(JSON.stringify({ level: 'error', msg: 'orders.expire_failed', order: order.id, error: String(error) }))
        }
      }
      return { cancelled }
    },

    /** Public tracking view — personal data is masked. */
    async track(preorderNumber: string) {
      const number = preorderNumber.trim().toUpperCase()
      if (!isValidOrderNumber(number)) throw new ValidationError('Format de numéro invalide (ex : BS-2026-7KQ4M2XA)')
      const order = await d.orders.findByNumber(number)
      if (!order) throw new NotFoundError('Aucune commande avec ce numéro')

      const productIds = [...new Set((order.order_items ?? []).map((i) => i.product_id).filter((x): x is string => !!x))]
      const products = new Map((await d.products.findManyByIds(productIds)).map((p) => [p.id, p]))

      return {
        preorder_number: order.preorder_number,
        status: order.status,
        payment_status: order.payment_status,
        total_price: order.total_price,
        deposit_amount: order.deposit_amount,
        remaining_amount: order.remaining_amount,
        amount_paid: order.amount_paid ?? 0,
        payment_method: order.payment_method,
        delivery_fee: order.delivery_fee ?? 0,
        delivery_zone: order.delivery_zone ?? null,
        delivery_city: order.delivery_city,
        estimated_delivery: order.estimated_delivery,
        created_at: order.created_at,
        customer: order.customers
          ? { first_name: order.customers.first_name, phone: maskPhone(order.customers.phone) }
          : null,
        items: (order.order_items ?? []).map((i) => {
          const p = i.product_id ? products.get(i.product_id) : undefined
          return {
            product_name: i.product_name,
            product_slug: p?.slug ?? null,
            image: p?.product_media?.find((m) => m.media_type === 'image')?.file_path ?? null,
            size: i.size,
            color: i.color ?? null,
            quantity: i.quantity,
            product_price: i.product_price,
          }
        }),
        timeline: (order.order_tracking ?? []).map((t) => ({
          status: t.status,
          notes: t.notes ?? '',
          location: t.location ?? null,
          created_at: t.created_at,
        })),
      }
    },

    async history(preorderNumber: string) {
      const number = preorderNumber.trim().toUpperCase()
      if (!isValidOrderNumber(number)) throw new ValidationError('Format de numéro invalide')
      const order = await d.orders.findByNumber(number)
      if (!order) throw new NotFoundError('Aucune commande avec ce numéro')
      return d.orders.history(order.id)
    },

    async updateByNumber(preorderNumber: string, input: UpdateOrderInput) {
      const order = await d.orders.findByNumber(preorderNumber.trim().toUpperCase())
      if (!order) throw new NotFoundError('Commande introuvable')
      return api.update(order.id, input)
    },
  }
  return api
}
