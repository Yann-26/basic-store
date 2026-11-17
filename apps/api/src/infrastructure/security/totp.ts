import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import type { TwoFactorCrypto } from '@/application/ports'
import { env } from '@/config/env'
import { brand } from '@/application/brand'

/**
 * Time-based one-time passwords (RFC 6238 / RFC 4226) — what Google
 * Authenticator, Authy, 1Password… generate: HMAC-SHA1, 6 digits, 30 s steps.
 */
const STEP_SECONDS = 30
const DIGITS = 6
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[\s=-]/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const char of clean) {
    const index = B32.indexOf(char)
    if (index < 0) throw new Error('Invalid base32 secret')
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

/** RFC 4226 HOTP value for a counter. */
export function hotp(key: Buffer, counter: number, digits = DIGITS, algorithm: 'sha1' | 'sha256' | 'sha512' = 'sha1'): string {
  const message = Buffer.alloc(8)
  message.writeBigUInt64BE(BigInt(counter))
  const hmac = createHmac(algorithm, key).update(message).digest()
  const offset = hmac[hmac.length - 1]! & 0x0f
  const binary = ((hmac[offset]! & 0x7f) << 24) | (hmac[offset + 1]! << 16) | (hmac[offset + 2]! << 8) | hmac[offset + 3]!
  return String(binary % 10 ** digits).padStart(digits, '0')
}

export const counterAt = (unixSeconds: number) => Math.floor(unixSeconds / STEP_SECONDS)

/**
 * Checks a 6-digit code against the current time step and its neighbours
 * (±1 step for clock drift). Returns the matching step, or null. Steps at or
 * before `lastCounter` are refused so an intercepted code can't be replayed.
 */
export function verifyTotp(secretB32: string, code: string, lastCounter = 0, nowSeconds = Date.now() / 1000): number | null {
  const digits = code.replace(/\s/g, '')
  if (!/^\d{6}$/.test(digits)) return null
  const key = base32Decode(secretB32)
  const current = counterAt(nowSeconds)
  for (const counter of [current - 1, current, current + 1]) {
    if (counter <= lastCounter) continue
    const expected = Buffer.from(hotp(key, counter))
    if (timingSafeEqual(expected, Buffer.from(digits))) return counter
  }
  return null
}

// ------------------------------------------------------------ secret sealing
/** AES-256-GCM key for TOTP secrets: TOTP_ENCRYPTION_KEY if set, else derived from AUTH_JWT_SECRET. */
function sealingKey(): Buffer {
  const material = process.env.TOTP_ENCRYPTION_KEY?.trim() || env.jwtSecret || (env.isProduction ? undefined : 'dev-only-insecure-secret-change-me-please-0123456789')
  if (!material || material.length < 32) throw new Error('AUTH_JWT_SECRET (or TOTP_ENCRYPTION_KEY) must be set to protect 2FA secrets')
  return Buffer.from(hkdfSync('sha256', material, 'the-rising-star', 'totp-secret-v1', 32))
}

export function seal(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', sealingKey(), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.')
}

export function open(sealed: string): string {
  const [version, iv, tag, data] = sealed.split('.')
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unsupported sealed secret')
  const decipher = createDecipheriv('aes-256-gcm', sealingKey(), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8')
}

// ------------------------------------------------------------ recovery codes
/** "7kq2-m9xp" style codes (no ambiguous characters), shown once to the admin. */
function recoveryCode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  // randomInt is uniform: a byte modulo 31 would favour the first characters.
  const chars = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)])
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`
}

export const normalizeRecoveryCode = (code: string) => code.toLowerCase().replace(/[^a-z0-9]/g, '')
export const hashRecoveryCode = (code: string) => createHash('sha256').update(`trs-recovery:${normalizeRecoveryCode(code)}`).digest('hex')

export class TotpTwoFactorCrypto implements TwoFactorCrypto {
  newSecret() {
    return base32Encode(randomBytes(20))
  }

  otpauthUrl(account: string, secret: string) {
    const label = encodeURIComponent(`${brand().name}:${account}`)
    const params = new URLSearchParams({ secret, issuer: brand().name, algorithm: 'SHA1', digits: String(DIGITS), period: String(STEP_SECONDS) })
    return `otpauth://totp/${label}?${params}`
  }

  verify(secret: string, code: string, lastCounter: number) {
    return verifyTotp(secret, code, lastCounter)
  }

  seal(secret: string) {
    return seal(secret)
  }

  open(sealed: string) {
    return open(sealed)
  }

  newRecoveryCodes(count = 8) {
    return Array.from({ length: count }, recoveryCode)
  }

  hashRecoveryCode(code: string) {
    return hashRecoveryCode(code)
  }
}
