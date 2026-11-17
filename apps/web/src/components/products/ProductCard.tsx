import { useState } from 'react'
import { Link } from 'react-router-dom'
import { HiHeart, HiOutlineHeart, HiPlus } from 'react-icons/hi2'
import clsx from 'clsx'
import { discountPercent, effectiveSizes, formatCurrency, getCategory, ONE_SIZE, preordersClosed, seriesComplete, seriesLeft, type BadgeVariant, type Product } from '@trs/shared'
import { usePreorder } from '../../context/PreorderContext'
import { mainImage, useWishlist } from '../../context/WishlistContext'
import Badge from '../ui/Badge'
import { dropPhase } from '../drops/useDropAccess'

const NEW_DAYS = 21

export function productBadge(p: Product): { label: string; variant: BadgeVariant } | null {
  if (p.status === 'unavailable' || seriesComplete(p)) return { label: 'Épuisé', variant: 'soldout' }
  const phase = dropPhase(p.drop)
  if (phase === 'reserve') return { label: 'Précommande', variant: 'exclusive' }
  if (phase === 'early') return { label: 'Accès anticipé', variant: 'exclusive' }
  if (phase === 'closed') return { label: 'Bientôt', variant: 'new' }
  if (p.is_exclusive) return { label: 'Exclu', variant: 'exclusive' }
  const discount = discountPercent(p.price, p.compare_at_price)
  if (discount > 0) return { label: `-${discount}%`, variant: 'sale' }
  const left = seriesLeft(p)
  if (left != null && p.series_size && left <= Math.max(5, Math.ceil(p.series_size * 0.1))) return { label: `Plus que ${left}`, variant: 'limited' }
  if (p.series_size) return { label: `Série de ${p.series_size}`, variant: 'limited' }
  if (p.status === 'limited') return { label: 'Édition limitée', variant: 'limited' }
  if (p.is_featured) return { label: 'Coup de cœur', variant: 'exclusive' }
  if (p.created_at && Date.now() - new Date(p.created_at).getTime() < NEW_DAYS * 86_400_000) return { label: 'Nouveau', variant: 'new' }
  return null
}

export default function ProductCard({ product }: { product: Product; index?: number }) {
  const { addItem } = usePreorder()
  const { has, toggle } = useWishlist()
  const [picking, setPicking] = useState(false)

  const images = (product.product_media ?? []).filter((m) => m.media_type === 'image')
  const cover = mainImage(product)
  const hover = images.find((m) => m.file_path !== cover)?.file_path
  const sizes = effectiveSizes(product.sizes)
  const badge = productBadge(product)
  // A piece whose preorders have closed can't be added either (its page says why).
  // Before its drop opens, the piece is ordered from its page (early access is checked there).
  const soldOut = product.status === 'unavailable' || seriesComplete(product) || preordersClosed(product) || ['closed', 'early'].includes(dropPhase(product.drop))
  const liked = has(product.id)

  const add = (size: string) => {
    addItem({ id: product.id, slug: product.slug, name: product.name, price: product.price, image: cover, size, category: product.category })
    setPicking(false)
  }

  const onQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault()
    if (sizes.length === 1 && sizes[0] === ONE_SIZE) add(ONE_SIZE)
    else setPicking((v) => !v)
  }

  return (
    <article
      className="group relative"
      onMouseLeave={() => setPicking(false)}
    >
      <Link to={`/product/${product.slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-dark-700">
          {cover ? (
            <>
              <img src={cover} alt={product.name} loading="lazy" className={clsx('h-full w-full object-cover transition-opacity duration-500', hover && 'group-hover:opacity-0')} />
              {hover && <img src={hover} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" />}
            </>
          ) : (
            <div className="flex h-full items-center justify-center font-display text-5xl text-gold/30">★</div>
          )}
                    {badge && <Badge variant={badge.variant} className="absolute left-3 top-3">{badge.label}</Badge>}
        </div>
      </Link>

      <button
        onClick={() => toggle(product)}
        className={clsx(
          'absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition-all',
          liked ? 'bg-gold text-primary-black' : 'bg-black/40 text-white hover:bg-white hover:text-primary-black',
        )}
        aria-label={liked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        aria-pressed={liked}
      >
        {liked ? <HiHeart className="h-4 w-4" /> : <HiOutlineHeart className="h-4 w-4" />}
      </button>

      {!soldOut && (
        <div className="absolute inset-x-3 bottom-[6.75rem] hidden md:block">
          {picking ? (
            <div className="flex flex-wrap justify-center gap-1.5 rounded-2xl bg-primary-black/90 p-2 backdrop-blur">
              {sizes.map((s) => (
                <button key={s} onClick={() => add(s)} className="min-w-9 rounded-full border border-white/15 px-2.5 py-1 text-xs hover:border-gold hover:bg-gold hover:text-primary-black">
                  {s}
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={onQuickAdd}
              className="flex w-full translate-y-2 items-center justify-center gap-2 rounded-full bg-white py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-black opacity-0 transition-all hover:bg-gold group-hover:translate-y-0 group-hover:opacity-100"
            >
              <HiPlus className="h-4 w-4" /> Ajout rapide
            </button>
          )}
        </div>
      )}

      <Link to={`/product/${product.slug}`} className="mt-4 block h-20">
        <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500">
          {getCategory(product.category)?.label}
          {product.subcategory ? ` · ${product.subcategory}` : ''}
        </p>
        <h3 className="mt-1 line-clamp-1 text-sm text-white group-hover:underline">{product.name}</h3>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-sm">{formatCurrency(product.price)}</span>
          {discountPercent(product.price, product.compare_at_price) > 0 && (
            <span className="text-sm text-gray-500 line-through">{formatCurrency(product.compare_at_price!)}</span>
          )}
        </div>
      </Link>
    </article>
  )
}

export function ProductCardSkeleton() {
  return (
    <div>
      <div className="skeleton aspect-[3/4] rounded-2xl" />
      <div className="skeleton mt-4 h-3 w-1/3 rounded" />
      <div className="skeleton mt-2 h-4 w-2/3 rounded" />
      <div className="skeleton mt-2 h-4 w-1/4 rounded" />
    </div>
  )
}
