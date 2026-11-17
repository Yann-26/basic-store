import type { AuthTokenPurpose, AuthTokenRepository } from '@/application/ports'
import { db } from '../client'

export class SupabaseAuthTokenRepository implements AuthTokenRepository {
  async create(data: { userId: string; purpose: AuthTokenPurpose; tokenHash: string; expiresAt: Date }) {
    const { error } = await db()
      .from('auth_tokens')
      .insert({ user_id: data.userId, purpose: data.purpose, token_hash: data.tokenHash, expires_at: data.expiresAt.toISOString() })
    if (error) throw new Error(`[authTokens.create] ${error.message}`)
  }

  async consume(tokenHash: string, purpose: AuthTokenPurpose) {
    // Single conditional update: a link can't be used twice, even concurrently.
    const { data, error } = await db()
      .from('auth_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token_hash', tokenHash)
      .eq('purpose', purpose)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .select('user_id')
    if (error) throw new Error(`[authTokens.consume] ${error.message}`)
    return (data?.[0]?.user_id as string | undefined) ?? null
  }

  async revokeAll(userId: string, purpose: AuthTokenPurpose) {
    const { error } = await db().from('auth_tokens').update({ used_at: new Date().toISOString() }).eq('user_id', userId).eq('purpose', purpose).is('used_at', null)
    if (error) throw new Error(`[authTokens.revokeAll] ${error.message}`)
  }
}
