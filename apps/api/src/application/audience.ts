/**
 * Pure helpers that turn a raw page view (referrer, utm tags, user agent) into
 * the categories shown on the Audience page.
 */

const SOURCE_ALIASES: Record<string, string> = {
  whatsapp: 'whatsapp',
  wa: 'whatsapp',
  wsp: 'whatsapp',
  facebook: 'facebook',
  fb: 'facebook',
  messenger: 'facebook',
  instagram: 'instagram',
  ig: 'instagram',
  insta: 'instagram',
  tiktok: 'tiktok',
  tt: 'tiktok',
  snapchat: 'snapchat',
  snap: 'snapchat',
  twitter: 'x',
  x: 'x',
  google: 'google',
  telegram: 'telegram',
  tg: 'telegram',
  newsletter: 'email',
  email: 'email',
  mail: 'email',
}

/** Referrer domains (and their subdomains) → source. */
const REFERRER_SOURCES: [RegExp, string][] = [
  // l.wl.co is WhatsApp's link shim
  [/(^|\.)(whatsapp\.com|whatsapp\.net|wa\.me|l\.wl\.co)$/, 'whatsapp'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, 'facebook'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(tiktok\.com|tiktokv\.com)$/, 'tiktok'],
  [/(^|\.)snapchat\.com$/, 'snapchat'],
  [/(^|\.)(t\.me|telegram\.org|telegram\.me)$/, 'telegram'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'x'],
  [/(^|\.)(mail\.google\.com|outlook\.live\.com|mail\.yahoo\.com)$/, 'email'],
  [/(^|\.)google\.[a-z.]+$/, 'google'],
  [/(^|\.)(bing\.com|yahoo\.com|duckduckgo\.com|ecosia\.org|qwant\.com)$/, 'search'],
]

/**
 * Android apps that open a link in the phone's browser announce themselves as
 * the referrer "android-app://<package>/" — how WhatsApp clicks are recognised
 * without any special link.
 */
const ANDROID_APPS: Record<string, string> = {
  'com.whatsapp': 'whatsapp',
  'com.whatsapp.w4b': 'whatsapp',
  'com.facebook.katana': 'facebook',
  'com.facebook.lite': 'facebook',
  'com.facebook.orca': 'facebook',
  'com.facebook.mlite': 'facebook',
  'com.instagram.android': 'instagram',
  'com.instagram.lite': 'instagram',
  'com.zhiliaoapp.musically': 'tiktok',
  'com.ss.android.ugc.trill': 'tiktok',
  'com.zhiliaoapp.musically.go': 'tiktok',
  'com.snapchat.android': 'snapchat',
  'org.telegram.messenger': 'telegram',
  'org.thunderdog.challegram': 'telegram',
  'com.twitter.android': 'x',
  'com.google.android.gm': 'email',
  'com.google.android.googlequicksearchbox': 'google',
}

/** In-app browsers identify themselves in the user agent: the most reliable signal of where the link was opened. */
const IN_APP_SOURCES: [RegExp, string][] = [
  [/Instagram/i, 'instagram'],
  [/FBAN|FBAV|FB_IAB|FBIOS|\[FB/i, 'facebook'],
  [/musical_ly|BytedanceWebview|TikTok|trill_/i, 'tiktok'],
  [/Snapchat/i, 'snapchat'],
  [/Telegram/i, 'telegram'],
  [/\bGSA\//, 'google'],
]

const BOTS =
  /bot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|WhatsApp\/|TelegramBot|Twitterbot|LinkedInBot|Discordbot|Slackbot|SkypeUriPreview|preview|HeadlessChrome|Lighthouse|PageSpeed|GTmetrix|curl|wget|python|axios|node-fetch|Go-http-client|okhttp|Java\//i

export function isBot(userAgent: string | null | undefined): boolean {
  return !userAgent || userAgent.length < 20 || BOTS.test(userAgent)
}

function parseUrl(url: string | null | undefined): URL | null {
  if (!url) return null
  try {
    return new URL(url)
  } catch {
    return null
  }
}

export function hostOf(url: string | null | undefined): string | null {
  return parseUrl(url)?.hostname.toLowerCase().replace(/^www\./, '') || null
}

/** A free-text utm value reduced to a safe, short label. */
function cleanTag(value: string | null | undefined, max: number): string | null {
  const v = (value ?? '').toLowerCase().trim().replace(/[^a-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, max)
  return v || null
}

/**
 * Where a visit came from, with one plain link for every network. Signals, most
 * reliable first:
 *   1. the app the link was opened in (Instagram, Facebook, TikTok… browsers),
 *   2. the referrer: the Android app that opened it (WhatsApp, Telegram, Gmail…)
 *      or the website the visitor came from,
 *   3. a utm_source tag, only when nothing was observed (older tagged links,
 *      iPhone WhatsApp, which sends no signal at all),
 *   4. otherwise "direct".
 * What was observed always beats the tag, so a link copied from one network to
 * another is still credited to the network where it was clicked.
 */
export function classifySource(input: { utmSource?: string | null; referrer?: string | null; userAgent?: string | null; ownHost?: string | null }): {
  source: string
  referrerHost: string | null
} {
  const ref = parseUrl(input.referrer)
  const own = (input.ownHost ?? '').toLowerCase().replace(/^www\./, '')
  const host = ref?.hostname.toLowerCase().replace(/^www\./, '') || null
  const referrerHost = host && host !== own ? host.slice(0, 120) : null

  for (const [pattern, source] of IN_APP_SOURCES) if (pattern.test(input.userAgent ?? '')) return { source, referrerHost }

  if (ref?.protocol === 'android-app:' && referrerHost) {
    return { source: ANDROID_APPS[referrerHost] ?? 'app', referrerHost }
  }
  if (referrerHost) {
    for (const [pattern, source] of REFERRER_SOURCES) if (pattern.test(referrerHost)) return { source, referrerHost }
  }

  const tag = cleanTag(input.utmSource, 40)
  if (tag) return { source: SOURCE_ALIASES[tag] ?? tag, referrerHost }

  return { source: referrerHost ? 'referral' : 'direct', referrerHost }
}

export function deviceOf(userAgent: string): 'mobile' | 'tablet' | 'desktop' {
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(userAgent)) return 'tablet'
  if (/Mobi|iPhone|iPod|Android|BlackBerry|Opera Mini|IEMobile/i.test(userAgent)) return 'mobile'
  return 'desktop'
}

export function browserOf(userAgent: string): string {
  const checks: [RegExp, string][] = [
    [/Instagram/i, 'Instagram'],
    [/FBAN|FBAV|FB_IAB/i, 'Facebook'],
    [/musical_ly|BytedanceWebview|TikTok/i, 'TikTok'],
    [/SamsungBrowser/i, 'Samsung Internet'],
    [/OPR\/|Opera/i, 'Opera'],
    [/Edg\//i, 'Edge'],
    [/Firefox|FxiOS/i, 'Firefox'],
    [/Chrome|CriOS/i, 'Chrome'],
    [/Safari/i, 'Safari'],
  ]
  for (const [pattern, name] of checks) if (pattern.test(userAgent)) return name
  return 'Autre'
}

export const cleanUtm = (value: string | null | undefined, max = 60) => cleanTag(value, max)

/** Only storefront pages are counted (never the back-office), without query strings. */
export function cleanPath(path: string): string | null {
  const p = path.split(/[?#]/)[0] ?? ''
  if (!p.startsWith('/') || p.startsWith('//')) return null
  if (p === '/admin' || p.startsWith('/admin/') || p.startsWith('/api/')) return null
  return p.slice(0, 300)
}
