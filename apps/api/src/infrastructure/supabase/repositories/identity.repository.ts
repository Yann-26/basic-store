import type { SocialProvider } from '@trs/shared'
import type { IdentityRepository, LinkedIdentity } from '@/application/ports'
import { db } from '../client'

export class SupabaseIdentityRepository implements IdentityRepository {
  async findUserId(provider: SocialProvider, providerUserId: string) {
    const { data, error } = await db().from('user_identities').select('user_id').eq('provider', provider).eq('provider_user_id', providerUserId).maybeSingle()
    if (error) throw new Error(`[identities.findUserId] ${error.message}`)
    return (data?.user_id as string | undefined) ?? null
  }

  async listForUser(userId: string): Promise<LinkedIdentity[]> {
    const { data, error } = await db().from('user_identities').select('provider, email, display_name, created_at').eq('user_id', userId)
    if (error) throw new Error(`[identities.listForUser] ${error.message}`)
    return (data ?? []).map((r) => ({ provider: r.provider as SocialProvider, email: r.email ?? null, displayName: r.display_name ?? null, createdAt: r.created_at }))
  }

  async link(data: { userId: string; provider: SocialProvider; providerUserId: string; email: string | null; displayName: string | null }) {
    const { error } = await db().from('user_identities').insert({
      user_id: data.userId,
      provider: data.provider,
      provider_user_id: data.providerUserId,
      email: data.email,
      display_name: data.displayName,
    })
    if (error?.code === '23505') return false // unique violation: already linked
    if (error) throw new Error(`[identities.link] ${error.message}`)
    return true
  }

  async touch(provider: SocialProvider, providerUserId: string) {
    const { error } = await db().from('user_identities').update({ last_used_at: new Date().toISOString() }).eq('provider', provider).eq('provider_user_id', providerUserId)
    if (error) throw new Error(`[identities.touch] ${error.message}`)
  }

  async unlink(userId: string, provider: SocialProvider) {
    const { data, error } = await db().from('user_identities').delete().eq('user_id', userId).eq('provider', provider).select('id')
    if (error) throw new Error(`[identities.unlink] ${error.message}`)
    return (data ?? []).length > 0
  }
}
