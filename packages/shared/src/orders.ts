import { LEGACY_PREFIXES, ORDER_NUMBER_PREFIX } from './brand'

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'sourcing',
  'ordered_supplier',
  'shipped_supplier',
  'received_warehouse',
  'quality_check',
  'out_for_delivery',
  'delivered',
  'cancelled',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  sourcing: 'En fabrication',
  ordered_supplier: 'Commandé fournisseur',
  shipped_supplier: 'Expédié fournisseur',
  received_warehouse: 'Reçu entrepôt',
  quality_check: 'Contrôle qualité',
  out_for_delivery: 'En livraison',
  delivered: 'Livrée',
  cancelled: 'Annulée',
}

/**
 * Steps of the resale model (supplier abroad, warehouse). The shop now makes its
 * own pieces, so they are no longer offered; orders already in one still display.
 */
export const LEGACY_ORDER_STATUSES: readonly OrderStatus[] = ['ordered_supplier', 'shipped_supplier', 'received_warehouse']

/** The statuses an order can be moved to today. */
export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = ORDER_STATUSES.filter((s) => !LEGACY_ORDER_STATUSES.includes(s))

/** Linear happy-path workflow used by the admin "next step" button. */
export const NEXT_ORDER_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'confirmed',
  confirmed: 'sourcing',
  sourcing: 'quality_check',
  ordered_supplier: 'quality_check',
  shipped_supplier: 'quality_check',
  received_warehouse: 'quality_check',
  quality_check: 'out_for_delivery',
  out_for_delivery: 'delivered',
}

export const TRACKING_STEPS: readonly { status: OrderStatus; label: string; description: string }[] = [
  { status: 'pending', label: 'Commande reçue', description: 'Votre commande a été enregistrée avec succès.' },
  { status: 'confirmed', label: 'Confirmée', description: 'Votre acompte a été reçu et la commande est validée.' },
  { status: 'sourcing', label: 'En fabrication', description: 'Votre pièce est en cours de fabrication dans notre atelier à Abidjan.' },
  { status: 'quality_check', label: 'Contrôle qualité', description: 'Nous vérifions les coutures, le marquage et la taille de votre pièce.' },
  { status: 'out_for_delivery', label: 'En cours de livraison', description: 'Votre commande est en route vers votre adresse.' },
  { status: 'delivered', label: 'Livrée', description: 'Votre commande a été livrée. Portez-la avec élégance.' },
]

/** The step of the tracking timeline an order sits on (old supplier steps count as "en fabrication"). */
export function trackingStatus(status: OrderStatus): OrderStatus {
  return LEGACY_ORDER_STATUSES.includes(status) ? 'sourcing' : status
}

export const PAYMENT_STATUSES = ['pending', 'success', 'failed', 'refunded'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value)
}

/** Delivered/cancelled orders are terminal: no further transitions allowed. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true
  if (from === 'delivered' || from === 'cancelled') return false
  return true
}

/**
 * Order numbers are public tracking keys, so they must not be guessable.
 * Current format: SC-2026-7KQ4M2XA (8 random chars, ~8.5e11 combinations per year).
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

/** How a payment reached the shop: Wave link (confirmed by an admin), Paystack (earlier orders), or by hand. */
export const PAYMENT_METHODS = ['wave', 'paystack', 'cash', 'mobile_money', 'bank_transfer', 'other'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]
/** The methods an admin can record for money received outside the website. */
export const MANUAL_PAYMENT_METHODS = ['cash', 'mobile_money', 'bank_transfer', 'other'] as const satisfies readonly PaymentMethod[]
export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  wave: 'Wave',
  paystack: 'En ligne (Paystack)',
  cash: 'Espèces',
  mobile_money: 'Mobile Money (hors site)',
  bank_transfer: 'Virement',
  other: 'Autre',
}

/** deposit = the first payment of an order; balance = any payment after it. */
export const PAYMENT_KINDS = ['deposit', 'balance'] as const
export type PaymentKind = (typeof PAYMENT_KINDS)[number]
export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = { deposit: 'Acompte', balance: 'Solde' }

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
  partial: 'Acompte payé',
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
