import { afterEach, describe, expect, it, vi } from 'vitest'
import { FacebookOAuth, GoogleOAuth, TikTokOAuth } from '../providers'

const keys = { clientId: 'id', clientSecret: 'secret' }
const cb = 'https://shop.ci/api/auth/oauth/x/callback'

function mockFetch(routes: Record<string, unknown>) {
  const calls: { url: string; init?: RequestInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      const key = Object.keys(routes).find((k) => url.startsWith(k))
      return new Response(JSON.stringify(key ? routes[key] : { error: 'nope' }), { status: key ? 200 : 400 })
    }),
  )
  return calls
}

afterEach(() => vi.unstubAllGlobals())

describe('OAuth providers', () => {
  it('Google: PKCE authorize URL and verified profile', async () => {
    const url = new URL(new GoogleOAuth(keys).authorizeUrl({ state: 's', codeChallenge: 'c', redirectUri: cb }))
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('scope')).toBe('openid email profile')

    const calls = mockFetch({
      'https://oauth2.googleapis.com/token': { access_token: 'at' },
      'https://openidconnect.googleapis.com/v1/userinfo': { sub: '42', email: 'a@b.ci', email_verified: true, given_name: 'Awa', family_name: 'Koné' },
    })
    const profile = await new GoogleOAuth(keys).fetchProfile({ code: 'code', codeVerifier: 'v', redirectUri: cb })
    expect(profile).toEqual({ providerUserId: '42', email: 'a@b.ci', emailVerified: true, firstName: 'Awa', lastName: 'Koné' })
    expect(String(calls[0]!.init?.body)).toContain('code_verifier=v')
  })

  it('Facebook: signs Graph calls with appsecret_proof', async () => {
    const calls = mockFetch({
      'https://graph.facebook.com/v21.0/oauth/access_token': { access_token: 'at' },
      'https://graph.facebook.com/v21.0/me': { id: '7', name: 'Awa Koné' },
    })
    const profile = await new FacebookOAuth(keys).fetchProfile({ code: 'code', codeVerifier: 'v', redirectUri: cb })
    expect(profile).toEqual({ providerUserId: '7', email: null, emailVerified: false, firstName: 'Awa', lastName: 'Koné' })
    expect(calls[1]!.url).toMatch(/appsecret_proof=[0-9a-f]{64}/)
  })

  it('TikTok: display name, never an email; a refused code throws', async () => {
    mockFetch({
      'https://open.tiktokapis.com/v2/oauth/token/': { access_token: 'at', open_id: 'o-1' },
      'https://open.tiktokapis.com/v2/user/info/': { data: { user: { open_id: 'o-1', display_name: 'awa.style' } }, error: { code: 'ok' } },
    })
    expect(await new TikTokOAuth(keys).fetchProfile({ code: 'c', codeVerifier: 'v', redirectUri: cb })).toEqual({
      providerUserId: 'o-1', email: null, emailVerified: false, firstName: 'awa.style', lastName: '',
    })
    mockFetch({ 'https://open.tiktokapis.com/v2/oauth/token/': { error: 'invalid_grant' } })
    await expect(new TikTokOAuth(keys).fetchProfile({ code: 'c', codeVerifier: 'v', redirectUri: cb })).rejects.toThrow()
  })
})
