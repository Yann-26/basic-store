import { describe, expect, it } from 'vitest'
import { ACTIVE_ORDER_STATUSES, NEXT_ORDER_STATUS, TRACKING_STEPS, trackingStatus, type OrderStatus } from './orders'
import { DEFAULT_DEPOSIT_PERCENTAGE, calculateDeposit, computeOrderTotals, discountPercent, resolveDepositPercentage, splitPayment } from './pricing'
import { effectiveSizes, normalizeCategory, normalizeSizes } from './catalog'
import { generateOrderNumber, isValidOrderNumber, canTransition } from './orders'
import { slugify } from './format'

describe('pricing', () => {
  it('computes deposits per unit and totals', () => {
    expect(calculateDeposit(100000, 35)).toBe(35000)
    const totals = computeOrderTotals([{ unitPrice: 10000, quantity: 2 }, { unitPrice: 3333, quantity: 1 }], 35)
    expect(totals.total).toBe(23333)
    expect(totals.deposit).toBe(7000 + 1167)
    expect(totals.remaining).toBe(totals.total - totals.deposit)
    expect(totals.itemCount).toBe(3)
  })

  it('computes discounts', () => {
    expect(discountPercent(75, 100)).toBe(25)
    expect(discountPercent(100, 90)).toBe(0)
    expect(discountPercent(100, null)).toBe(0)
  })
})

describe('catalog', () => {
  it('maps legacy sneaker categories to shoes', () => {
    expect(normalizeCategory('Basketball')).toBe('shoes')
    expect(normalizeCategory('lifestyle')).toBe('shoes')
    expect(normalizeCategory('clothing')).toBe('clothing')
    expect(normalizeCategory('Sac à main')).toBe('bags')
  })

  it('normalises sizes to strings', () => {
    expect(normalizeSizes([42, ' m ', '', null])).toEqual(['42', 'M'])
    expect(effectiveSizes([])).toEqual(['TU'])
  })
})

describe('orders', () => {
  it('generates and validates order numbers (including legacy prefix)', () => {
    const n = generateOrderNumber(new Date('2026-01-01'), () => '7KQ4M2XA')
    expect(n).toBe('SC-2026-7KQ4M2XA')
    expect(isValidOrderNumber(n)).toBe(true)
    expect(isValidOrderNumber('trs-2026-7kq4m2xa')).toBe(true)
    // legacy 4-digit numbers of existing orders stay trackable
    expect(isValidOrderNumber('TRS-20261234')).toBe(true)
    expect(isValidOrderNumber('TRS-2026-7KQ4M2X0')).toBe(false) // 0 is not in the alphabet
    expect(isValidOrderNumber('CTL-20260001')).toBe(true)
    expect(isValidOrderNumber('XYZ-1')).toBe(false)
  })

  it('generates unpredictable, well-formed order numbers', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 2000; i++) {
      const n = generateOrderNumber(new Date('2026-06-01'))
      expect(isValidOrderNumber(n)).toBe(true)
      seen.add(n)
    }
    expect(seen.size).toBe(2000)
  })

  it('blocks transitions out of terminal states', () => {
    expect(canTransition('delivered', 'pending')).toBe(false)
    expect(canTransition('pending', 'confirmed')).toBe(true)
  })

  it('slugifies accented names', () => {
    expect(slugify('Robe Élégante Été')).toBe('robe-elegante-ete')
  })

  it('splits a pre-order into a deposit and a balance', () => {
    const totals = computeOrderTotals([{ unitPrice: 15000, quantity: 2 }, { unitPrice: 18000, quantity: 1 }], 60)
    expect(totals).toMatchObject({ total: 48000, deposit: 28800, remaining: 19200, itemCount: 3 })
    expect(splitPayment(45000, 60)).toEqual({ deposit: 27000, remaining: 18000 })
    expect(splitPayment(0, 60)).toEqual({ deposit: 0, remaining: 0 })
  })

  it('reads the deposit percentage set in the back-office', () => {
    expect(resolveDepositPercentage('60')).toBe(60)
    expect(resolveDepositPercentage(150)).toBe(100)
    expect(resolveDepositPercentage('')).toBe(DEFAULT_DEPOSIT_PERCENTAGE)
    expect(resolveDepositPercentage(-5)).toBe(DEFAULT_DEPOSIT_PERCENTAGE)
  })

  it('follows the own-brand order flow, and still places old supplier steps', () => {
    let status: OrderStatus = 'pending'
    const path: OrderStatus[] = [status]
    while (NEXT_ORDER_STATUS[status]) {
      status = NEXT_ORDER_STATUS[status]!
      path.push(status)
    }
    expect(path).toEqual(['pending', 'confirmed', 'sourcing', 'quality_check', 'out_for_delivery', 'delivered'])
    expect(TRACKING_STEPS.map((s) => s.status)).toEqual(path)
    expect(ACTIVE_ORDER_STATUSES).not.toContain('ordered_supplier')
    expect(trackingStatus('shipped_supplier')).toBe('sourcing')
    expect(NEXT_ORDER_STATUS.received_warehouse).toBe('quality_check')
  })
})
