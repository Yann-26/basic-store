import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { SOCIAL_PROVIDER_LABELS, type SocialProvider } from '@trs/shared'
import { socialService } from '../../services/socialService'
import { PROVIDER_STYLE } from './providerStyle'

/** "Continuer avec Google / Facebook / TikTok" — only the providers configured on the server. */
export default function SocialButtons({ next, className }: { next?: string; className?: string }) {
  const [providers, setProviders] = useState<SocialProvider[]>([])
  const [pending, setPending] = useState<SocialProvider | null>(null)

  useEffect(() => {
    let alive = true
    socialService.providers().then((p) => alive && setProviders(p))
    return () => {
      alive = false
    }
  }, [])

  // Coming back with the browser's back button: the page is restored from cache, reset the spinner.
  useEffect(() => {
    const reset = () => setPending(null)
    window.addEventListener('pageshow', reset)
    return () => window.removeEventListener('pageshow', reset)
  }, [])

  if (providers.length === 0) return null

  return (
    <div className={className}>
      <div className="space-y-3">
        {providers.map((p) => {
          const { icon: Icon, className: tone } = PROVIDER_STYLE[p]
          return (
            <button
              key={p}
              type="button"
              disabled={pending !== null}
              onClick={() => {
                setPending(p)
                socialService.start(p, { next })
              }}
              className={clsx(
                'flex h-12 w-full items-center justify-center gap-3 rounded-full text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-70',
                tone,
              )}
            >
              <Icon className="h-5 w-5" />
              {pending === p ? 'Redirection…' : `Continuer avec ${SOCIAL_PROVIDER_LABELS[p]}`}
            </button>
          )
        })}
      </div>
      <div className="my-6 flex items-center gap-4 text-xs uppercase tracking-widest text-gray-500">
        <span className="h-px flex-1 bg-white/10" /> ou avec votre email <span className="h-px flex-1 bg-white/10" />
      </div>
    </div>
  )
}
