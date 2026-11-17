import { describe, expect, it } from 'vitest'
import { paymentProgress } from './orders'

describe('paymentProgress', () => {
  it('reads what was really paid, not the order total', () => {
    expect(paymentProgress({ total_price: 10000, amount_paid: 4000, payment_status: 'deposit_paid' })).toEqual({
      total: 10000,
      paid: 4000,
      outstanding: 6000,
      paidPercent: 40,
      state: 'partial',
    })
  })

  it('is unpaid until money arrives, whatever the status says', () => {
    expect(paymentProgress({ total_price: 10000, amount_paid: 0, payment_status: 'paid' }).state).toBe('unpaid')
    expect(paymentProgress({ total_price: 10000 }).outstanding).toBe(10000)
  })

  it('is fully paid at 100 % and never owes a negative amount', () => {
    expect(paymentProgress({ total_price: 10000, amount_paid: 10000 })).toMatchObject({ outstanding: 0, paidPercent: 100, state: 'paid' })
    expect(paymentProgress({ total_price: 10000, amount_paid: 10500 }).outstanding).toBe(0)
  })

  it('rounds the share down so an almost-paid order never shows 100 %', () => {
    expect(paymentProgress({ total_price: 10000, amount_paid: 9999 })).toMatchObject({ paidPercent: 99, state: 'partial', outstanding: 1 })
  })

  it('shows a refund that left nothing paid', () => {
    expect(paymentProgress({ total_price: 10000, amount_paid: 0, payment_status: 'refunded' }).state).toBe('refunded')
  })
})
