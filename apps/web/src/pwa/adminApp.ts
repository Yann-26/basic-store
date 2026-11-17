import { useEffect, useState } from 'react'

/**
 * The back-office can be installed as a desktop/phone app (PWA) scoped to /admin.
 * The storefront stays a regular website: the manifest is only attached on
 * back-office pages.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

/** Called once at start-up: Chrome/Edge fire `beforeinstallprompt` early, possibly before the admin UI mounts. */
export function captureInstallPrompt() {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault() // we show our own "Installer l'application" button
    deferredPrompt = event as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

function addHeadLink(rel: string, href: string) {
  if (document.head.querySelector(`link[rel="${rel}"][href="${href}"]`)) return
  const link = document.createElement('link')
  link.rel = rel
  link.href = href
  document.head.appendChild(link)
}

let enabled = false

/** Attaches the back-office manifest and registers its service worker (idempotent). */
export function enableAdminApp() {
  if (enabled || typeof window === 'undefined') return
  enabled = true
  addHeadLink('manifest', '/admin.webmanifest')
  addHeadLink('apple-touch-icon', '/app/apple-touch-icon.png')
  // Production only: in development Vite serves modules the worker must not intercept.
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('/admin-sw.js', { scope: '/admin' }).catch(() => undefined)
  }
}

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)

/** Back-office pages: enables the app and exposes the install button state. */
export function useAdminApp() {
  const [, rerender] = useState(0)
  useEffect(() => {
    enableAdminApp()
    const listener = () => rerender((n) => n + 1)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  return {
    /** True when the browser offers installation (Chrome, Edge) and the app is not open as an app already. */
    canInstall: !!deferredPrompt && !isStandalone(),
    installed: isStandalone(),
    async install() {
      const prompt = deferredPrompt
      if (!prompt) return false
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      deferredPrompt = null
      notify()
      return outcome === 'accepted'
    },
  }
}
