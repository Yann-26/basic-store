import {
  resolveDepositPercentage,
  splitPayment,
  MAX_QUANTITY_PER_LINE,
  ORDER_STATUS_LABELS,
  TRACKING_STEPS,
  canTransition,
  computeOrderTotals,
  generateOrderNumber,
  isValidOrderNumber,
  ONE_SIZE,
  preordersClosed,
  dropAccess,
  earlyAccessAt,
  seriesComplete,
  seriesLeft,
  type Customer,
  type Order,
  type OrderItem,
  type OrderStatus,
} from '@trs/shared'
import type { CustomerRepository, Mailer, OrderRepository, ProductRepository, SettingsRepository, DropRepository } from '../ports'
import { ConflictError, EmailNotVerifiedError, NotFoundError, ValidationError } from '@/domain/errors'
import { adminNewOrderEmail, orderConfirmationEmail, statusUpdateEmail } from '../templates/emails'
import { brand } from '../brand'
import { upcomingDrops } from '../drop-gate'
import { dropDate } from './drops'
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
  /** Drops: their pieces cannot be ordered before they open (early access aside). */
  drops?: DropRepository
}

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
  payment_method: string
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

  /**
   * A piece of an upcoming drop is not sold before the drop opens, except during its early access
   * to the people who asked for the drop or subscribed to the newsletter before that access began
   * (checked on the account's confirmed email).
   */
  async function checkDrops(lines: Omit<OrderItem, 'id' | 'order_id'>[], settings: Record<string, unknown>, account?: { email?: string; emailVerified?: boolean }) {
    const { hours, byProduct } = await upcomingDrops(d.drops, settings)
    for (const line of lines) {
      const drop = line.product_id ? byProduct.get(line.product_id) : undefined
      // A drop taking reservations: the deposit is paid now, the date is the release.
      if (!drop || drop.preorders_open !== false) continue
      const access = dropAccess(drop.starts_at, hours)
      if (access === 'open') continue
      const opens = dropDate(drop.starts_at)
      if (access === 'closed') {
        const early = hours > 0 ? ` (${hours} h plus tôt pour les inscrits)` : ''
        throw new ValidationError(`« ${line.product_name} » sort avec ${drop.title} : précommandes le ${opens}${early}.`)
      }
      const listed = account?.email && account.emailVerified !== false ? await d.drops!.hasEarlyAccess(drop.id, account.email, earlyAccessAt(drop.starts_at, hours)) : false
      if (!listed) {
        throw new ValidationError(`« ${line.product_name} » est en accès anticipé, réservé aux inscrits de ${drop.title}. Ouverture à tous le ${opens}.`)
      }
    }
  }

  /** The order lines, priced from the database (never from the client). */
  async function buildLines(items: CreateOrderInput['items']): Promise<Omit<OrderItem, 'id' | 'order_id'>[]> {
    const ids = [...new Set(items.map((i) => i.product_id))]
    const found = new Map((await d.products.findManyByIds(ids)).map((p) => [p.id, p]))

    const lines: Omit<OrderItem, 'id' | 'order_id'>[] = items.map((item) => {
      const product = found.get(item.product_id)
      if (!product || !product.is_active) throw new ValidationError('Un article de votre panier n’est plus disponible')
      if (product.status === 'unavailable') throw new ValidationError(`« ${product.name} » est actuellement indisponible`)
      if (seriesComplete(product)) throw new ValidationError(`« ${product.name} » est épuisé : toutes les pièces de la série ont trouvé preneur`)
      if (preordersClosed(product)) throw new ValidationError(`Les précommandes de « ${product.name} » sont closes`)

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
    // A numbered series cannot sell more pieces than it has left (counted on paid orders).
    const wanted = new Map<string, number>()
    for (const l of lines) if (l.product_id) wanted.set(l.product_id, (wanted.get(l.product_id) ?? 0) + l.quantity)
    for (const [id, qty] of wanted) {
      const product = found.get(id)!
      const left = seriesLeft(product)
      if (left != null && qty > left) {
        throw new ValidationError(`Il ne reste que ${left} pièce${left > 1 ? 's' : ''} de « ${product.name} » dans la série`)
      }
    }
    return lines
  }

  const api = {
    /** Public checkout. Prices always come from the database, never from the client. */
    async create(input: CreateOrderInput, account?: { userId: string; emailVerified?: boolean; email?: string }) {
      if (account && !account.emailVerified) {
        throw new EmailNotVerifiedError('Confirmez votre adresse email pour passer commande. Un lien vous a été envoyé.')
      }
      const settings = await d.settings.getAll().catch(() => ({} as Record<string, unknown>))
      const depositPct = resolveDepositPercentage(settings.deposit_percentage) // deposit now, balance before delivery
      const maxItems = Number(settings.max_items_per_order) || 10
      const deliveryDays = Number(settings.delivery_days_max) || 15

      const totalQty = input.items.reduce((s, i) => s + i.quantity, 0)
      if (totalQty > maxItems) throw new ValidationError(`Maximum ${maxItems} articles par commande`)

      const lines = await buildLines(input.items)
      await checkDrops(lines, settings, account)

      const basket = computeOrderTotals(lines.map((l) => ({ unitPrice: l.product_price, quantity: l.quantity })), depositPct)

      // A promo or referral code: the discount is decided here, from the database.
      let applied: AppliedPromo | null = null
      if (input.promo_code?.trim()) {
        if (!d.promo) throw new ValidationError('Les codes promo ne sont pas disponibles pour le moment.')
        if (!account) throw new ValidationError('Connectez-vous pour utiliser un code.')
        applied = await d.promo.apply(input.promo_code, basket.total, { userId: account.userId, email: account.email, emailVerified: account.emailVerified })
      }
      const discount = applied?.discount ?? 0
      // The deposit is taken on the amount due after the discount; the balance is paid before delivery.
      const totals = { ...basket, total: basket.total - discount, ...splitPayment(basket.total - discount, depositPct) }

      const customer = await findOrCreateCustomer(input.customer, account?.email ?? null)
      const preorderNumber = await uniqueOrderNumber()

      const order = await d.orders.create(
        {
          preorder_number: preorderNumber,
          customer_id: customer.id,
          user_id: account?.userId ?? null,
          status: 'pending',
          total_price: totals.total,
          deposit_amount: totals.deposit,
          deposit_percentage: depositPct,
          remaining_amount: totals.remaining,
          payment_method: input.payment_method,
          // A code that covers the whole basket leaves nothing to pay.
          payment_status: totals.total === 0 ? 'paid' : 'pending',
          subtotal_price: basket.total,
          discount_amount: discount,
          promo_code: applied?.promo.code ?? null,
          referred_by_user_id: applied?.referrerId ?? null,
          delivery_address: input.customer.address,
          delivery_city: input.customer.city,
          customer_notes: input.customer.notes || '',
          estimated_delivery: new Date(Date.now() + deliveryDays * 86_400_000).toISOString().slice(0, 10),
        },
        lines,
      )
      if (applied && d.promo && account) {
        // The use is counted atomically; if another order just took the last one, this order is undone.
        if (!(await d.promo.redeem(applied, order.id, account.userId))) {
          await d.orders.delete(order.id)
          throw new ConflictError('Ce code vient d’atteindre sa limite d’utilisation. Retirez-le pour commander.')
        }
      }
      await d.orders.addTracking({ order_id: order.id, status: 'pending', notes: 'Précommande créée' })

      const customerName = `${input.customer.firstName} ${input.customer.lastName}`
      let emailSent = false
      if (customer.email && flag(settings.customer_order_confirmation, true)) {
        emailSent = await d.mailer.send({
          to: customer.email,
          subject: `Précommande ${preorderNumber} confirmée | ${brand().name}`,
          html: orderConfirmationEmail({
            preorderNumber,
            customerName,
            items: lines,
            total: totals.total,
            deposit: totals.deposit,
            remaining: totals.remaining,
            discount,
            promoCode: applied?.promo.code ?? null,
            city: input.customer.city,
            address: input.customer.address,
            trackingUrl: trackingUrl(preorderNumber),
          }),
        })
      }
      if (d.config.adminEmail && flag(settings.admin_order_notification, true)) {
        void d.mailer.send({
          to: d.config.adminEmail,
          subject: `🛍️ Nouvelle précommande ${preorderNumber}`,
          html: adminNewOrderEmail({
            preorderNumber,
            customerName,
            phone: input.customer.phone,
            total: totals.total,
            itemsCount: totals.itemCount,
            adminUrl: `${d.config.appUrl.replace(/\/$/, '')}/admin/orders`,
          }),
        })
      }

      return {
        success: true,
        order_id: order.id,
        customer_id: customer.id,
        preorder_number: preorderNumber,
        total_price: totals.total,
        deposit_amount: totals.deposit,
        remaining_amount: totals.remaining,
        deposit_percentage: depositPct,
        subtotal_price: basket.total,
        discount_amount: discount,
        promo_code: applied?.promo.code ?? null,
        email_sent: emailSent,
      }
    },

    /** Checkout preview of a promo or referral code on the current basket. */
    async quotePromo(input: { promo_code: string; items: CreateOrderInput['items'] }, account: { userId: string; emailVerified?: boolean; email?: string }) {
      if (!d.promo) throw new ValidationError('Les codes promo ne sont pas disponibles pour le moment.')
      const lines = await buildLines(input.items)
      const basket = computeOrderTotals(lines.map((l) => ({ unitPrice: l.product_price, quantity: l.quantity })))
      const applied = await d.promo.apply(input.promo_code, basket.total, account)
      return { code: applied.promo.code, kind: applied.promo.kind, value: applied.promo.value, referral: !!applied.referrerId, discount: applied.discount, subtotal: basket.total, total: basket.total - applied.discount }
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
        // Delivering does not make an order paid: the balance is recorded when it is received.
        if (input.status === 'delivered') patch.delivered_at = new Date().toISOString()
      }
      const updated = await d.orders.update(id, patch)

      if (statusChanged && input.status) {
        await d.orders.addTracking({
          order_id: id,
          status: input.status,
          notes: input.admin_notes || `Statut : ${ORDER_STATUS_LABELS[input.status]}`,
          location: input.location ?? null,
        })
        // The code goes back when the order is cancelled; a referred order rewards its referrer once delivered.
        if (d.promo && (input.status === 'cancelled' || input.status === 'delivered')) {
          try {
            if (input.status === 'cancelled') await d.promo.onOrderCancelled(id)
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
            subject: `Votre précommande ${order.preorder_number} : ${ORDER_STATUS_LABELS[input.status]}`,
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
      if (order.status === 'delivered') throw new ConflictError('Impossible de supprimer une commande livrée')
      await d.promo?.onOrderCancelled(id)
      await d.orders.delete(id)
    },

    /** Public tracking view — personal data is masked. */
    async track(preorderNumber: string) {
      const number = preorderNumber.trim().toUpperCase()
      if (!isValidOrderNumber(number)) throw new ValidationError('Format de numéro invalide (ex : SC-2026-7KQ4M2XA)')
      const order = await d.orders.findByNumber(number)
      if (!order) throw new NotFoundError('Aucune précommande avec ce numéro')

      const productIds = [...new Set((order.order_items ?? []).map((i) => i.product_id).filter((x): x is string => !!x))]
      const products = new Map((await d.products.findManyByIds(productIds)).map((p) => [p.id, p]))

      return {
        preorder_number: order.preorder_number,
        status: order.status,
        payment_status: order.payment_status,
        total_price: order.total_price,
        deposit_amount: order.deposit_amount,
        remaining_amount: order.remaining_amount,
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
            piece_numbers: i.piece_numbers ?? [],
            series_size: p?.series_size ?? null,
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
      if (!order) throw new NotFoundError('Aucune précommande avec ce numéro')
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
