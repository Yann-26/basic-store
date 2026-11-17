import { createHmac, hkdfSync } from 'node:crypto'
import type { VisitorHasher } from '@/application/ports'
import { env } from '@/config/env'

let cachedKey: Buffer | null = null

/** Key derived from AUTH_JWT_SECRET: the hash can't be reversed into an IP by anyone without it. */
function key(): Buffer {
  if (cachedKey) return cachedKey
  const material = env.jwtSecret ?? (env.isProduction ? undefined : 'dev-only-insecure-secret-change-me-please-0123456789')
  if (!material || material.length < 32) throw new Error('AUTH_JWT_SECRET must be set to count visitors')
  cachedKey = Buffer.from(hkdfSync('sha256', material, 'the-rising-star', 'site-visitors-v1', 32))
  return cachedKey
}

/**
 * Same visitor on the same day → same id; a new id every day, so visits cannot
 * be linked over time. The IP address itself is never stored.
 */
export const hashVisitor: VisitorHasher = (ip, userAgent, day) =>
  createHmac('sha256', key()).update(`${day}|${ip}|${userAgent}`).digest('base64url').slice(0, 32)
