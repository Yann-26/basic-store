import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { useSettings } from '../../context/SettingsContext'

export function StarMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="trs-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F6E27A" />
          <stop offset=".5" stopColor="#D4AF37" />
          <stop offset="1" stopColor="#A8841F" />
        </linearGradient>
      </defs>
      <path fill="url(#trs-gold)" d="M32 3l6.5 22.5L61 32l-22.5 6.5L32 61l-6.5-22.5L3 32l22.5-6.5z" />
    </svg>
  )
}

interface LogoProps {
  to?: string
  size?: 'sm' | 'md' | 'lg'
  tone?: 'light' | 'dark'
  className?: string
  showTagline?: boolean
}

/** The shop's name set in the display serif — or its logo when one is uploaded in the settings. */
export default function Logo({ to = '/', size = 'md', tone = 'light', className, showTagline }: LogoProps) {
  const { settings } = useSettings()
  const name = settings.store_name
  // Smaller on a phone so a long wordmark fits between the menu and the icons.
  const img = { sm: 'h-6', md: 'h-6 sm:h-8', lg: 'h-9 sm:h-11' }[size]
  const text = { sm: 'text-sm', md: 'text-base sm:text-lg', lg: 'text-2xl' }[size]
  return (
    <Link to={to} className={clsx('group inline-flex items-center gap-2.5', className)} aria-label={`${name} — accueil`}>
      {settings.store_logo ? (
        <img src={settings.store_logo} alt="" className={clsx(img, 'w-auto max-w-[60vw] object-contain object-left')} />
      ) : (
        <span className="flex flex-col leading-none">
          <span className={clsx('font-display font-semibold uppercase tracking-[0.3em] whitespace-nowrap', text, tone === 'light' ? 'text-white' : 'text-primary-black')}>
            {name}
          </span>
          {showTagline && settings.store_tagline && (
            <span className="mt-1 text-[9px] uppercase tracking-[0.4em] text-gray-400">{settings.store_tagline}</span>
          )}
        </span>
      )}
    </Link>
  )
}
