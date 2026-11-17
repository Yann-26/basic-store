import { useEffect } from 'react'
import { preloadRecaptcha } from '../core/recaptcha'

/** Call in any component rendering a protected form. */
export function useRecaptchaPreload(): void {
  useEffect(() => {
    preloadRecaptcha()
  }, [])
}
