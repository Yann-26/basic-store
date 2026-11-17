import { RECAPTCHA_ACTIONS, type AdminLoginResult, type ClientSession, type SessionUser, type TwoFactorStatus, type TwoFactorVerifyResult } from '@trs/shared'
import { http, request } from '../core/http'

export const authService = {
  login(email: string, password: string) {
    return http.post<ClientSession>('/auth/login', { email, password }, RECAPTCHA_ACTIONS.login)
  },
  adminLogin(email: string, password: string) {
    return http.post<AdminLoginResult>('/auth/admin/login', { email, password }, RECAPTCHA_ACTIONS.adminLogin)
  },
  /** Step 2 of the admin sign-in: authenticator code (or recovery code). */
  verifyAdminTwoFactor(challenge: string, code: string) {
    return http.post<ClientSession<TwoFactorVerifyResult>>('/auth/admin/2fa', { challenge, code })
  },
  twoFactorStatus() {
    return http.get<TwoFactorStatus>('/auth/2fa')
  },
  regenerateRecoveryCodes(code: string) {
    return http.post<{ recoveryCodes: string[] }>('/auth/2fa/recovery-codes', { code })
  },
  register(data: { email: string; password: string; firstName: string; lastName: string; phone?: string; marketingOptIn?: boolean }) {
    return http.post<ClientSession>('/auth/register', data, RECAPTCHA_ACTIONS.register)
  },
  changePassword(currentPassword: string, newPassword: string) {
    return http.post<ClientSession>('/auth/password', { currentPassword, newPassword })
  },
  forgotPassword(email: string) {
    return http.post<{ success: boolean }>('/auth/password/forgot', { email }, RECAPTCHA_ACTIONS.forgotPassword)
  },
  resetPassword(token: string, password: string) {
    return http.post<{ success: boolean }>('/auth/password/reset', { token, password })
  },
  verifyEmail(token: string) {
    return http.post<{ success: boolean }>('/auth/verify-email', { token })
  },
  resendVerification() {
    return http.post<{ sent?: boolean; alreadyVerified?: boolean }>('/auth/verify-email/resend')
  },
  /** Exchanges a token stored by the previous version (localStorage) for the session cookie. */
  upgradeLegacySession(token: string) {
    return request<ClientSession>('/auth/session', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
  },
  logout() {
    return http.post<void>('/auth/logout')
  },
  me() {
    return http.get<{ user: SessionUser }>('/auth/me')
  },
}
