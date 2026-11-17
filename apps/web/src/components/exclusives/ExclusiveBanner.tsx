import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { HiArrowRight } from 'react-icons/hi2'
import { StarMark } from '../ui/Logo'

/**
 * Wide call-to-action towards the Exclusivités page. Full section on the home
 * page, a compact strip at the top of the shop.
 */
export default function ExclusiveBanner({ compact = false, className }: { compact?: boolean; className?: string }) {
  const banner = (
    <Link
      to="/exclusivites"
      className={clsx(
        'theme-dark group relative flex overflow-hidden rounded-3xl border border-gold/40 bg-[radial-gradient(ellipse_at_right,rgb(var(--glow)/0.1),transparent_60%),linear-gradient(135deg,#171309,#0A0A0A_60%)] shadow-none transition-colors hover:border-gold',
        compact ? 'flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between md:px-10' : 'flex-col gap-8 p-8 md:flex-row md:items-center md:justify-between md:p-14',
        className,
      )}
    >
      <StarMark
        className={clsx(
          'pointer-events-none absolute opacity-15 transition-transform duration-700 group-hover:rotate-[72deg]',
          compact ? '-right-6 -top-10 h-40 w-40' : '-right-10 -top-16 h-72 w-72',
        )}
      />
      <div className="relative">
        <p className="eyebrow mb-2">Pièces rares · Séries limitées</p>
        <p className={clsx('font-display font-semibold leading-none', compact ? 'text-3xl md:text-4xl' : 'text-4xl md:text-6xl')}>
          Les <span className="text-gold-gradient italic">Exclusivités</span>
        </p>
        {!compact && (
          <p className="mt-4 max-w-xl text-sm text-gray-400 md:text-base">
            Nos pièces les plus rares et premium, réunies par maison : Exclu Nike et bien d'autres. Disponibles uniquement ici.
          </p>
        )}
      </div>
      <span className="relative inline-flex shrink-0 items-center gap-3 self-start rounded-full bg-gold-gradient px-7 py-4 text-xs font-bold uppercase tracking-[0.25em] text-primary-black transition-transform group-hover:translate-x-1 sm:self-auto">
        Découvrir les exclus <HiArrowRight className="h-4 w-4" />
      </span>
    </Link>
  )

  if (compact) return banner
  return <section className="container-custom pt-14 md:pt-20">{banner}</section>
}
