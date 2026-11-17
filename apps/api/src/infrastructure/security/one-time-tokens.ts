import { createHash, randomBytes } from 'node:crypto'
import type { OneTimeTokens } from '@/application/ports'

/** 256-bit random tokens for email links; the database only ever sees their SHA-256. */
export class RandomOneTimeTokens implements OneTimeTokens {
  issue() {
    const token = randomBytes(32).toString('base64url')
    return { token, hash: this.hash(token) }
  }

  hash(token: string) {
    return createHash('sha256').update(token).digest('hex')
  }
}

/** PKCE pair (RFC 7636, S256) for an OAuth authorization request. */
export function newPkce() {
  const verifier = randomBytes(32).toString('base64url')
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }
}
