import { Link } from 'react-router-dom'
import { seriesComplete, seriesLeft, type Product } from '@trs/shared'

/**
 * A numbered series (back-office → Produits → Série numérotée): how many pieces it has, how
 * many numbers are left, or that it is complete — the piece then stays on the shop, sold out.
 */
export default function SeriesNotice({ product }: { product: Product }) {
  const size = product.series_size
  if (!size) return null

  if (seriesComplete(product)) {
    return (
      <section aria-label="Série complète" className="mt-8 border border-white/15 p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.15em]">Épuisé — série complète</p>
        <p className="mt-2 text-sm text-gray-400">
          Les {size} pièces numérotées de cette série ont toutes trouvé preneur. Elle ne sera pas rééditée.
        </p>
        <Link to="/drops" className="mt-3 inline-block text-sm underline underline-offset-4 hover:opacity-70">
          Être prévenu du prochain drop
        </Link>
      </section>
    )
  }

  const left = seriesLeft(product) ?? size
  const few = left <= Math.max(5, Math.ceil(size * 0.1))
  return (
    <section aria-label="Série numérotée" className="mt-8 border border-white/10 p-5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-gray-400">Série de {size} pièces numérotées</p>
        <p className={few ? 'text-sm font-semibold tabular-nums' : 'text-sm tabular-nums'}>
          {few ? `Plus que ${left}` : `${left} restantes`}
        </p>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-gray-500">
        Chaque pièce porte son numéro, de 1 à {size}, attribué dès votre acompte et inscrit sur son étiquette. Une fois la série complète, elle ne revient pas.
      </p>
    </section>
  )
}
