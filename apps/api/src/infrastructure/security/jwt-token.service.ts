import { SignJWT, jwtVerify } from 'jose'
import type { SessionUser } from '@trs/shared'
import type { ChallengePurpose, TicketKind, TokenClaims, TokenService } from '@/application/ports'
import { env } from '@/config/env'

const ISSUER = 'the-rising-star-api'
const DEV_FALLBACK_SECRET = 'dev-only-insecure-secret-change-me-please-0123456789'
const TTL = { admin: 60 * 60 * 12, customer: 60 * 60 * 24 * 7 } // seconds
const CHALLENGE_AUDIENCE = 'trs-2fa-challenge'
const CHALLENGE_TTL = 5 * 60

function secretKey(): Uint8Array {
  const secret = env.jwtSecret ?? (env.isProduction ? undefined : DEV_FALLBACK_SECRET)
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_JWT_SECRET must be set (>= 32 characters) to issue session tokens')
  }
  return new TextEncoder().encode(secret)
}

export class JwtTokenService implements TokenService {
  async sign(user: SessionUser, opts: { mfa?: boolean } = {}) {
    const ttl = TTL[user.role]
    const expiresAt = new Date(Date.now() + ttl * 1000)
    const token = await new SignJWT({
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone ?? null,
      mfa: Boolean(opts.mfa),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(secretKey())
    return { token, expiresAt: expiresAt.toISOString() }
  }

  async verify(token: string): Promise<TokenClaims | null> {
    try {
      const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER, algorithms: ['HS256'] })
      // A 2FA challenge token is never a session.
      if (!payload.sub || payload.aud !== undefined) return null
      return {
        id: payload.sub,
        email: String(payload.email ?? ''),
        first_name: String(payload.first_name ?? ''),
        last_name: String(payload.last_name ?? ''),
        phone: (payload.phone as string | null) ?? null,
        role: payload.role === 'admin' ? 'admin' : 'customer',
        issuedAt: typeof payload.iat === 'number' ? payload.iat : 0,
        mfa: payload.mfa === true,
      }
    } catch {
      return null
    }
  }

  async signChallenge(userId: string, purpose: ChallengePurpose) {
    return new SignJWT({ purpose })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setAudience(CHALLENGE_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${CHALLENGE_TTL}s`)
      .sign(secretKey())
  }

  async verifyChallenge(token: string): Promise<{ userId: string; purpose: ChallengePurpose } | null> {
    try {
      const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER, audience: CHALLENGE_AUDIENCE, algorithms: ['HS256'] })
      const purpose: ChallengePurpose | null = payload.purpose === 'setup' || payload.purpose === 'verify' ? payload.purpose : null
      return payload.sub && purpose ? { userId: payload.sub, purpose } : null
    } catch {
      return null
    }
  }

  async signTicket(kind: TicketKind, data: Record<string, unknown>, ttlSeconds: number) {
    return new SignJWT(data)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(ISSUER)
      .setAudience(`trs-${kind}`)
      .setIssuedAt()
      .setExpirationTime(`${ttlSeconds}s`)
      .sign(secretKey())
  }

  async verifyTicket<T extends Record<string, unknown>>(kind: TicketKind, token: string): Promise<T | null> {
    try {
      const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER, audience: `trs-${kind}`, algorithms: ['HS256'] })
      return payload as unknown as T
    } catch {
      return null
    }
  }
}
