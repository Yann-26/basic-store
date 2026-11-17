import { describe, expect, it } from 'vitest'
import { smtpSender } from '../smtp.mailer'

describe('smtpSender', () => {
  it('keeps the shop name but sends as the Gmail account', () => {
    expect(smtpSender('THE RISING STAR <onboarding@resend.dev>', 'shop@gmail.com')).toBe('THE RISING STAR <shop@gmail.com>')
    expect(smtpSender('"THE RISING STAR" <Shop@gmail.com>', 'shop@gmail.com')).toBe('THE RISING STAR <Shop@gmail.com>')
    expect(smtpSender('shop@gmail.com', 'shop@gmail.com')).toBe('Basic Store <shop@gmail.com>')
  })
})
