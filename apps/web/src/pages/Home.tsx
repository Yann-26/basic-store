import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { getCategory, type Product } from '@trs/shared'
import { useSettings } from '../context/SettingsContext'
import { mainImage } from '../context/WishlistContext'
import { catalogService } from '../services/catalogService'
import { CampaignFull, CampaignPair, EditPair, type CampaignTile } from '../components/home/Campaign'
import HeroAd from '../components/home/HeroAd'
import Lookbook from '../components/home/Lookbook'
import NewIn from '../components/home/NewIn'
import Rack from '../components/home/Rack'
import Piece3D from '../components/home/Piece3D'
import { useCountdown } from '../components/home/useCountdown'
import DropCalendarSection from '../components/drops/DropCalendarSection'

const pad = (n: number) => String(n).padStart(2, '0')

/** The launch countdown under the opening title (Vitrine → layout "Lancement"). */
function LaunchLine({ at }: { at: string }) {
  const left = useCountdown(at)
  if (!left || left.done) return null
  return (
    <p className="mt-4 text-sm font-medium uppercase tracking-[0.12em] tabular-nums">
      Lancement dans {left.days > 0 && `${left.days} j `}
      {pad(left.hours)} h {pad(left.minutes)} min {pad(left.seconds)} s
    </p>
  )
}

/** A second photo of a piece when it has one, so the tiles don't repeat the shop's packshots. */
function secondImage(p: Product): string {
  const images = (p.product_media ?? []).filter((m) => m.media_type === 'image' && m.file_path)
  return images.find((m) => !m.is_main)?.file_path ?? mainImage(p)
}

/**
 * Editorial home on a white page: one campaign across the full width, two
 * side by side, the new pieces in a row, the shootings (Lookbook), the piece to turn in 3D, smaller
 * edits by category, and the next drop. An advertising visual set in Vitrine
 * shows above the opening (or replaces it). Pictures carry the page; nothing moves
 * on its own.
 */
export default function Home() {
  const { settings } = useSettings()
  const [products, setProducts] = useState<Product[]>([])
  const [spotlight, setSpotlight] = useState<Product | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    catalogService
      .getProducts({ sort: 'newest', limit: 16 }, ctrl.signal)
      .then((page) => setProducts(page.items))
      .catch(() => undefined)
    return () => ctrl.abort()
  }, [])

  // The piece put forward in Vitrine opens the page.
  const slug = settings.spotlight_enabled ? settings.spotlight_product_slug : ''
  useEffect(() => {
    if (!slug) return setSpotlight(null)
    let alive = true
    catalogService
      .getProduct(slug)
      .then((p) => alive && setSpotlight(p))
      .catch(() => alive && setSpotlight(null))
    return () => {
      alive = false
    }
  }, [slug])

  const withPhoto = products.filter((p) => mainImage(p))
  const newest = withPhoto[0]

  const hero: CampaignTile | null = spotlight
    ? {
        key: 'spotlight',
        image: settings.spotlight_photo || mainImage(spotlight),
        title: settings.spotlight_title || spotlight.name,
        to: `/product/${spotlight.slug}`,
        cta: settings.spotlight_cta_label || 'Découvrir la pièce',
      }
    : settings.hero_background_desktop || newest
      ? {
          key: 'hero',
          image: settings.hero_background_desktop || mainImage(newest!),
          mobileImage: settings.hero_background_mobile || undefined,
          title: (settings.hero_title || settings.store_tagline).replace(/\\n|\n/g, ' ').trim(),
          to: '/collection?sort=newest',
          cta: settings.hero_cta_primary || 'Découvrir les nouveautés',
        }
      : null

  // Two campaigns side by side: the newest pieces worn (the shootings have their own section, Lookbook).
  const pair: CampaignTile[] = withPhoto
    .filter((p) => p.id !== spotlight?.id && p.id !== newest?.id)
    .slice(0, 2)
    .map((p) => ({ key: p.id, image: secondImage(p), title: p.name, to: `/product/${p.slug}`, cta: 'Découvrir' }))

  // The piece to turn in 3D: the one in the spotlight when it has a model, else the newest that has one.
  const piece3d = spotlight?.model_3d ? spotlight : (products.find((p) => p.model_3d) ?? null)

  // Edits: one tile per category that has a photographed piece (two or four).
  const edits: CampaignTile[] = []
  for (const p of withPhoto) {
    if (edits.some((e) => e.key === p.category)) continue
    edits.push({ key: p.category, image: secondImage(p), title: getCategory(p.category)?.label ?? p.category, to: `/collection?category=${p.category}`, cta: 'Voir la sélection' })
  }
  const editTiles = edits.slice(0, edits.length >= 4 ? 4 : 2)

  const hasAd = settings.hero_ad_enabled && Boolean(settings.hero_ad_desktop || settings.hero_ad_mobile)
  const launchAt = spotlight && settings.spotlight_layout === 'launch' ? settings.spotlight_launch_at : ''

  return (
    <>
      <Helmet>
        <title>{settings.seo_title}</title>
        <meta name="description" content={settings.seo_description} />
        <meta name="keywords" content={settings.seo_keywords} />
      </Helmet>
      {/* Vitrine → Publicité du hero: above the opening, or in its place. */}
      {hasAd && <HeroAd settings={settings} />}
      {hero && !(hasAd && settings.hero_ad_position === 'replace') && (
        <CampaignFull tile={hero} eyebrow={spotlight ? settings.spotlight_eyebrow : undefined}>
          {launchAt && <LaunchLine at={launchAt} />}
        </CampaignFull>
      )}
      {pair.length === 2 && <CampaignPair tiles={[pair[0]!, pair[1]!]} />}
      <NewIn products={products} />
      <Rack products={products} />
      <Lookbook />
      <Piece3D product={piece3d} />
      {edits.length >= 2 && <EditPair tiles={editTiles} />}
      <DropCalendarSection />
    </>
  )
}
