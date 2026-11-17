import type { ClientSession, LinkedAccounts, SocialProvider } from '@trs/shared'
import { config } from '../core/config'
import { http } from '../core/http'

let available: Promise<SocialProvider[]> | null = null

/** Sign-in with Google, Facebook and TikTok. */
export const socialService = {
  /** Providers configured on the server (fetched once per page load). */
  providers(): Promise<SocialProvider[]> {
    available ??= http
      .get<{ providers: SocialProvider[] }>('/auth/oauth/providers')
      .then((r) => r.providers)
      .catch(() => {
        available = null
        return []
      })
    return available
  },
  /** Full-page navigation to the provider (through our API, which sets the anti-CSRF cookie). */
  start(provider: SocialProvider, opts: { next?: string; link?: string } = {}) {
    const q = new URLSearchParams()
    if (opts.next) q.set('next', opts.next)
    if (opts.link) q.set('link', opts.link)
    window.location.assign(`${config.apiUrl}/auth/oauth/${provider}/start${q.size ? `?${q}` : ''}`)
  },
  exchange(code: string) {
    return http.post<ClientSession>('/auth/oauth/exchange', { code })
  },
  completeSignup(data: { ticket: string; email: string; firstName: string; lastName: string }) {
    return http.post<ClientSession>('/auth/oauth/signup', data)
  },
  connections() {
    return http.get<LinkedAccounts>('/account/connections')
  },
  async link(provider: SocialProvider) {
    const { ticket } = await http.post<{ ticket: string }>(`/account/connections/${provider}`)
    this.start(provider, { link: ticket })
  },
  unlink(provider: SocialProvider) {
    return http.delete<LinkedAccounts>(`/account/connections/${provider}`)
  },
}
