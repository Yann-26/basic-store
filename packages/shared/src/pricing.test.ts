import { describe, expect, it } from 'vitest'
import { NEXT_ORDER_STATUS, TRACKING_STEPS, type OrderStatus } from './orders'
import { computeOrderTotals, deliveryFee, discountPercent, resolveDeliverySettings } from './pricing'
import { effectiveSizes, normalizeCategory, normalizeSizes } from './catalog'
import { generateOrderNumber, isValidOrderNumber, canTransition } from './orders'
import { slugify } from './format'

describe('pricing', () => {
  it('totals a basket with discount, delivery and payment mode', () => {
    const lines = [{ unitPrice: 10000, quantity: 2 }, { unitPrice: 3333, quantity: 1 }]
    const cod = computeOrderTotals(lines, { discount: 1333, zone: 'abidjan' })
    expect(cod).toEqual({ subtotal: 23333, discount: 1333, deliveryFee: 1500, total: 23500, dueNow: 0, dueOnDelivery: 23500, itemCount: 3 })
    const online = computeOrderTotals(lines, { zone: 'pickup', payment: 'online' })
    expect(online.total).toBe(23333)
    expect(online.dueNow).toBe(23333)
    expect(online.dueOnDelivery).toBe(0)
    expect(computeOrderTotals(lines, { discount: 99999 }).discount).toBe(23333)
  })

  it('charges delivery by zone, free from a threshold', () => {
    const d = resolveDeliverySettings({ delivery_fee_abidjan: '1000', delivery_fee_interior: 2500, free_delivery_from: '50000' })
    expect(deliveryFee('abidjan', 10000, d)).toBe(1000)
    expect(deliveryFee('interior', 10000, d)).toBe(2500)
    expect(deliveryFee('interior', 50000, d)).toBe(0)
    expect(deliveryFee('pickup', 10, d)).toBe(0)
    expect(resolveDeliverySettings({ delivery_fee_abidjan: 'x' }).abidjan).toBe(1500)
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
    expect(n).toBe('BS-2026-7KQ4M2XA')
    expect(isValidOrderNumber(n)).toBe(true)
    expect(isValidOrderNumber('trs-2026-7kq4m2xa')).toBe(true)
    // legacy 4-digit numbers of existing orders stay trackable
    expect(isValidOrderNumber('TRS-20261234')).toBe(true)
    expect(isValidOrderNumber('TRS-2026-7KQ4M2X0')).toBe(false) // 0 is not in the alphabet
    expect(isValidOrderNumber('SC-2026-7KQ4M2XA')).toBe(true)
    expect(isValidOrderNumber('CTL-20260001')).toBe(false)
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
    expect(canTransition('delivered', 'returned')).toBe(true)
    expect(canTransition('pending', 'returned')).toBe(false)
    expect(canTransition('cancelled', 'confirmed')).toBe(false)
    expect(canTransition('returned', 'delivered')).toBe(false)
    expect(canTransition('pending', 'confirmed')).toBe(true)
    expect(canTransition('preparing', 'cancelled')).toBe(true)
  })

  it('slugifies accented names', () => {
    expect(slugify('Robe Élégante Été')).toBe('robe-elegante-ete')
  })

  it('follows the shop order flow', () => {
    let status: OrderStatus = 'pending'
    const path: OrderStatus[] = [status]
    while (NEXT_ORDER_STATUS[status]) {
      status = NEXT_ORDER_STATUS[status]!
      path.push(status)
    }
    expect(path).toEqual(['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'])
    expect(TRACKING_STEPS.map((s) => s.status)).toEqual(path)
  })
})
