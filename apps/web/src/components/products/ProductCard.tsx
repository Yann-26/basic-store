import { useState } from 'react'
import { Link } from 'react-router-dom'
import { HiHeart, HiOutlineHeart, HiPlus } from 'react-icons/hi2'
import clsx from 'clsx'
import { discountPercent, effectiveSizes, formatCurrency, isLowStock, isOutOfStock, ONE_SIZE, stockForSize, totalStock, type BadgeVariant, type Product } from '@trs/shared'
import { useCart } from '../../context/CartContext'
import { mainImage, useWishlist } from '../../context/WishlistContext'
import Badge from '../ui/Badge'

const NEW_DAYS = 21

/** Named colours to swatches (typed by hand in the back-office); unknown names get a neutral dot. */
const SWATCHES: Record<string, string> = {
  noir: '#111111', black: '#111111', blanc: '#FFFFFF', white: '#FFFFFF', beige: '#D9CBB4', creme: '#EFE6D6', crème: '#EFE6D6', ecru: '#EDE6D6',
  gris: '#9A9A9A', grey: '#9A9A9A', marron: '#6B4A33', brun: '#6B4A33', camel: '#B98A5A', bleu: '#2F4A7A', marine: '#1F2A44', navy: '#1F2A44',
  rouge: '#A3262A', vert: '#3F5A3C', kaki: '#7A7353', rose: '#E6B8B7', jaune: '#E3C34A', orange: '#D9792B', violet: '#6A4C7A', bordeaux: '#5E1A26',
}
export const swatch = (color: string) => SWATCHES[color.trim().toLowerCase()] ?? '#C9C2B6'

export function productBadge(p: Product): { label: string; variant: BadgeVariant } | null {
  if (isOutOfStock(p)) return { label: 'Épuisé', variant: 'soldout' }
  const discount = discountPercent(p.price, p.compare_at_price)
  if (discount > 0) return { label: `-${discount}%`, variant: 'sale' }
  if (isLowStock(p)) return { label: `Plus que ${totalStock(p)}`, variant: 'lowstock' }
  if (p.is_featured) return { label: 'Coup de cœur', variant: 'bestseller' }
  if (p.created_at && Date.now() - new Date(p.created_at).getTime() < NEW_DAYS * 86_400_000) return { label: 'Nouveau', variant: 'new' }
  return null
}

export default function ProductCard({ product }: { product: Product; index?: number }) {
  const { addItem } = useCart()
  const { has, toggle } = useWishlist()
  const [picking, setPicking] = useState(false)

  const images = (product.product_media ?? []).filter((m) => m.media_type === 'image')
  const cover = mainImage(product)
  const hover = images.find((m) => m.file_path !== cover)?.file_path
  const sizes = effectiveSizes(product.sizes)
  const badge = productBadge(product)
  const soldOut = isOutOfStock(product)
  const liked = has(product.id)
  const discount = discountPercent(product.price, product.compare_at_price)

  const add = (size: string) => {
    addItem({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      image: cover,
      size,
      color: product.colors.length === 1 ? product.colors[0] : undefined,
      category: product.category,
      maxQuantity: stockForSize(product, size),
    })
    setPicking(false)
  }

  const onQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault()
    if (sizes.length === 1 && sizes[0] === ONE_SIZE) add(ONE_SIZE)
    else setPicking((v) => !v)
  }

  return (
    <article className="group relative" onMouseLeave={() => setPicking(false)}>
      <Link to={`/product/${product.slug}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden bg-dark-700">
          {cover ? (
            <>
              <img
                src={cover}
                alt={product.name}
                loading="lazy"
                className={clsx('h-full w-full object-cover transition-opacity duration-500', hover && 'group-hover:opacity-0', soldOut && 'opacity-60')}
              />
              {hover && <img src={hover} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" />}
            </>
          ) : (
            <div className="flex h-full items-center justify-center font-display text-3xl text-gray-500">Basic Store</div>
          )}
          {badge && <Badge variant={badge.variant} className="absolute left-3 top-3">{badge.label}</Badge>}
        </div>
      </Link>

      <button
        onClick={() => toggle(product)}
        className={clsx('absolute right-3 top-3 flex h-8 w-8 items-center justify-center transition-colors', liked ? 'text-[#111]' : 'text-[#111]/70 hover:text-[#111]')}
        aria-label={liked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        aria-pressed={liked}
      >
        {liked ? <HiHeart className="h-5 w-5" /> : <HiOutlineHeart className="h-5 w-5" />}
      </button>

      {!soldOut && (
        <div className="absolute inset-x-3 bottom-[5.25rem] hidden md:block">
          {picking ? (
            <div className="flex flex-wrap justify-center gap-1.5 bg-white/95 p-2 text-[#111] shadow-sm">
              {sizes.map((s) => {
                const left = stockForSize(product, s)
                return (
                  <button
                    key={s}
                    onClick={() => add(s)}
                    disabled={left <= 0}
                    className="min-w-9 border border-black/15 px-2.5 py-1 text-xs hover:border-black hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:text-black/30 disabled:line-through disabled:hover:border-black/15 disabled:hover:bg-transparent"
                    aria-label={left <= 0 ? `${s} épuisé` : `Ajouter en ${s}`}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          ) : (
            <button
              onClick={onQuickAdd}
              className="flex w-full translate-y-2 items-center justify-center gap-2 bg-white/95 py-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-[#111] opacity-0 transition-all hover:bg-black hover:text-white group-hover:translate-y-0 group-hover:opacity-100"
            >
              <HiPlus className="h-4 w-4" /> Ajout rapide
            </button>
          )}
        </div>
      )}

      <Link to={`/product/${product.slug}`} className="mt-3 block min-h-[4.5rem]">
        <h3 className="line-clamp-1 text-[13px] text-white group-hover:underline">{product.name}</h3>
        <div className="mt-1 flex items-baseline gap-2">
          <span className={clsx('text-[13px]', discount > 0 && 'text-red-700')}>{formatCurrency(product.price)}</span>
          {discount > 0 && <span className="text-xs text-gray-500 line-through">{formatCurrency(product.compare_at_price!)}</span>}
        </div>
        {product.colors.length > 0 && (
          <div className="mt-2 flex gap-1.5" aria-label={`Couleurs : ${product.colors.join(', ')}`}>
            {product.colors.slice(0, 5).map((c) => (
              <span key={c} title={c} className="h-3.5 w-3.5 border border-black/15" style={{ backgroundColor: swatch(c) }} />
            ))}
          </div>
        )}
      </Link>
    </article>
  )
}

export function ProductCardSkeleton() {
  return (
    <div>
      <div className="skeleton aspect-[4/5]" />
      <div className="skeleton mt-3 h-4 w-2/3" />
      <div className="skeleton mt-2 h-4 w-1/4" />
    </div>
  )
}
