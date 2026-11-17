import { describe, expect, it } from 'vitest'
import { parseSender } from '../brevo.mailer'

describe('parseSender', () => {
  it('reads "Name <email>" and bare addresses', () => {
    expect(parseSender('THE RISING STAR <shop@gmail.com>')).toEqual({ name: 'THE RISING STAR', email: 'shop@gmail.com' })
    expect(parseSender('"THE RISING STAR" <shop@gmail.com>')).toEqual({ name: 'THE RISING STAR', email: 'shop@gmail.com' })
    expect(parseSender('shop@gmail.com')).toEqual({ email: 'shop@gmail.com' })
  })
})
