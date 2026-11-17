import { LEGACY_PREFIXES, ORDER_NUMBER_PREFIX } from './brand'

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'returned',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Nouvelle',
  confirmed: 'Confirmée',
  preparing: 'En préparation',
  out_for_delivery: 'En livraison',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  returned: 'Retournée',
}

/** The statuses an admin can pick (every one: the flow is short). */
export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = ORDER_STATUSES

/** Linear happy-path workflow used by the admin "next step" button. */
export const NEXT_ORDER_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'out_for_delivery',
  out_for_delivery: 'delivered',
}

/** Statuses whose stock goes back on the shelves. */
export const STOCK_RELEASING_STATUSES: readonly OrderStatus[] = ['cancelled', 'returned']

export const TRACKING_STEPS: readonly { status: OrderStatus; label: string; description: string }[] = [
  { status: 'pending', label: 'Commande reçue', description: 'Votre commande a bien été enregistrée. Nous vous appelons pour la confirmer.' },
  { status: 'confirmed', label: 'Confirmée', description: 'Votre commande est confirmée et vos articles sont réservés.' },
  { status: 'preparing', label: 'En préparation', description: 'Nous préparons et emballons vos articles en boutique.' },
  { status: 'out_for_delivery', label: 'En cours de livraison', description: 'Votre colis est en route. Le livreur vous appelle avant d’arriver.' },
  { status: 'delivered', label: 'Livrée', description: 'Votre commande a été livrée. Merci pour votre confiance !' },
]

/** The step of the tracking timeline an order sits on. */
export function trackingStatus(status: OrderStatus): OrderStatus {
  return status
}

export const PAYMENT_STATUSES = ['pending', 'success', 'failed', 'refunded'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value)
}

/**
 * Cancelled and returned orders are closed for good (their stock went back).
 * A delivered order can only be marked as returned.
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true
  if (from === 'cancelled' || from === 'returned') return false
  if (from === 'delivered') return to === 'returned'
  if (to === 'returned') return false
  return true
}

// ---------------------------------------------------------------- checkout ---

/** How the customer pays: everything online now, or cash / Mobile Money to the rider. */
export const CHECKOUT_PAYMENT_MODES = ['cash_on_delivery', 'online'] as const
export type CheckoutPaymentMode = (typeof CHECKOUT_PAYMENT_MODES)[number]
export const CHECKOUT_PAYMENT_LABELS: Record<CheckoutPaymentMode, string> = {
  cash_on_delivery: 'Paiement à la livraison',
  online: 'Payer en ligne maintenant',
}
export function isCheckoutPaymentMode(value: unknown): value is CheckoutPaymentMode {
  return typeof value === 'string' && (CHECKOUT_PAYMENT_MODES as readonly string[]).includes(value)
}

export const DELIVERY_ZONES = ['abidjan', 'interior', 'pickup'] as const
export type DeliveryZone = (typeof DELIVERY_ZONES)[number]
export const DELIVERY_ZONE_LABELS: Record<DeliveryZone, string> = {
  abidjan: 'Livraison à Abidjan',
  interior: 'Livraison à l’intérieur du pays',
  pickup: 'Retrait en boutique (Angré)',
}
export function isDeliveryZone(value: unknown): value is DeliveryZone {
  return typeof value === 'string' && (DELIVERY_ZONES as readonly string[]).includes(value)
}

/**
 * Order numbers are public tracking keys, so they must not be guessable.
 * Current format: BS-2026-7KQ4M2XA (8 random chars, ~8.5e11 combinations per year).
 * Legacy format TRS-20261234 (4 digits) is still accepted for existing orders.
 */
const ORDER_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ' // no 0/O, 1/I/L
const ORDER_NUMBER_RE = new RegExp(
  `^(${[ORDER_NUMBER_PREFIX, ...LEGACY_PREFIXES].join('|')})-(\\d{8}|\\d{4}-[${ORDER_CODE_ALPHABET}]{8})$`,
)

export function isValidOrderNumber(value: string): boolean {
  return ORDER_NUMBER_RE.test(value.trim().toUpperCase())
}

function secureRandomCode(length: number): string {
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  // 248 = largest multiple of 31 below 256: reject above it to avoid modulo bias
  let out = ''
  for (let i = 0; out.length < length; i++) {
    if (i >= bytes.length) {
      globalThis.crypto.getRandomValues(bytes)
      i = 0
    }
    const byte = bytes[i] ?? 255
    if (byte < 248) out += ORDER_CODE_ALPHABET.charAt(byte % ORDER_CODE_ALPHABET.length)
  }
  return out
}

export function generateOrderNumber(now = new Date(), code: (length: number) => string = secureRandomCode): string {
  return `${ORDER_NUMBER_PREFIX}-${now.getFullYear()}-${code(8)}`
}

// ---------------------------------------------------------------- payments ---

/** How a payment reached the shop: online (Paystack), an older Wave link, or recorded by hand (cash at delivery…). */
export const PAYMENT_METHODS = ['wave', 'paystack', 'cash', 'mobile_money', 'bank_transfer', 'other'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]
/** The methods an admin can record for money received outside the website. */
export const MANUAL_PAYMENT_METHODS = ['cash', 'mobile_money', 'bank_transfer', 'other'] as const satisfies readonly PaymentMethod[]
export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  wave: 'Wave',
  paystack: 'En ligne (Paystack)',
  cash: 'Espèces (livraison / boutique)',
  mobile_money: 'Mobile Money (au livreur)',
  bank_transfer: 'Virement',
  other: 'Autre',
}

/** deposit = the first payment of an order; balance = any payment after it (stored names, kept from earlier). */
export const PAYMENT_KINDS = ['deposit', 'balance'] as const
export type PaymentKind = (typeof PAYMENT_KINDS)[number]
export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = { deposit: 'Paiement', balance: 'Complément' }

/** Where an order stands with money really received. */
export type PaymentProgressState = 'unpaid' | 'partial' | 'paid' | 'refunded'

export interface PaymentProgress {
  total: number
  paid: number
  /** Still to be paid: total minus what was really received, never below 0. */
  outstanding: number
  /** Share of the total really received, 0–100 (rounded down so 99.6 % never shows as 100 %). */
  paidPercent: number
  state: PaymentProgressState
}

export const PAYMENT_PROGRESS_LABELS: Record<PaymentProgressState, string> = {
  unpaid: 'Non payé',
  partial: 'Payé en partie',
  paid: 'Payé 100 %',
  refunded: 'Remboursé',
}

/**
 * Single source of truth for "how much of this order is paid": computed from
 * the money recorded on the order (`amount_paid`), never from its status.
 */
export function paymentProgress(order: { total_price: number; amount_paid?: number | null; payment_status?: string | null }): PaymentProgress {
  const total = Math.max(0, Number(order.total_price) || 0)
  const paid = Math.max(0, Number(order.amount_paid) || 0)
  const outstanding = Math.max(0, total - paid)
  const paidPercent = total > 0 ? Math.min(100, Math.floor((paid / total) * 100)) : 0
  const state: PaymentProgressState =
    order.payment_status === 'refunded' && paid === 0 ? 'refunded' : total > 0 && outstanding === 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid'
  return { total, paid, outstanding, paidPercent: state === 'paid' ? 100 : paidPercent, state }
}
