import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import clsx from 'clsx'
import { FaWhatsapp } from 'react-icons/fa'
import {
  HiHeart,
  HiMinus,
  HiOutlineHeart,
  HiOutlineShoppingBag,
  HiPlus,
  HiShieldCheck,
  HiTruck,
  HiCreditCard,
  HiChevronDown,
  HiShare,
} from 'react-icons/hi2'
import {
  discountPercent,
  effectiveSizes,
  formatCurrency,
  galleryForColor,
  getCategory,
  GENDERS,
  photosOfColor,
  preordersClosed,
  seriesComplete,
  seriesLeft,
  sameColor,
  ONE_SIZE,
  type Product as ProductType,
} from '@trs/shared'
import { catalogService } from '../services/catalogService'
import ProductReviews from '../components/reviews/ProductReviews'

// three.js and the model arrive in their own files, only for pieces with a 3D model.
const ModelViewer = lazy(() => import('../components/three/ModelViewer'))
import { usePreorder } from '../context/PreorderContext'
import { useSettings } from '../context/SettingsContext'
import { mainImage, useWishlist } from '../context/WishlistContext'
import { useRecentlyViewed } from '../hooks/useRecentlyViewed'
import { whatsappLink } from '../utils/constants'
import ProductCard, { productBadge } from '../components/products/ProductCard'
import SizeGuide from '../components/products/SizeGuide'
import PreorderGauge from '../components/products/PreorderGauge'
import SeriesNotice from '../components/products/SeriesNotice'
import DropNotice from '../components/drops/DropNotice'
import { dropDateLabel, useDropAccess } from '../components/drops/useDropAccess'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import toast from 'react-hot-toast'

function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-white/10">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between py-5 text-left text-xs font-semibold uppercase tracking-[0.2em]" aria-expanded={open}>
        {title}
        <HiChevronDown className={clsx('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="pb-6 text-sm leading-relaxed text-gray-400">{children}</div>}
    </div>
  )
}

/** One photo of the gallery. */
function GalleryFigure({ children }: { children: ReactNode }) {
  return <figure className="relative aspect-[4/5] w-[86%] flex-none snap-center overflow-hidden rounded-3xl bg-dark-700 lg:w-full">{children}</figure>
}

export default function Product() {
  const { id: slug = '' } = useParams<{ id: string }>()
  const [product, setProduct] = useState<ProductType | null>(null)
  const [related, setRelated] = useState<ProductType[]>([])
  const [loading, setLoading] = useState(true)
  const [size, setSize] = useState<string | null>(null)
  const [color, setColorState] = useState<string | null>(null)
  const [viewerFailed, setViewerFailed] = useState(false)
  const [params, setParams] = useSearchParams()
  const mainPhoto = useRef<HTMLDivElement>(null)
  const viewer3d = useRef<HTMLDivElement>(null)
  const [quantity, setQuantity] = useState(1)
  const [guideOpen, setGuideOpen] = useState(false)
  const { addItem } = usePreorder()
  const { settings } = useSettings()
  const { has, toggle } = useWishlist()
  const { items: recent, track } = useRecentlyViewed()

  useEffect(() => {
    let alive = true
    setLoading(true)
    setSize(null)
    setColorState(null)
    setQuantity(1)
    catalogService
      .getProduct(slug)
      .then((p) => {
        if (!alive) return
        setProduct(p)
        track(p)
        const sizes = effectiveSizes(p.sizes)
        if (sizes.length === 1) setSize(sizes[0]!)
        // ?couleur=bleu (shareable link to a colour), else the only colour
        const wanted = p.colors.find((c) => sameColor(c, new URLSearchParams(window.location.search).get('couleur')))
        const initial = wanted ?? (p.colors.length === 1 ? p.colors[0]! : null)
        if (initial) setColorState(initial)
      })
      .catch(() => alive && setProduct(null))
      .finally(() => alive && setLoading(false))
    catalogService.getRelated(slug).then((r) => alive && setRelated(r)).catch(() => undefined)
    return () => {
      alive = false
    }
  }, [slug, track])

  // The piece's drop: closed before it, early access for the list, then open (kept current).
  const dropGate = useDropAccess(product?.drop)

  if (loading) {
    return (
      <div className="py-40">
        <Spinner />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="container-custom py-32 text-center">
        <p className="font-display text-6xl text-gold/40">★</p>
        <h1 className="mt-6 text-4xl">Pièce introuvable</h1>
        <p className="mt-3 text-gray-400">Cette pièce n'existe pas ou n'est plus disponible.</p>
        <Link to="/collection" className="mt-8 inline-block">
          <Button>Retour à la boutique</Button>
        </Link>
      </div>
    )
  }

  const category = getCategory(product.category)
  const allMedia = (product.product_media ?? []).filter((m) => m.file_path)
  // The chosen colour's photos first (then the ones shared by every colour).
  const media = galleryForColor(allMedia, product.colors, color)
  const firstPhotoOf = (c: string) => photosOfColor(allMedia, product.colors, c).find((m) => m.media_type === 'image')?.file_path
  const cover = (color && firstPhotoOf(color)) || mainImage(product)
  const colorPhotos = product.colors.length > 1 && product.colors.some((c) => firstPhotoOf(c))

  const model3d = product.model_3d?.enabled && !viewerFailed ? product.model_3d : null

  const setColor = (c: string) => {
    if (c === color) return
    setColorState(c)
    const next = new URLSearchParams(params)
    next.set('couleur', c)
    setParams(next, { replace: true, preventScrollReset: true })
    // On phones the photo (or the 3D piece) sits above the colour picker: bring it into view so the change is seen.
    const photo = model3d ? viewer3d.current : mainPhoto.current
    if (!photo || (!model3d && !firstPhotoOf(c))) return
    const { top, bottom } = photo.getBoundingClientRect()
    const header = Math.max(0, document.querySelector('header')?.getBoundingClientRect().bottom ?? 0)
    if (top < header || bottom > window.innerHeight) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      window.scrollTo({ top: window.scrollY + top - header - 12, behavior: reduce ? 'auto' : 'smooth' })
    }
  }
  const sizes = effectiveSizes(product.sizes)
  const oneSize = sizes.length === 1 && sizes[0] === ONE_SIZE
  const sizeLabel = category?.sizeSystem === 'shoes' ? 'Pointure' : 'Taille'
  const discount = discountPercent(product.price, product.compare_at_price)
  const badge = productBadge(product)
  const complete = seriesComplete(product)
  const soldOut = product.status === 'unavailable' || complete
  // At most what the numbered series has left (and 10 per line).
  const maxQuantity = Math.max(1, Math.min(10, seriesLeft(product) ?? 10))
  const closed = preordersClosed(product)
  const liked = has(product.id)
  const needsColor = product.colors.length > 1 && !color
  const canAdd = !soldOut && !closed && dropGate.canOrder && !!size && !needsColor
  const recentOthers = recent.filter((r) => r.id !== product.id).slice(0, 4)

  const add = () => {
    if (closed) return toast.error('Les précommandes de cette pièce sont closes')
    if (!size) return toast.error(`Choisissez votre ${sizeLabel.toLowerCase()}`)
    if (needsColor) return toast.error('Choisissez une couleur')
    addItem({ id: product.id, slug: product.slug, name: product.name, price: product.price, image: cover, size, color: color ?? undefined, category: product.category }, quantity)
  }

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: product.name, url })
      else {
        await navigator.clipboard.writeText(url)
        toast.success('Lien copié')
      }
    } catch {
      /* cancelled */
    }
  }

  const waText = `Bonjour ${settings.store_name}, je souhaite commander « ${product.name} »${!oneSize && size ? ` en ${sizeLabel.toLowerCase()} ${size}` : ''}${color ? `, couleur ${color}` : ''}. ${window.location.href}`

  return (
    <>
      <Helmet>
        <title>{`${product.name} | ${settings.store_name}`}</title>
        <meta name="description" content={product.description?.slice(0, 160) || product.name} />
        <meta property="og:title" content={product.name} />
        {cover && <meta property="og:image" content={cover} />}
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            image: media.filter((m) => m.media_type === 'image').map((m) => m.file_path),
            description: product.description ?? undefined,
            brand: { '@type': 'Brand', name: settings.store_name },
            offers: {
              '@type': 'Offer',
              priceCurrency: 'XOF',
              price: product.price,
              availability: soldOut || closed ? 'https://schema.org/OutOfStock' : 'https://schema.org/PreOrder',
            },
          })}
        </script>
      </Helmet>


      <section id="acheter" className="container-custom scroll-mt-24 py-8 md:py-12">
        <nav className="mb-8 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.15em] text-gray-500" aria-label="Fil d'Ariane">
          <Link to="/collection" className="hover:text-gold">
            Boutique
          </Link>
          <span>/</span>
          <Link to={`/collection?category=${product.category}`} className="hover:text-gold">
            {category?.label}
          </Link>
          {product.subcategory && (
            <>
              <span>/</span>
              <Link to={`/collection?category=${product.category}&subcategory=${encodeURIComponent(product.subcategory)}`} className="hover:text-gold">
                {product.subcategory}
              </Link>
            </>
          )}
        </nav>

        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16">
          {/* Gallery: every photo shown large, one after the other (swipe on phones) */}
          <div className="min-w-0 space-y-3 lg:space-y-6">
          {model3d && (
            <div ref={viewer3d} className="scroll-mt-24">
              <Suspense fallback={<div className="aspect-[4/5] w-full animate-pulse rounded-3xl bg-dark-800 lg:aspect-square" />}>
                <ModelViewer
                  model={model3d}
                  name={product.name}
                  colors={product.colors}
                  color={color}
                  onColorChange={setColor}
                  onFail={() => setViewerFailed(true)}
                  className="aspect-[4/5] w-full rounded-3xl lg:aspect-square"
                />
              </Suspense>
            </div>
          )}
          <div ref={mainPhoto} className="no-scrollbar -mx-4 flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto px-4 lg:mx-0 lg:snap-none lg:flex-col lg:gap-6 lg:overflow-visible lg:px-0">
            {media.length === 0 && (
              <div className="aspect-[4/5] w-full flex-none overflow-hidden rounded-3xl bg-dark-700">
                {cover ? <img src={cover} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center font-display text-8xl text-gold/20">★</div>}
              </div>
            )}
            {media.map((m, i) => (
              <GalleryFigure key={m.id}>
                {m.media_type === 'video' ? (
                  <video src={m.file_path} controls playsInline className="h-full w-full object-cover" />
                ) : (
                  <img
                    src={m.file_path}
                    alt={color ? `${product.name} — ${color}, vue ${i + 1}` : `${product.name}, vue ${i + 1}`}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    className="h-full w-full object-cover"
                  />
                )}
                {i === 0 && badge && <Badge variant={badge.variant} className="absolute left-4 top-4">{badge.label}</Badge>}
              </GalleryFigure>
            ))}
          </div>
          </div>

          {/* Details */}
          <div className="min-w-0 lg:sticky lg:top-28 lg:self-start">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{category?.label}</p>
                <h1 className="mt-3 text-2xl font-medium leading-tight md:text-3xl">{product.name}</h1>
                {product.gender && <p className="mt-2 text-sm text-gray-500">{GENDERS.find((g) => g.id === product.gender)?.label}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={share} className="rounded-full border border-white/10 p-3 text-gray-300 hover:border-gold hover:text-gold" aria-label="Partager">
                  <HiShare className="h-5 w-5" />
                </button>
                <button
                  onClick={() => toggle(product)}
                  className={clsx('rounded-full border p-3', liked ? 'border-gold bg-gold text-primary-black' : 'border-white/10 text-gray-300 hover:border-gold hover:text-gold')}
                  aria-label={liked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  aria-pressed={liked}
                >
                  {liked ? <HiHeart className="h-5 w-5" /> : <HiOutlineHeart className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="mt-6 flex items-baseline gap-3">
              <span className="text-xl font-medium">{formatCurrency(product.price)}</span>
              {discount > 0 && (
                <>
                  <span className="text-lg text-gray-500 line-through">{formatCurrency(product.compare_at_price!)}</span>
                  <Badge variant="sale">-{discount}%</Badge>
                </>
              )}
            </div>
            {(product.recent_preorders ?? 0) > 0 && (
              <p className="mt-3 flex items-center gap-2 text-sm">
                <span aria-hidden className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60 motion-reduce:hidden" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
                </span>
                <span>
                  <span className="font-semibold tabular-nums">{product.recent_preorders}</span> précommande{product.recent_preorders! > 1 ? 's' : ''} ces dernières 24 h
                </span>
              </p>
            )}
            <p className="mt-2 text-sm text-gray-400">
              {product.preorder_goal
                ? `Paiement sécurisé en ligne. Fabrication dès que la série est complète, puis livraison sous ${settings.delivery_days_min} à ${settings.delivery_days_max} jours.`
                : `Paiement sécurisé en ligne, livraison sous ${settings.delivery_days_min} à ${settings.delivery_days_max} jours.`}
            </p>
            {product.drop && <DropNotice drop={product.drop} phase={dropGate.phase} eligible={dropGate.eligible} signedIn={dropGate.signedIn} />}
            <SeriesNotice product={product} />
            {!complete && <PreorderGauge product={product} />}

            {product.colors.length > 0 && (
              <div className="mt-8">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em]">
                  Couleur {color && <span className="font-normal normal-case tracking-normal text-gray-400">— {color}</span>}
                </p>
                {colorPhotos ? (
                  // Photo swatches: each colour shows its own picture
                  <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                    {product.colors.map((c) => {
                      const photo = firstPhotoOf(c)
                      const active = color === c
                      return (
                        <button
                          key={c}
                          onClick={() => setColor(c)}
                          aria-pressed={active}
                          className={clsx(
                            'w-24 flex-shrink-0 overflow-hidden rounded-2xl border-2 bg-dark-800 text-left transition-colors',
                            active ? 'border-gold' : 'border-white/10 hover:border-white/40',
                          )}
                        >
                          <span className="block aspect-square bg-dark-700">
                            {photo ? (
                              <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover" />
                            ) : (
                              <span className="flex h-full items-center justify-center font-display text-2xl text-gold/30">★</span>
                            )}
                          </span>
                          <span className={clsx('block truncate px-2 py-1.5 text-xs capitalize', active ? 'text-gold' : 'text-gray-300')}>{c}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {product.colors.map((c) => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        aria-pressed={color === c}
                        className={clsx('rounded-full border px-4 py-2 text-sm', color === c ? 'border-gold bg-gold/10 text-gold' : 'border-white/10 text-gray-300 hover:border-white/40')}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!oneSize && (
              <div className="mt-8">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em]">
                    {sizeLabel} {size && <span className="font-normal text-gray-400">— {size}</span>}
                  </p>
                  <button onClick={() => setGuideOpen(true)} className="text-xs text-gold underline-offset-4 hover:underline">
                    Guide des tailles
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {sizes.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      aria-pressed={size === s}
                      className={clsx(
                        'rounded-xl border py-3 text-sm font-medium transition-all',
                        size === s ? 'border-gold bg-gold text-primary-black' : 'border-white/10 hover:border-gold/60',
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 flex gap-3">
              <div className="flex items-center rounded-full border border-white/10">
                <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="p-4 text-gray-400 hover:text-white" aria-label="Diminuer la quantité">
                  <HiMinus className="h-4 w-4" />
                </button>
                <span className="w-6 text-center">{quantity}</span>
                <button onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))} className="p-4 text-gray-400 hover:text-white" aria-label="Augmenter la quantité">
                  <HiPlus className="h-4 w-4" />
                </button>
              </div>
              <Button size="lg" className="flex-1" icon={HiOutlineShoppingBag} onClick={add} disabled={!canAdd}>
                {complete ? 'Épuisé — série complète' : soldOut ? 'Épuisé' : canAdd && dropGate.phase === 'reserve' ? `Réserver · acompte ${settings.deposit_percentage} %` : !dropGate.canOrder && product.drop ? (dropGate.phase === 'early' ? 'Accès anticipé réservé aux inscrits' : `Disponible le ${dropDateLabel(product.drop.starts_at).replace(/ à .*/, '')}`) : closed ? 'Précommandes closes' : !size ? `Choisir ${sizeLabel.toLowerCase()}` : needsColor ? 'Choisir la couleur' : 'Ajouter à ma sélection'}
              </Button>
            </div>
            <a href={whatsappLink(settings.store_whatsapp, waText)} target="_blank" rel="noopener noreferrer" className="mt-3 block">
              <Button variant="dark" size="lg" icon={FaWhatsapp} className="w-full">
                Commander via WhatsApp
              </Button>
            </a>

            <ul className="mt-8 grid grid-cols-3 gap-3 text-center text-[11px] text-gray-400">
              <li className="rounded-2xl border border-white/5 p-3">
                <HiTruck className="mx-auto mb-2 h-5 w-5 text-gold" />
                {settings.delivery_days_min}-{settings.delivery_days_max} jours
              </li>
              <li className="rounded-2xl border border-white/5 p-3">
                <HiShieldCheck className="mx-auto mb-2 h-5 w-5 text-gold" />
                Qualité contrôlée
              </li>
              <li className="rounded-2xl border border-white/5 p-3">
                <HiCreditCard className="mx-auto mb-2 h-5 w-5 text-gold" />
                Paiement sécurisé
              </li>
            </ul>

            <div className="mt-8 border-t border-white/10">
              {product.description && (
                <Accordion title="Description" defaultOpen>
                  <p className="whitespace-pre-line">{product.description}</p>
                </Accordion>
              )}
              {(product.materials || product.features.length > 0) && (
                <Accordion title="Composition & détails">
                  {product.materials && <p className="mb-3">{product.materials}</p>}
                  <ul className="list-inside list-disc space-y-1">
                    {product.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </Accordion>
              )}
              <Accordion title="Précommande & livraison">
                <p>
                  {settings.deposit_percentage < 100 ? `Vous réglez un acompte de ${settings.deposit_percentage} % à la précommande, le solde avant la livraison.` : 'Vous réglez le montant total à la commande.'} Votre pièce est préparée, contrôlée puis livrée sous {settings.delivery_days_min} à{' '}
                  {settings.delivery_days_max} jours. Suivez chaque étape depuis la page <Link to="/track" className="text-gold underline">Suivi</Link>.
                </p>
              </Accordion>
            </div>
          </div>
        </div>
      </section>

      <ProductReviews productId={product.id} slug={product.slug} name={product.name} />

      {related.length > 0 && (
        <section className="border-t border-white/5 py-20">
          <div className="container-custom">
            <p className="eyebrow mb-3">Vous aimerez aussi</p>
            <h2 className="mb-10 text-3xl md:text-4xl">Dans le même esprit</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 lg:gap-x-6">
              {related.slice(0, 4).map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {recentOthers.length > 0 && (
        <section className="bg-ivory py-16 text-primary-black">
          <div className="container-custom">
            <h2 className="mb-8 text-2xl">Récemment consultés</h2>
            <div className="no-scrollbar flex gap-4 overflow-x-auto">
              {recentOthers.map((r) => (
                <Link key={r.id} to={`/product/${r.slug}`} className="group w-40 flex-shrink-0">
                  <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-neutral-200">
                    {r.image && <img src={r.image} alt={r.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />}
                  </div>
                  <p className="mt-2 line-clamp-1 text-sm font-medium">{r.name}</p>
                  <p className="text-sm text-gold-dark">{formatCurrency(r.price)}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <SizeGuide open={guideOpen} onClose={() => setGuideOpen(false)} initial={category?.sizeSystem === 'shoes' ? 'shoes' : product.gender === 'kids' ? 'kids' : 'apparel'} />
    </>
  )
}
