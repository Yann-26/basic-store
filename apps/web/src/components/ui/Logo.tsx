import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { useSettings } from '../../context/SettingsContext'

/** The Basic Store roundel: a black disc with the "S" monogram (used when no logo is uploaded). */
export function StarMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <circle cx="32" cy="32" r="31" fill="#0A0A0A" />
      <path
        fill="#FFFFFF"
        d="M41.5 21.5c-2.4-2.6-5.9-4-9.8-4-6.3 0-10.6 3.5-10.6 8.5 0 4.8 3.6 6.8 8.9 8l3.3.8c3 .7 4.2 1.6 4.2 3.2 0 1.9-1.9 3.2-5 3.2-3.2 0-5.8-1.3-7.6-3.6l-4.5 4c2.7 3.3 6.9 5 11.8 5 6.9 0 11.5-3.6 11.5-9 0-4.7-3.1-7-8.9-8.3l-3.3-.7c-2.8-.6-3.9-1.4-3.9-2.9 0-1.7 1.7-2.9 4.4-2.9 2.4 0 4.6.9 6 2.5z"
      />
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
        <span className="flex items-center gap-2.5 leading-none">
          <StarMark className={{ sm: 'h-7 w-7', md: 'h-8 w-8 sm:h-9 sm:w-9', lg: 'h-12 w-12' }[size]} />
          <span className="flex flex-col">
            <span className={clsx('font-sans font-extrabold uppercase tracking-[0.18em] whitespace-nowrap', text, tone === 'light' ? 'text-white' : 'text-primary-black')}>{name}</span>
            {showTagline && settings.store_tagline && <span className="mt-1 text-[9px] uppercase tracking-[0.4em] text-gray-400">{settings.store_tagline}</span>}
          </span>
        </span>
      )}
    </Link>
  )
}
