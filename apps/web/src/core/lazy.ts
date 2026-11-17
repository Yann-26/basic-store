import { lazy, type ComponentType } from 'react'

const RELOAD_KEY = 'trs:chunk-reload-at'
const RELOAD_WINDOW_MS = 10_000

/**
 * After a new deployment, a tab opened earlier still references the previous
 * build's page chunks, which no longer exist. Reload once to pick up the new
 * build instead of crashing; the time guard prevents reload loops.
 */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (Date.now() - last < RELOAD_WINDOW_MS) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}

/** `React.lazy` that recovers from stale chunks by reloading the page once. */
export function lazyPage<P extends object>(factory: () => Promise<{ default: ComponentType<P> }>) {
  return lazy(() =>
    factory().catch((error: unknown) => {
      if (reloadForNewVersion()) return new Promise<never>(() => {}) // page is reloading
      throw error
    }),
  )
}
