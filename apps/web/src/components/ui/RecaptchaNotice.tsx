import { recaptchaEnabled } from '../../core/recaptcha'

/** Required by Google's terms when the reCAPTCHA badge is hidden. */
export default function RecaptchaNotice({ className = '' }: { className?: string }) {
  if (!recaptchaEnabled) return null
  return (
    <p className={`text-[11px] leading-relaxed text-gray-500 ${className}`}>
      Ce formulaire est protégé par reCAPTCHA. Les{' '}
      <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gold">
        règles de confidentialité
      </a>{' '}
      et les{' '}
      <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-gold">
        conditions d'utilisation
      </a>{' '}
      de Google s'appliquent.
    </p>
  )
}
