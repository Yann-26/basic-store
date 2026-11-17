import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Spinner from '../ui/Spinner'

/**
 * Customer-area guard: sends visitors to the login page and brings them back
 * afterwards. The API independently requires a session on the guarded calls.
 */
export default function RequireAuth({ children, reason }: { children: ReactNode; reason?: string }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search, reason }} />
  }
  return <>{children}</>
}

/** Where to go after login/registration: only same-site paths (no open redirect). */
// eslint-disable-next-line react-refresh/only-export-components
export function safeRedirect(from: unknown, fallback = '/'): string {
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : fallback
}
