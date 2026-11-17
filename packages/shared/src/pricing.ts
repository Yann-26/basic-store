import type { CheckoutPaymentMode, DeliveryZone } from './orders'

export const MAX_QUANTITY_PER_LINE = 10

export interface PricedLine {
  unitPrice: number
  quantity: number
}

export interface DeliverySettings {
  /** Fee for a delivery in Abidjan (FCFA). */
  abidjan: number
  /** Fee for a delivery elsewhere in Côte d'Ivoire (FCFA). */
  interior: number
  /** Basket (after discount) from which delivery is free; 0 = never free. */
  freeFrom: number
}

export const DEFAULT_DELIVERY: DeliverySettings = { abidjan: 1500, interior: 3000, freeFrom: 0 }

const amount = (v: unknown, fallback: number) => {
  if (v === undefined || v === null || v === '') return fallback
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

/** The delivery fees set in the back-office (settings table), with defaults. */
export function resolveDeliverySettings(settings: Record<string, unknown>): DeliverySettings {
  return {
    abidjan: amount(settings.delivery_fee_abidjan, DEFAULT_DELIVERY.abidjan),
    interior: amount(settings.delivery_fee_interior, DEFAULT_DELIVERY.interior),
    freeFrom: amount(settings.free_delivery_from, DEFAULT_DELIVERY.freeFrom),
  }
}

/** Delivery fee for a zone and a basket (after discount). Pick-up in the shop is free. */
export function deliveryFee(zone: DeliveryZone, basket: number, delivery: DeliverySettings = DEFAULT_DELIVERY): number {
  if (zone === 'pickup') return 0
  if (delivery.freeFrom > 0 && basket >= delivery.freeFrom) return 0
  return zone === 'interior' ? delivery.interior : delivery.abidjan
}

export interface OrderTotals {
  /** Sum of the lines. */
  subtotal: number
  discount: number
  deliveryFee: number
  /** What the customer pays in all. */
  total: number
  /** Paid online now (everything for an online payment, nothing on delivery). */
  dueNow: number
  /** Paid to the rider or in the shop. */
  dueOnDelivery: number
  itemCount: number
}

/** Single source of truth for order maths (used by the cart UI and by the API). */
export function computeOrderTotals(
  lines: PricedLine[],
  opts: { discount?: number; zone?: DeliveryZone; payment?: CheckoutPaymentMode; delivery?: DeliverySettings } = {},
): OrderTotals {
  let subtotal = 0
  let itemCount = 0
  for (const line of lines) {
    const qty = Math.max(0, Math.floor(line.quantity))
    subtotal += Math.max(0, line.unitPrice) * qty
    itemCount += qty
  }
  const discount = Math.min(subtotal, Math.max(0, Math.round(opts.discount ?? 0)))
  const fee = deliveryFee(opts.zone ?? 'abidjan', subtotal - discount, opts.delivery)
  const total = subtotal - discount + fee
  const online = opts.payment === 'online'
  return { subtotal, discount, deliveryFee: fee, total, dueNow: online ? total : 0, dueOnDelivery: online ? 0 : total, itemCount }
}

/** Percentage discount between a compare-at price and the selling price. */
export function discountPercent(price: number, compareAtPrice?: number | null): number {
  if (!compareAtPrice || compareAtPrice <= price) return 0
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
}
