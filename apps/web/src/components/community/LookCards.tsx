import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { FaInstagram } from 'react-icons/fa'
import type { CommunityLook } from '../../services/engagementService'
import { useInstagramProfile } from './useInstagramProfile'

const firstName = (look: CommunityLook) => (look.customer_name || '').trim().split(/\s+/)[0] || 'Client·e'

/** Instagram-style story rings: one per customer, each opening Instagram. */
export function LookStories({ looks }: { looks: CommunityLook[] }) {
  const { linkFor } = useInstagramProfile()
  return (
    <div className="-mx-4 mb-12 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:px-0">
      <ul className="flex w-max gap-5 md:mx-auto md:gap-7">
        {looks.map((look) => (
          <li key={look.id}>
            <a href={linkFor(look)} target="_blank" rel="noopener noreferrer" className="group flex w-20 flex-col items-center gap-2 md:w-24" aria-label={`${firstName(look)} sur Instagram`}>
              <span className="rounded-full bg-[conic-gradient(from_210deg,#F6E27A,#D4AF37,#A8841F,#F6E27A)] p-[3px] transition-transform duration-500 group-hover:scale-105">
                <span className="block rounded-full bg-primary-black p-[3px]">
                  <img src={look.image_url ?? ''} alt="" loading="lazy" className="h-16 w-16 rounded-full object-cover md:h-20 md:w-20" />
                </span>
              </span>
              <span className="w-full truncate text-center text-xs text-gray-300 group-hover:text-gold">{firstName(look)}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function LookGrid({ looks }: { looks: CommunityLook[] }) {
  const { linkFor } = useInstagramProfile()
  return (
    // Masonry: every photo keeps its own proportions and is shown whole (no cropping), on phone and desktop.
    <div className={clsx('gap-3 md:gap-4', looks.length < 2 ? 'columns-1' : 'columns-2', looks.length >= 3 && 'md:columns-3')}>
      {looks.map((look, i) => {
        const big = i === 0
        const name = look.customer_name?.trim() || 'Client·e'
        return (
          <article
            key={look.id}
            className="group relative mb-3 break-inside-avoid overflow-hidden rounded-3xl border border-white/10 bg-dark-700 transition-colors hover:border-gold/70 md:mb-4"
          >
            {look.image_url ? (
              <img src={look.image_url} alt={`Look de ${name}`} loading="lazy" className="block h-auto w-full transition-transform duration-[1.2s] ease-out group-hover:scale-105" />
            ) : (
              <div className="aspect-[4/5]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

            {/* The whole card opens Instagram; piece chips sit above this link. */}
            <a href={linkFor(look)} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-10" aria-label={`Voir le look de ${name} sur Instagram`} />

            <span className="pointer-events-none absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition-colors group-hover:bg-gold group-hover:text-primary-black">
              <FaInstagram className="h-4 w-4" />
            </span>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-4 md:p-5">
              {look.quote && (
                <p className={clsx('mb-3 font-display italic leading-snug text-white/90', big ? 'text-lg md:text-2xl' : 'hidden text-sm md:line-clamp-2 md:max-h-0 md:opacity-0 md:transition-all md:duration-500 md:group-hover:max-h-24 md:group-hover:opacity-100')}>
                  « {look.quote} »
                </p>
              )}
              <p className={clsx('truncate font-semibold text-white', big ? 'text-xl md:text-2xl' : 'text-sm md:text-base')}>{name}</p>
              {look.customer_city && <p className="truncate text-xs text-gray-400">{look.customer_city}</p>}
              {look.customer_handle && <p className="truncate text-xs text-gold">@{look.customer_handle}</p>}
              {look.products.length > 0 && (
                <div className="pointer-events-auto mt-3 flex flex-wrap gap-1.5">
                  {look.products.slice(0, big ? 4 : 1).map((p) => (
                    <Link
                      key={p.id}
                      to={`/product/${p.slug}`}
                      className="flex max-w-full items-center gap-1.5 rounded-full border border-white/20 bg-black/60 py-1 pl-1 pr-3 text-[11px] text-white backdrop-blur transition-colors hover:border-gold hover:text-gold"
                      title={`Porte : ${p.name}`}
                    >
                      {p.image ? <img src={p.image} alt="" className="h-5 w-5 rounded-full object-cover" /> : <span className="h-5 w-5 rounded-full bg-gold/30" />}
                      <span className="truncate">{p.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
