import { Link } from 'react-router-dom'
import { HiArrowRight } from 'react-icons/hi2'
import { formatCurrency, type Product } from '@trs/shared'
import { mainImage } from '../../context/WishlistContext'

/** "Nouveautés": the newest pieces as plain packshots in a row of six. */
export default function NewIn({ products }: { products: Product[] }) {
  const pieces = products.filter((p) => mainImage(p)).slice(0, 12)
  if (pieces.length === 0) return null

  return (
    <section aria-labelledby="new-in" className="px-4 py-12 sm:px-6 md:py-16 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 id="new-in" className="font-sans text-[13px] font-medium uppercase tracking-[0.06em]">
          Nouveautés
        </h2>
        <Link to="/collection?sort=newest" aria-label="Voir toutes les nouveautés" className="p-1 transition-opacity hover:opacity-60">
          <HiArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
        {pieces.map((p) => (
          <li key={p.id}>
            <Link to={`/product/${p.slug}`} className="group block">
              <div className="aspect-[3/4] overflow-hidden bg-dark-800">
                <img src={mainImage(p)} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
              </div>
              <p className="mt-3 line-clamp-1 text-xs group-hover:underline">{p.name}</p>
              <p className="mt-1 text-xs text-gray-400">{formatCurrency(p.price)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
