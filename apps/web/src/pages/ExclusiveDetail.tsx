import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { HiArrowLeft } from 'react-icons/hi2'
import type { Exclusive, Product } from '@trs/shared'
import ProductCard, { ProductCardSkeleton } from '../components/products/ProductCard'
import Button from '../components/ui/Button'
import { StarMark } from '../components/ui/Logo'
import { useSettings } from '../context/SettingsContext'
import { catalogService } from '../services/catalogService'
import NotFound from './NotFound'

const PAGE_SIZE = 24

/** One exclusivité ("Exclu Nike JA Morant") with all its pieces. */
export default function ExclusiveDetail() {
  const { slug = '' } = useParams()
  const { settings } = useSettings()
  const [exclusive, setExclusive] = useState<Exclusive | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    setMissing(false)
    Promise.all([catalogService.getExclusive(slug), catalogService.getProducts({ exclusive: slug, sort: 'newest', limit: PAGE_SIZE }, ctrl.signal)])
      .then(([ex, page]) => {
        setExclusive(ex)
        setProducts(page.items)
        setTotal(page.total)
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setMissing(true)
      })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [slug])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const page = await catalogService.getProducts({ exclusive: slug, sort: 'newest', limit: PAGE_SIZE, offset: products.length })
      setProducts((prev) => [...prev, ...page.items])
      setTotal(page.total)
    } finally {
      setLoadingMore(false)
    }
  }

  if (missing) return <NotFound />

  return (
    <>
      <Helmet>
        <title>{`Exclu ${exclusive?.name ?? ''} | ${settings.store_name}`}</title>
        {exclusive?.description && <meta name="description" content={exclusive.description} />}
      </Helmet>

      <section className="relative overflow-hidden border-b border-gold/20 bg-[radial-gradient(ellipse_at_top,rgb(var(--glow)/0.08),transparent_65%)] pb-12 pt-14 md:pb-16 md:pt-20">
        {exclusive?.banner_url && <img src={exclusive.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />}
        <StarMark className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 opacity-10" />
        <div className="container-custom relative">
          <Link to="/exclusivites" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gold">
            <HiArrowLeft className="h-4 w-4" /> Toutes les exclusivités
          </Link>
          <p className="eyebrow mb-3 mt-6">Exclusivité</p>
          <h1 className="text-5xl font-semibold md:text-7xl">
            Exclu <span className="text-gold-gradient italic">{exclusive?.name ?? '…'}</span>
          </h1>
          {exclusive?.description && <p className="mt-4 max-w-2xl text-gray-400">{exclusive.description}</p>}
        </div>
      </section>

      <section className="container-custom py-12">
        <p className="mb-6 text-xs uppercase tracking-[0.2em] text-gray-500">{loading ? 'Chargement…' : `${total} pièce${total > 1 ? 's' : ''}`}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
          {loading ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />) : products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </div>
        {!loading && products.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/10 py-20 text-center">
            <p className="font-display text-2xl">Pièces bientôt disponibles</p>
          </div>
        )}
        {!loading && products.length < total && (
          <div className="mt-14 text-center">
            <Button variant="outline" onClick={loadMore} loading={loadingMore}>
              Voir plus
            </Button>
          </div>
        )}
      </section>
    </>
  )
}
