import { config } from '../core/config'
import { readJSON, writeJSON } from '../core/storage'

/**
 * Storefront audience beacon (Back-office → Audience): one small request per
 * page, from real browsers only. Nothing personal is sent: a random visit id,
 * a random device key (so phones sharing a carrier IP aren't merged), the page,
 * where the visit came from, and utm tags. Location is resolved server-side.
 */
const SESSION_KEY = 'visit' // sessionStorage
const DEVICE_KEY = 'vk' // localStorage
const EXCLUDE_KEY = 'exclude_me' // localStorage: the shop owner's own devices
const SESSION_IDLE_MS = 30 * 60_000

interface Visit {
  id: string
  lastAt: number
  referrer: string | null
  utm: { source: string | null; medium: string | null; campaign: string | null }
}

function randomId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Back-office toggle: don't count this device's visits. */
export function isExcludedDevice() {
  return readJSON<boolean | null>(EXCLUDE_KEY, null) === true
}
export function setExcludedDevice(excluded: boolean) {
  writeJSON(EXCLUDE_KEY, excluded)
}
/** The owner's devices are excluded by default the first time they open the back-office (they can change it). */
export function excludeDeviceByDefault() {
  if (readJSON<boolean | null>(EXCLUDE_KEY, null) === null) writeJSON(EXCLUDE_KEY, true)
}

function deviceKey(): string {
  let key = readJSON<string | null>(DEVICE_KEY, null)
  if (!key || !/^[a-f0-9]{32}$/.test(key)) {
    key = randomId()
    writeJSON(DEVICE_KEY, key)
  }
  return key
}

/** The current visit, or a new one after 30 minutes of inactivity. Its origin is captured once, on the landing page. */
function currentVisit(now: number): { visit: Visit; landing: boolean } {
  const existing = readJSON<Visit | null>(SESSION_KEY, null, 'session')
  if (existing && now - existing.lastAt < SESSION_IDLE_MS && /^[a-f0-9]{32}$/.test(existing.id)) {
    return { visit: existing, landing: false }
  }
  const params = new URLSearchParams(window.location.search)
  const visit: Visit = {
    id: randomId(),
    lastAt: now,
    referrer: document.referrer || null,
    utm: { source: params.get('utm_source'), medium: params.get('utm_medium'), campaign: params.get('utm_campaign') },
  }
  return { visit, landing: true }
}

export function trackPageView(path: string) {
  try {
    if (isExcludedDevice()) return
    // Browsers asking not to be tracked (Global Privacy Control) are respected.
    if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return
    const now = Date.now()
    const { visit, landing } = currentVisit(now)
    writeJSON(SESSION_KEY, { ...visit, lastAt: now }, 'session')
    void fetch(`${config.apiUrl}/pulse`, {
      method: 'POST',
      keepalive: true,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, referrer: visit.referrer, utm: visit.utm, sessionId: visit.id, visitorKey: deviceKey(), landing }),
    }).catch(() => undefined)
  } catch {
    /* counting visits must never break the shop */
  }
}
