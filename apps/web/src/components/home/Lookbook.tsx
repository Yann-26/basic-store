import { Link } from 'react-router-dom'
import clsx from 'clsx'
import type { Product } from '@trs/shared'
import { useSettings } from '../../context/SettingsContext'
import { useProductsByIds } from '../../hooks/useProductsByIds'
import type { LookbookShoot } from '../../services/marketing'

function Shoot({ shoot, index, products, single }: { shoot: LookbookShoot; index: number; products: Map<string, Product>; single: boolean }) {
  const worn = shoot.product_ids.map((id) => products.get(id)).filter((p): p is Product => !!p)
  return (
    <figure className={clsx(single ? 'grid items-end gap-8 md:grid-cols-2 md:gap-12' : 'w-[78vw] flex-none snap-start sm:w-[46vw] lg:w-auto')}>
      <div className="relative aspect-[3/4] overflow-hidden bg-dark-700">
        <img src={shoot.image} alt={shoot.title || `Look ${index + 1}`} loading="lazy" className="h-full w-full object-cover" />
      </div>
      <figcaption className={single ? 'pb-2' : 'pt-4'}>
        {shoot.title && <p className={clsx('campaign-title', single ? 'text-5xl md:text-7xl' : 'text-3xl')}>{shoot.title}</p>}
        {shoot.caption && <p className="mt-3 max-w-md text-sm leading-relaxed text-gray-400">{shoot.caption}</p>}
        {worn.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.12em] text-gray-500">Porté ici</span>
            {worn.map((p) => (
              <Link key={p.id} to={`/product/${p.slug}`} className="border border-white/15 px-3 py-1.5 text-xs transition-colors hover:border-white">
                {p.name}
              </Link>
            ))}
          </div>
        )}
      </figcaption>
    </figure>
  )
}

/**
 * Marketing → Lookbook: the photos of the shootings, with the pieces worn in
 * each one linked to their page. One look fills the width; several sit in a
 * row (swiped on a phone).
 */
export default function Lookbook() {
  const { settings } = useSettings()
  const { enabled, title, subtitle, shoots } = settings.lookbook
  const productIds = [...new Set(shoots.flatMap((s) => s.product_ids))]
  const products = new Map(useProductsByIds(productIds).map((p) => [p.id, p]))
  if (!enabled || shoots.length === 0) return null
  const single = shoots.length === 1

  return (
    <section aria-labelledby="lookbook-title" className="border-t border-white/10 px-4 py-14 sm:px-6 md:py-20 lg:px-8">
      <div className="mb-8 max-w-2xl">
        <h2 id="lookbook-title" className="font-sans text-[13px] font-medium uppercase tracking-[0.06em]">
          {title || 'Lookbook'}
        </h2>
        {subtitle && <p className="mt-2 text-sm text-gray-400">{subtitle}</p>}
      </div>
      <div
        className={clsx(
          !single && 'no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:overflow-visible lg:px-0',
          !single && (shoots.length === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3'),
        )}
      >
        {shoots.map((s, i) => (
          <Shoot key={s.id} shoot={s} index={i} products={products} single={single} />
        ))}
      </div>
    </section>
  )
}
