import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto'
import type { UnsubscribeTokens } from '@/application/ports'
import { env } from '@/config/env'

/** Key derived from AUTH_JWT_SECRET: unsubscribe links can't be forged for another address. */
function key(): Buffer {
  const material = env.jwtSecret ?? (env.isProduction ? undefined : 'dev-only-insecure-secret-change-me-please-0123456789')
  if (!material || material.length < 32) throw new Error('AUTH_JWT_SECRET must be set to sign unsubscribe links')
  return Buffer.from(hkdfSync('sha256', material, 'the-rising-star', 'newsletter-unsubscribe-v1', 32))
}

const mac = (email: string) => createHmac('sha256', key()).update(email.trim().toLowerCase()).digest('base64url')

/** Stateless HMAC tokens for one-click unsubscribe links (no expiry: links in old emails keep working). */
export class HmacUnsubscribeTokens implements UnsubscribeTokens {
  sign(email: string) {
    return mac(email)
  }

  verify(email: string, token: string) {
    const expected = Buffer.from(mac(email))
    const given = Buffer.from(token)
    return expected.length === given.length && timingSafeEqual(expected, given)
  }
}
