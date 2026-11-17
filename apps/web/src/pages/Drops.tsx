import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import clsx from 'clsx'
import { dropState, formatCurrency, type Drop } from '@trs/shared'
import { useSettings } from '../context/SettingsContext'
import Spinner from '../components/ui/Spinner'
import { AddToCalendar, Countdown, RemindForm } from '../components/drops/dropTools'
import { formatDropDate, useDrops } from '../components/drops/useDrops'

const STATE_LABEL = { upcoming: 'À venir', live: 'Ouvert', past: 'Passé' } as const

/** The drop calendar: what opens next, what is open now, and the last month's drops. */
export default function Drops() {
  const { settings } = useSettings()
  const { loading, upcoming, live, past, next } = useDrops()
  const ordered = [...live, ...upcoming, ...past]

  return (
    <>
      <Helmet>
        <title>{`Calendrier des drops | ${settings.store_name}`}</title>
        <meta name="description" content={`Les prochaines sorties ${settings.store_name} : dates, pièces et rappel par email.`} />
      </Helmet>

      <section className="border-b border-white/10 py-16 md:py-24">
        <div className="container-custom">
          <p className="eyebrow mb-4">Calendrier des drops</p>
          <h1 className="campaign-title max-w-3xl text-5xl md:text-7xl">
            Les prochaines sorties de la Maison
          </h1>
          <p className="mt-6 max-w-xl text-gray-400">Des séries courtes, à dates fixes. Laissez votre email pour être prévenu·e à l’ouverture, ou ajoutez la date à votre agenda.</p>
          {next && (
            <div className="mt-12 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="mb-4 text-[10px] uppercase tracking-[0.3em] text-gray-400">{next.title} ouvre dans</p>
                <Countdown to={next.starts_at} />
              </div>
              <AddToCalendar drop={next} shopName={settings.store_name} />
            </div>
          )}
        </div>
      </section>

      <section className="container-custom py-16 md:py-24">
        {loading ? (
          <Spinner />
        ) : ordered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-display text-3xl">Le prochain drop se prépare.</p>
            <p className="mt-3 text-gray-400">
              Inscrivez-vous à la{' '}
              <a href="#newsletter" className="text-gold underline-offset-4 hover:underline">
                newsletter
              </a>{' '}
              pour connaître la date en premier.
            </p>
          </div>
        ) : (
          <ol className="relative space-y-16 border-l border-gold/25 pl-8 md:pl-14">
            {ordered.map((d) => (
              <DropEntry key={d.id} drop={d} shopName={settings.store_name} />
            ))}
          </ol>
        )}
      </section>
    </>
  )
}

function DropEntry({ drop, shopName }: { drop: Drop; shopName: string }) {
  const state = dropState(drop.starts_at)
  // Reservations open: the pieces are shown and priced before the release.
  const hidden = state === 'upcoming' && drop.preorders_open === false
  return (
    <li className={clsx('relative', state === 'past' && 'opacity-60')}>
      <span aria-hidden className={clsx('absolute -left-[2.35rem] top-2 h-3 w-3 rounded-full border md:-left-[3.85rem]', state === 'past' ? 'border-white/30 bg-primary-black' : 'border-gold bg-gold')} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div>
          <p className={clsx('text-[10px] uppercase tracking-[0.3em]', state === 'past' ? 'text-gray-500' : 'text-gold')}>{state === 'upcoming' && !hidden ? 'Précommandes ouvertes' : STATE_LABEL[state]}</p>
          <h2 className="mt-2 font-display text-3xl md:text-4xl">{drop.title}</h2>
          <p className="mt-2 text-sm text-gray-400 first-letter:uppercase">{formatDropDate(drop.starts_at)}</p>
          {drop.location && <p className="text-sm text-gray-400">{drop.location}</p>}
          {drop.description && <p className="mt-4 text-sm leading-relaxed text-gray-300">{drop.description}</p>}
          {state === 'upcoming' && (
            <div className="mt-6 space-y-4">
              <RemindForm drop={drop} />
              <AddToCalendar drop={drop} shopName={shopName} />
            </div>
          )}
        </div>
        {(drop.products?.length ?? 0) > 0 ? (
          <ul className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            {drop.products!.map((p) => (
              <li key={p.id} className="w-44 flex-none">
                <Link to={`/product/${p.slug}`} className="group block">
                  <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-dark-700">
                    {p.image && <img src={p.image} alt="" loading="lazy" className={clsx('h-full w-full object-cover transition-transform duration-700 group-hover:scale-105', hidden && 'blur-[2px] brightness-75')} />}
                  </div>
                  <p className="mt-3 truncate text-sm">{p.name}</p>
                  <p className="text-xs text-gray-500">{hidden ? 'Bientôt' : formatCurrency(p.price)}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          drop.image_url && (
            <div className="aspect-[16/9] overflow-hidden rounded-2xl bg-dark-700">
              <img src={drop.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </div>
          )
        )}
      </div>
    </li>
  )
}
