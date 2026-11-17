import { config } from './config'

/**
 * Google reCAPTCHA v3 (invisible). The script is loaded lazily on first use,
 * so pages without forms don't pay for it.
 */
interface Grecaptcha {
  ready(cb: () => void): void
  execute(siteKey: string, opts: { action: string }): Promise<string>
}

declare global {
  interface Window {
    grecaptcha?: Grecaptcha
  }
}

let loader: Promise<Grecaptcha> | null = null

// www.recaptcha.net is Google's official mirror for networks/browsers that block google.com
const SCRIPT_HOSTS = ['https://www.google.com', 'https://www.recaptcha.net']

function injectScript(host: string): Promise<Grecaptcha> {
  return new Promise<Grecaptcha>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `${host}/recaptcha/api.js?render=${encodeURIComponent(config.recaptchaSiteKey)}`
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.grecaptcha) window.grecaptcha.ready(() => resolve(window.grecaptcha!))
      else reject(new Error('reCAPTCHA unavailable'))
    }
    script.onerror = () => {
      script.remove()
      reject(new Error('reCAPTCHA blocked'))
    }
    document.head.appendChild(script)
  })
}

function load(): Promise<Grecaptcha> {
  if (loader) return loader
  loader = (async () => {
    if (window.grecaptcha) return new Promise<Grecaptcha>((resolve) => window.grecaptcha!.ready(() => resolve(window.grecaptcha!)))
    for (const host of SCRIPT_HOSTS) {
      try {
        return await injectScript(host)
      } catch {
        // try the next host
      }
    }
    loader = null
    throw new Error(
      'Impossible de charger la vérification anti-robot (reCAPTCHA). Désactivez votre bloqueur de publicités pour ce site ou changez de réseau, puis réessayez.',
    )
  })()
  return loader
}

export const recaptchaEnabled = Boolean(config.recaptchaSiteKey)

/** Preloads the script (e.g. when a form mounts) to make submission instant. */
export function preloadRecaptcha(): void {
  if (recaptchaEnabled) load().catch(() => undefined)
}

/** Returns a fresh token for the given action, or null when captcha is disabled. */
export async function getRecaptchaToken(action: string): Promise<string | null> {
  if (!recaptchaEnabled) return null
  const grecaptcha = await load()
  return grecaptcha.execute(config.recaptchaSiteKey, { action })
}
