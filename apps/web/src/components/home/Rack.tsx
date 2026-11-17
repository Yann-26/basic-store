import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, LayoutGroup, motion, MotionConfig } from 'framer-motion'
import clsx from 'clsx'
import { HiXMark } from 'react-icons/hi2'
import { effectiveSizes, formatCurrency, getCategory, isOutOfStock, ONE_SIZE, stockForSize, type Product } from '@trs/shared'
import { useCart } from '../../context/CartContext'
import { mainImage } from '../../context/WishlistContext'
import { useSettings } from '../../context/SettingsContext'
import { useProductsByIds } from '../../hooks/useProductsByIds'

const SPRING = { type: 'spring', stiffness: 260, damping: 26 } as const
const BACK_HINT = /(^|[^a-z])(dos|back|arriere|arrière|verso)([^a-z]|$)/i

/** The photo of the back of a piece, when one is marked as such (name or alt text: "dos", "back"…). */
function backImage(p: Product): string {
  const main = mainImage(p)
  const photo = (p.product_media ?? []).find(
    (m) => m.media_type === 'image' && m.file_path && m.file_path !== main && BACK_HINT.test(`${m.file_name ?? ''} ${m.alt_text ?? ''} ${m.file_path}`),
  )
  return photo?.file_path ?? ''
}

/** A piece on the rail: its rack photo (set by hand, or the product's), its back view, the piece it opens. */
interface Hung {
  key: string
  product: Product
  image: string
  back: string
}

/** A small hanger hook drawn above each piece, so plain packshots hang from the rail. */
function Hook() {
  return (
    <svg viewBox="0 0 40 28" aria-hidden className="mx-auto -mb-1 block h-7 w-10 text-[#777]">
      <path d="M20 26 V14 a5 5 0 1 0 -5 -5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 27 L20 19 L36 27" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** The piece taken off the rail: large in the middle, the rail blurred behind, front/back, sizes, add. */
function Detail({ hung, onClose }: { hung: Hung; onClose: () => void }) {
  const { product, image: front, back } = hung
  const { addItem } = useCart()
  const [side, setSide] = useState<'front' | 'back'>('front')
  const [size, setSize] = useState('')
  const sizes = effectiveSizes(product.sizes)
  const oneSize = sizes.length === 1 && sizes[0] === ONE_SIZE
  const chosen = oneSize ? ONE_SIZE : size
  const sizeLabel = getCategory(product.category)?.sizeSystem === 'shoes' ? 'pointure' : 'taille'
  const unavailable = isOutOfStock(product)
  // Several colours: the choice is made on the product page.
  const directAdd = !unavailable && product.colors.length <= 1

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const add = () => {
    if (!chosen) return
    addItem({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      image: mainImage(product) || front,
      size: chosen,
      color: product.colors[0],
      category: product.category,
      maxQuantity: stockForSize(product, chosen),
    })
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="false"
      aria-label={product.name}
      className="absolute inset-0 z-30 flex flex-col items-center justify-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
    >
      {/* Clicking the blurred rail puts the piece back. */}
      <button type="button" aria-label="Remettre la pièce sur le portant" className="absolute inset-0 cursor-default" onClick={onClose} />
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="absolute right-4 top-4 z-10 rounded-full p-2 text-[#111] transition-colors hover:bg-[#0000000d]"
      >
        <HiXMark className="h-5 w-5" />
      </button>

      <div className="pointer-events-none relative z-10 flex flex-col items-center">
        <motion.div layoutId={`rack-${hung.key}`} transition={SPRING} className="relative h-[40vh] max-h-[420px] w-[min(70vw,340px)]">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.img
              key={side}
              src={side === 'back' && back ? back : front}
              alt={`${product.name}${side === 'back' ? ' (dos)' : ''}`}
              className="absolute inset-0 h-full w-full object-contain mix-blend-multiply drop-shadow-[0_18px_22px_rgba(0,0,0,0.18)]"
              initial={{ opacity: 0, rotateY: side === 'back' ? -90 : 90 }}
              animate={{ opacity: 1, rotateY: 0 }}
              exit={{ opacity: 0, rotateY: side === 'back' ? 90 : -90 }}
              transition={{ duration: 0.35 }}
            />
          </AnimatePresence>
        </motion.div>

        <motion.div
          className="pointer-events-auto mt-5 flex flex-col items-center text-center text-[#111]"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.15 } }}
          exit={{ opacity: 0 }}
        >
          <p className="text-[13px] font-bold uppercase tracking-[0.18em]">{product.name}</p>
          <p className="mt-1 text-xs text-[#777]">{formatCurrency(product.price)}</p>

          {back && (
            <div className="mt-4 flex rounded-full border border-[#cfcfcf] p-0.5" role="group" aria-label="Vue">
              {(['front', 'back'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={side === s}
                  onClick={() => setSide(s)}
                  className={clsx(
                    'rounded-full px-4 py-1 text-[10px] font-medium uppercase tracking-[0.14em] transition-colors',
                    side === s ? 'bg-[#111] text-[#fff]' : 'text-[#555] hover:text-[#111]',
                  )}
                >
                  {s === 'front' ? 'Face' : 'Dos'}
                </button>
              ))}
            </div>
          )}

          {directAdd && !oneSize && (
            <div className="mt-4 flex flex-wrap justify-center gap-1.5" role="group" aria-label={`Choisir une ${sizeLabel}`}>
              {sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={size === s}
                  onClick={() => setSize(s)}
                  disabled={stockForSize(product, s) <= 0}
                  className={clsx(
                    'min-w-9 rounded-full border px-2.5 py-1 text-[11px] transition-colors disabled:cursor-not-allowed disabled:line-through disabled:opacity-40',
                    size === s ? 'border-[#111] bg-[#111] text-[#fff]' : 'border-[#cfcfcf] text-[#3f3f3f] hover:border-[#111]',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {directAdd ? (
            <button
              type="button"
              onClick={add}
              disabled={!chosen}
              className="mt-5 w-56 rounded-full bg-[#111] py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[#fff] transition-opacity disabled:opacity-30"
            >
              {chosen ? 'Ajouter au panier' : `Choisir une ${sizeLabel}`}
            </button>
          ) : (
            unavailable && <p className="mt-5 text-[11px] uppercase tracking-[0.14em] text-[#777]">Épuisé</p>
          )}
          <Link to={`/product/${product.slug}`} className="mt-3 text-[11px] uppercase tracking-[0.14em] text-[#3f3f3f] underline underline-offset-4 hover:text-[#111]">
            Voir la pièce
          </Link>
        </motion.div>
      </div>
    </motion.div>
  )
}

/**
 * "Le portant": the pieces hang side by side on a rail. Hovering one pulls it
 * forward and pushes its neighbours aside; clicking takes it off the rail to the
 * middle while the rest of the rail blurs behind it. On a phone the rail
 * scrolls sideways and a tap takes the piece off.
 */
export default function Rack({ products }: { products: Product[] }) {
  const { settings } = useSettings()
  const { enabled, title, items } = settings.rack
  // Pieces hung by hand (Marketing → Le portant): their own photo, the piece chosen for the click.
  const linked = useProductsByIds([...new Set(items.map((i) => i.product_id).filter(Boolean))])
  const byId = new Map(linked.map((p) => [p.id, p]))
  const pieces: Hung[] =
    items.length > 0
      ? items.flatMap((i) => {
          const product = byId.get(i.product_id)
          return product ? [{ key: i.id, product, image: i.image, back: i.back_image }] : []
        })
      : products
          .filter((p) => mainImage(p))
          .slice(0, 10)
          .map((p) => ({ key: p.id, product: p, image: mainImage(p), back: backImage(p) }))
  const [hovered, setHovered] = useState<number | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const open = pieces.find((p) => p.key === openKey) ?? null

  if (!enabled || pieces.length === 0) return null

  // Neighbours move away from the piece being pulled out, the closest the most.
  const shift = (i: number) => {
    if (hovered === null || i === hovered) return 0
    const d = i - hovered
    return Math.sign(d) * Math.max(0, 34 - (Math.abs(d) - 1) * 10)
  }

  return (
    <MotionConfig reducedMotion="user">
      <section aria-labelledby="rack-title" className="relative overflow-hidden bg-[#f4f4f2] py-12 text-[#111] md:py-16">
        <div className="mb-2 flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <h2 id="rack-title" className="font-sans text-[13px] font-medium uppercase tracking-[0.06em]">
            {title}
          </h2>
          <Link to="/collection" className="text-[11px] uppercase tracking-[0.12em] text-[#555] hover:text-[#111]">
            Tout voir
          </Link>
        </div>

        <LayoutGroup>
          <div className="relative flex min-h-[520px] flex-col justify-center md:min-h-[600px]">
            <motion.div
              animate={{ filter: open ? 'blur(10px)' : 'blur(0px)', opacity: open ? 0.4 : 1 }}
              transition={{ duration: 0.4 }}
              className={clsx('relative pt-10', open && 'pointer-events-none')}
              aria-hidden={open ? true : undefined}
            >
              {/* The rail */}
              <div aria-hidden className="absolute left-[6%] right-[6%] top-[46px] h-[3px] rounded-full bg-gradient-to-b from-[#c8c8c8] to-[#a8a8a8] shadow-sm" />

              <ul
                className="flex snap-x snap-mandatory items-start gap-2 overflow-x-auto px-[8%] pb-6 [scrollbar-width:none] md:justify-center md:gap-0 md:overflow-visible md:px-[8%]"
                onMouseLeave={() => setHovered(null)}
              >
                {pieces.map((h, i) => (
                  <motion.li
                    key={h.key}
                    className="relative w-[42vw] flex-none snap-center sm:w-[30vw] md:-mx-5 md:w-[clamp(120px,14vw,200px)]"
                    style={{ zIndex: hovered === i ? 20 : 10 - Math.abs(i - (hovered ?? i)) }}
                    animate={{ x: shift(i) }}
                    transition={SPRING}
                    onMouseEnter={() => setHovered(i)}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenKey(h.key)}
                      onFocus={() => setHovered(i)}
                      onBlur={() => setHovered(null)}
                      aria-label={`${h.product.name}, ${formatCurrency(h.product.price)}`}
                      className="group block w-full focus:outline-none"
                    >
                      <motion.div
                        style={{ transformOrigin: '50% 0%' }}
                        animate={hovered === i ? { scale: 1.28, y: 6, rotate: [0, 1.5, -1, 0] } : { scale: 1, y: 0, rotate: 0 }}
                        transition={hovered === i ? { ...SPRING, rotate: { duration: 0.9 } } : SPRING}
                      >
                        <Hook />
                        {open?.key === h.key ? (
                          // The piece is off the rail: keep its place.
                          <div className="aspect-[3/4] w-full" />
                        ) : (
                          <motion.div layoutId={`rack-${h.key}`} transition={SPRING} className="aspect-[3/4] w-full">
                            <img
                              src={h.image}
                              alt=""
                              loading="lazy"
                              draggable={false}
                              className="h-full w-full object-contain mix-blend-multiply drop-shadow-[0_10px_12px_rgba(0,0,0,0.14)] group-focus-visible:outline group-focus-visible:outline-1 group-focus-visible:outline-[#111]"
                            />
                          </motion.div>
                        )}
                      </motion.div>
                      <span
                        className={clsx(
                          'mt-3 block text-center text-[10px] uppercase tracking-[0.12em] transition-opacity md:opacity-0',
                          hovered === i && 'md:opacity-100',
                        )}
                      >
                        {h.product.name}
                      </span>
                    </button>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            <AnimatePresence>{open && <Detail key={open.key} hung={open} onClose={() => setOpenKey(null)} />}</AnimatePresence>
          </div>
        </LayoutGroup>
      </section>
    </MotionConfig>
  )
}
