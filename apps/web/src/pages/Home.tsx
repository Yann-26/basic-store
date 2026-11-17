import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { HiOutlineCube, HiOutlineArrowPath, HiOutlineBanknotes, HiOutlineChatBubbleLeftRight } from 'react-icons/hi2'
import { PRODUCT_CATEGORIES, type Product } from '@trs/shared'
import { useSettings } from '../context/SettingsContext'
import { mainImage } from '../context/WishlistContext'
import { catalogService } from '../services/catalogService'
import { whatsappLink } from '../utils/constants'
import ProductCard, { ProductCardSkeleton } from '../components/products/ProductCard'
import HeroAd from '../components/home/HeroAd'
import Lookbook from '../components/home/Lookbook'
import NewIn from '../components/home/NewIn'
import Rack from '../components/home/Rack'

/** The opening: words on the left, the campaign photo on the right (Vitrine sets both). */
function Hero({ image, mobileImage, title, subtitle }: { image: string; mobileImage?: string; title: string; subtitle: string }) {
  const lines = title.split(/\\n|\n/).map((l) => l.trim()).filter(Boolean)
  return (
    <section className="relative overflow-hidden bg-[#77726B] text-[#F6F3EE]">
      {image && (
        <picture className="absolute inset-0 block md:left-[38%]">
          {mobileImage && <source media="(max-width: 767px)" srcSet={mobileImage} />}
          <img src={image} alt="" className="h-full w-full object-cover object-center" fetchPriority="high" />
        </picture>
      )}
      {/* Keeps the words readable over the photo on a phone, and blends it into the grey on a computer. */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent md:bg-gradient-to-r md:from-[#77726B] md:via-[#77726B]/70 md:to-transparent md:via-40%" />
      <div className="container-custom relative flex min-h-[30rem] items-end pb-14 pt-24 md:min-h-[34rem] md:items-center md:py-20">
        <div className="max-w-md">
          <p className="text-sm tracking-[0.02em] text-[#F6F3EE]/85">Boutique Angré · Abidjan</p>
          <h1 className="mt-4 text-5xl leading-[1.05] text-[#F6F3EE] md:text-6xl">
            {lines.map((l, i) => (
              <span key={i} className="block">
                {l}
              </span>
            ))}
          </h1>
          <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-[#F6F3EE]/90">{subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/collection?gender=women" className="bg-[#111] px-6 py-3.5 text-xs font-medium uppercase tracking-[0.14em] text-white transition-colors hover:bg-black">
              Shop femme
            </Link>
            <Link to="/collection?gender=men" className="bg-[#F6F3EE] px-6 py-3.5 text-xs font-medium uppercase tracking-[0.14em] text-[#111] transition-colors hover:bg-white">
              Shop homme
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

/** "Acheter par catégorie": the list of categories beside four pieces of the chosen one. */
function ShopByCategory({ products, loading }: { products: Product[]; loading: boolean }) {
  const present = PRODUCT_CATEGORIES.filter((c) => products.some((p) => p.category === c.id))
  const [active, setActive] = useState<string>('')
  const current = active || present[0]?.id || ''
  const shown = products.filter((p) => !current || p.category === current).slice(0, 4)

  if (!loading && products.length === 0) return null
  return (
    <section aria-labelledby="by-category" className="container-custom py-14 md:py-20">
      <div className="grid gap-10 lg:grid-cols-[13rem_1fr]">
        <div>
          <h2 id="by-category" className="text-3xl">
            Acheter par catégorie
          </h2>
          <ul className="mt-6 flex gap-5 overflow-x-auto text-sm lg:flex-col lg:gap-3" role="tablist">
            {(present.length ? present : PRODUCT_CATEGORIES).map((c) => (
              <li key={c.id}>
                <button
                  role="tab"
                  aria-selected={current === c.id}
                  onClick={() => setActive(c.id)}
                  className={current === c.id ? 'whitespace-nowrap font-medium text-white' : 'whitespace-nowrap text-gray-500 transition-colors hover:text-white'}
                >
                  {c.label}
                </button>
              </li>
            ))}
          </ul>
          <Link to={current ? `/collection?category=${current}` : '/collection'} className="mt-8 inline-block border-b border-white pb-1 text-xs font-medium uppercase tracking-[0.14em]">
            Voir tout
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
          {loading ? Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />) : shown.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </div>
    </section>
  )
}

/** The four promises of the shop, in a band. */
function ServiceBar({ whatsapp, address }: { whatsapp: string; address: string }) {
  const items = [
    { icon: HiOutlineCube, title: 'Livraison partout en CI', text: 'Abidjan en 24–48 h, intérieur du pays' },
    { icon: HiOutlineBanknotes, title: 'Paiement à la livraison', text: 'Espèces, Mobile Money ou en ligne' },
    { icon: HiOutlineArrowPath, title: 'Échange facile', text: 'Sous 48 h, article non porté' },
    { icon: HiOutlineChatBubbleLeftRight, title: 'Conseil sur WhatsApp', text: address ? `Boutique : ${address}` : 'Une question ? On vous répond' },
  ]
  return (
    <section aria-label="Nos services" className="bg-dark-700">
      <ul className="container-custom grid grid-cols-2 gap-6 py-8 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, text }, i) => {
          const body = (
            <>
              <Icon className="h-6 w-6 flex-shrink-0 text-gray-400" />
              <span>
                <span className="block text-[13px] font-medium">{title}</span>
                <span className="mt-0.5 block text-xs text-gray-500">{text}</span>
              </span>
            </>
          )
          return (
            <li key={title}>
              {i === 3 && whatsapp ? (
                <a href={whatsappLink(whatsapp, 'Bonjour Basic Store !')} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 hover:opacity-70">
                  {body}
                </a>
              ) : (
                <div className="flex items-start gap-3">{body}</div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * Home: the opening (photo and two doors, femme / homme), shopping by category,
 * the shop's promises, the newest arrivals, then the optional marketing blocks
 * set in the back-office (lookbook, the rack).
 */
export default function Home() {
  const { settings } = useSettings()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ctrl = new AbortController()
    catalogService
      .getProducts({ sort: 'newest', limit: 40 }, ctrl.signal)
      .then((page) => setProducts(page.items))
      .catch(() => undefined)
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [])

  const withPhoto = products.filter((p) => mainImage(p))
  const heroImage = settings.hero_background_desktop || (withPhoto[0] ? mainImage(withPhoto[0]) : '')
  const hasAd = settings.hero_ad_enabled && Boolean(settings.hero_ad_desktop || settings.hero_ad_mobile)

  return (
    <>
      <Helmet>
        <title>{settings.seo_title}</title>
        <meta name="description" content={settings.seo_description} />
        <meta name="keywords" content={settings.seo_keywords} />
      </Helmet>
      {/* Vitrine → Publicité du hero: above the opening, or in its place. */}
      {hasAd && <HeroAd settings={settings} />}
      {!(hasAd && settings.hero_ad_position === 'replace') && (
        <Hero
          image={heroImage}
          mobileImage={settings.hero_background_mobile || undefined}
          title={settings.hero_title || 'La qualité.\nÀ bon prix.'}
          subtitle={settings.hero_subtitle || 'Vêtements, chaussures et accessoires sélectionnés pour vous. Commandez en ligne, on livre partout en Côte d’Ivoire.'}
        />
      )}
      <ShopByCategory products={products} loading={loading} />
      <ServiceBar whatsapp={settings.store_whatsapp} address={settings.store_address} />
      <NewIn products={products} />
      <Lookbook />
      <Rack products={products} />
    </>
  )
}
