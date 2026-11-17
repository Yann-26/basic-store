import { Suspense, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import ErrorBoundary from './ErrorBoundary'
import Spinner from './Spinner'

/** Wraps routed content: keeps the surrounding layout visible while a page loads or fails. */
export default function PageLoader({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <ErrorBoundary resetKey={pathname}>
      <Suspense
        fallback={
          <div className="flex min-h-[60vh] items-center justify-center">
            <Spinner />
          </div>
        }
      >
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}
