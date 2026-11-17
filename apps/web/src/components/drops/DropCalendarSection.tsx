import { Link } from 'react-router-dom'
import { HiArrowRight } from 'react-icons/hi2'
import { useSettings } from '../../context/SettingsContext'
import { AddToCalendar, Countdown, RemindForm } from './dropTools'
import { formatDropDate, useDrops } from './useDrops'

/**
 * Home: the next drop with its countdown, "Prévenez-moi" and "Ajouter à mon
 * agenda", then the dates that follow. Hidden while no drop is planned.
 */
export default function DropCalendarSection() {
  const { settings } = useSettings()
  const { upcoming, live, next } = useDrops()
  const open = live[0] ?? null
  if (!next && !open) return null
  const featured = next ?? open!
  const later = upcoming.slice(next ? 1 : 0, 4)

  return (
    <section aria-label="Calendrier des drops" className="relative overflow-hidden border-t border-white/10 py-20 md:py-28">
      <div className="container-custom grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
        <div className="relative aspect-[4/5] overflow-hidden bg-dark-800 lg:aspect-[5/6]">
          {(featured.image_url || featured.products?.[0]?.image) && (
            <img src={featured.image_url || featured.products![0]!.image!} alt="" className="h-full w-full object-cover" loading="lazy" />
          )}
                    <p className="absolute left-6 top-6 bg-[#fff] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#111]">
            {next ? 'Prochain drop' : 'Ouvert maintenant'}
          </p>
        </div>

        <div>
          <p className="eyebrow mb-4">Calendrier des drops</p>
          <h2 className="campaign-title text-4xl md:text-6xl">
            {featured.title}
          </h2>
          <p className="mt-4 text-sm uppercase tracking-[0.25em] text-gray-400">{formatDropDate(featured.starts_at)}</p>
          {featured.location && <p className="mt-1 text-sm text-gray-400">{featured.location}</p>}
          {featured.description && <p className="mt-6 max-w-lg leading-relaxed text-gray-300">{featured.description}</p>}

          {next ? (
            <>
              <Countdown to={next.starts_at} className="mt-10" />
              <div className="mt-10 space-y-5">
                <RemindForm drop={next} />
                <AddToCalendar drop={next} shopName={settings.store_name} />
              </div>
            </>
          ) : (
            <Link to="/drops" className="mt-10 inline-flex min-h-12 items-center rounded-full bg-gold px-8 text-xs font-semibold uppercase tracking-[0.25em] text-primary-black hover:bg-gold-light">
              Découvrir les pièces
            </Link>
          )}

          {later.length > 0 && (
            <ul className="mt-12 divide-y divide-white/10 border-y border-white/10">
              {later.map((d) => (
                <li key={d.id} className="flex items-baseline justify-between gap-6 py-4">
                  <span className="font-display text-xl">{d.title}</span>
                  <span className="whitespace-nowrap text-xs uppercase tracking-[0.2em] text-gray-400">{formatDropDate(d.starts_at, false)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/drops" className="mt-8 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-gold hover:opacity-70">
            Tout le calendrier <HiArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
