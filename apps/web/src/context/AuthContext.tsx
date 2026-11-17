import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import type { AdminLoginResult, ClientSession, SessionUser, TwoFactorVerifyResult } from '@trs/shared'
import { ApiError, configureAuth, errorMessage } from '../core/http'
import { purgeLegacyKeys, readJSON, removeKey, writeJSON } from '../core/storage'
import { authService } from '../services/authService'

/** The session token is an HttpOnly cookie; the app only keeps who is signed in and until when. */
type Session = ClientSession

interface RegisterInput {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
  marketingOptIn?: boolean
}

interface AuthContextType {
  user: SessionUser | null
  loading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<SessionUser | null>
  /** Admin step 1 (password): returns the 2FA challenge — no session yet. Throws on failure. */
  adminLogin: (email: string, password: string) => Promise<AdminLoginResult>
  /** Admin step 2 (authenticator or recovery code): opens the admin session. Throws on failure. */
  completeAdminTwoFactor: (challenge: string, code: string) => Promise<ClientSession<TwoFactorVerifyResult>>
  register: (data: RegisterInput) => Promise<SessionUser | null>
  logout: (silent?: boolean) => void
  /** Changes the password; other sessions are logged out, this one is renewed. Throws on failure. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  /** Stores a session returned by the API (e.g. after a profile update). */
  applySession: (res: ClientSession) => void
  /** Reloads the current user from the API (e.g. after confirming the email). */
  refreshUser: () => Promise<void>
}

/** Non-sensitive hint (expiry date only) telling whether a session cookie is worth checking on start-up. */
const HINT_KEY = 'auth_hint'
/** Written by the previous version: `{ user, token, expiresAt }` — upgraded to the cookie once, then deleted. */
const LEGACY_SESSION_KEY = 'session'
const AuthContext = createContext<AuthContextType | null>(null)

const alive = (expiresAt?: string | null) => !!expiresAt && new Date(expiresAt).getTime() > Date.now()

// Module-level mirror read by the HTTP client to tell an expired session from an anonymous visit.
let signedIn = false

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const persist = useCallback((next: Session | null) => {
    signedIn = !!next
    if (next) writeJSON(HINT_KEY, { expiresAt: next.expiresAt })
    else removeKey(HINT_KEY)
    setSession(next)
  }, [])

  const logout = useCallback(
    (silent = false) => {
      if (signedIn) authService.logout().catch(() => undefined)
      persist(null)
      if (!silent) toast.success('À bientôt !')
    },
    [persist],
  )

  useEffect(() => {
    purgeLegacyKeys()
    configureAuth(
      () => signedIn,
      () => {
        persist(null)
        toast.error('Votre session a expiré, veuillez vous reconnecter.')
      },
    )
    let cancelled = false
    const restore = async () => {
      // 1. A browser signed in before the cookie migration: swap its stored token for the cookie.
      const legacy = readJSON<{ token?: string; expiresAt?: string } | null>(LEGACY_SESSION_KEY, null)
      if (legacy?.token && alive(legacy.expiresAt)) {
        try {
          const upgraded = await authService.upgradeLegacySession(legacy.token)
          removeKey(LEGACY_SESSION_KEY)
          return upgraded
        } catch (error) {
          // Keep the old token for the next visit if the API was only unreachable.
          if (error instanceof ApiError && error.status !== 0) removeKey(LEGACY_SESSION_KEY)
          return null
        }
      }
      removeKey(LEGACY_SESSION_KEY)
      // 2. The usual case: ask the API who the cookie belongs to.
      const hint = readJSON<{ expiresAt?: string } | null>(HINT_KEY, null)
      if (!alive(hint?.expiresAt)) return null
      try {
        const { user } = await authService.me()
        return { user, expiresAt: hint!.expiresAt! }
      } catch {
        return null
      }
    }
    restore()
      .then((restored) => {
        if (!cancelled) persist(restored)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [persist])

  // Auto-logout when the session expires while the tab stays open.
  useEffect(() => {
    if (!session) return
    const ms = new Date(session.expiresAt).getTime() - Date.now()
    const timer = window.setTimeout(() => persist(null), Math.max(0, Math.min(ms, 2 ** 31 - 1)))
    return () => window.clearTimeout(timer)
  }, [session, persist])

  const start = useCallback(
    (res: ClientSession) => {
      persist({ user: res.user, expiresAt: res.expiresAt })
      return res.user
    },
    [persist],
  )

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const user = start(await authService.login(email, password))
        toast.success(`Bienvenue ${user.first_name} ✨`)
        return user
      } catch (error) {
        toast.error(errorMessage(error, 'Connexion impossible'))
        return null
      }
    },
    [start],
  )

  const adminLogin = useCallback((email: string, password: string) => authService.adminLogin(email, password), [])

  const completeAdminTwoFactor = useCallback(
    async (challenge: string, code: string) => {
      const res = await authService.verifyAdminTwoFactor(challenge, code)
      start(res)
      return res
    },
    [start],
  )

  const register = useCallback(
    async (data: RegisterInput) => {
      try {
        const user = start(await authService.register(data))
        toast.success('Compte créé avec succès ✨')
        return user
      } catch (error) {
        toast.error(errorMessage(error, "Erreur lors de l'inscription"))
        return null
      }
    },
    [start],
  )

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      start(await authService.changePassword(currentPassword, newPassword))
    },
    [start],
  )

  const refreshUser = useCallback(async () => {
    if (!session) return
    try {
      const { user } = await authService.me()
      persist({ ...session, user })
    } catch {
      /* the 401 handler already logs out */
    }
  }, [persist, session])

  const value = useMemo<AuthContextType>(
    () => ({
      user: session?.user ?? null,
      loading,
      isAuthenticated: !!session,
      isAdmin: session?.user.role === 'admin',
      login,
      adminLogin,
      completeAdminTwoFactor,
      register,
      logout,
      changePassword,
      applySession: start,
      refreshUser,
    }),
    [session, loading, login, adminLogin, completeAdminTwoFactor, register, logout, changePassword, start, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
