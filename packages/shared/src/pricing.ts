/** Share of the price paid when the pre-order is placed (the balance is paid before delivery), when the shop has not set its own. */
export const DEFAULT_DEPOSIT_PERCENTAGE = 35
export const MAX_QUANTITY_PER_LINE = 10

export function calculateDeposit(price: number, depositPercentage = DEFAULT_DEPOSIT_PERCENTAGE): number {
  const pct = Math.min(100, Math.max(0, depositPercentage))
  return Math.round((price * pct) / 100)
}

/** The deposit percentage set in the back-office (1–100), or the default when it is missing or invalid. */
export function resolveDepositPercentage(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.min(100, Math.round(n)) : DEFAULT_DEPOSIT_PERCENTAGE
}

/** Splits an amount due into the deposit paid now and the balance paid later. */
export function splitPayment(total: number, depositPercentage = DEFAULT_DEPOSIT_PERCENTAGE): { deposit: number; remaining: number } {
  const deposit = calculateDeposit(Math.max(0, total), depositPercentage)
  return { deposit, remaining: Math.max(0, total) - deposit }
}

export interface PricedLine {
  unitPrice: number
  quantity: number
}

export interface OrderTotals {
  total: number
  deposit: number
  remaining: number
  itemCount: number
}

/** Single source of truth for order maths (used by cart UI and by the API). */
export function computeOrderTotals(lines: PricedLine[], depositPercentage = DEFAULT_DEPOSIT_PERCENTAGE): OrderTotals {
  let total = 0
  let deposit = 0
  let itemCount = 0
  for (const line of lines) {
    const qty = Math.max(0, Math.floor(line.quantity))
    total += line.unitPrice * qty
    deposit += calculateDeposit(line.unitPrice, depositPercentage) * qty
    itemCount += qty
  }
  return { total, deposit, remaining: total - deposit, itemCount }
}

/** Percentage discount between a compare-at price and the selling price. */
export function discountPercent(price: number, compareAtPrice?: number | null): number {
  if (!compareAtPrice || compareAtPrice <= price) return 0
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
}
