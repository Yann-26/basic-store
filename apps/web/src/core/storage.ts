/**
 * Safe wrappers around Web Storage: private mode, quota errors and
 * corrupted JSON must never crash the app.
 */
const PREFIX = 'trs_'

function store(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export function readJSON<T>(key: string, fallback: T, kind: 'local' | 'session' = 'local'): T {
  try {
    const raw = store(kind)?.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeJSON(key: string, value: unknown, kind: 'local' | 'session' = 'local'): void {
  try {
    store(kind)?.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* storage full or unavailable */
  }
}

export function removeKey(key: string, kind: 'local' | 'session' = 'local'): void {
  try {
    store(kind)?.removeItem(PREFIX + key)
  } catch {
    /* ignore */
  }
}

/** One-time cleanup of keys written by the previous (COURTLAB) version. */
export function purgeLegacyKeys(): void {
  try {
    for (const key of ['courtlab_user', 'courtlab_admin', 'courtlab_preorder', 'courtlab_preorders']) {
      window.localStorage.removeItem(key)
    }
  } catch {
    /* ignore */
  }
}
