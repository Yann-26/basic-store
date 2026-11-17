import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { HiArrowRight } from 'react-icons/hi2'
import type { Exclusive, Product } from '@trs/shared'
import ProductCard, { ProductCardSkeleton } from '../components/products/ProductCard'
import { StarMark } from '../components/ui/Logo'
import { useSettings } from '../context/SettingsContext'
import { catalogService } from '../services/catalogService'

const PREVIEW = 8

interface Group {
  key: string
  exclusive: Exclusive | null
  items: Product[]
}

/** All exclusivités ("Exclu Nike JA Morant", …), each with a preview of its pieces. */
export default function Exclusives() {
  const { settings } = useSettings()
  const [exclusives, setExclusives] = useState<Exclusive[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ctrl = new AbortController()
    Promise.all([catalogService.getExclusives(), catalogService.getProducts({ exclusive: 'only', sort: 'newest', limit: 100 }, ctrl.signal)])
      .then(([list, page]) => {
        setExclusives(list)
        setProducts(page.items)
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [])

  const groups = useMemo<Group[]>(() => {
    const byGroup = new Map<string, Product[]>()
    for (const p of products) {
      const key = p.exclusive_id ?? 'other'
      byGroup.set(key, [...(byGroup.get(key) ?? []), p])
    }
    // Every active exclusivité is listed, even before its pieces are added.
    const list: Group[] = exclusives.map((e) => ({ key: e.id, exclusive: e, items: byGroup.get(e.id) ?? [] }))
    const others = byGroup.get('other')
    if (others?.length) list.push({ key: 'other', exclusive: null, items: others })
    return list
  }, [exclusives, products])

  return (
    <>
      <Helmet>
        <title>{`Exclusivités | ${settings.store_name}`}</title>
        <meta name="description" content={`Pièces rares et premium, en séries limitées : les exclusivités ${settings.store_name}.`} />
      </Helmet>

      <section className="relative overflow-hidden border-b border-gold/20 bg-[radial-gradient(ellipse_at_top,rgb(var(--glow)/0.08),transparent_65%)] pb-14 pt-16 md:pb-20 md:pt-24">
        <StarMark className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 opacity-10" />
        <div className="container-custom relative">
          <p className="eyebrow mb-4">Pièces rares · Séries limitées</p>
          <h1 className="text-5xl font-semibold md:text-7xl">
            Les <span className="text-gold-gradient italic">Exclusivités</span>
          </h1>
          <p className="mt-5 max-w-2xl text-gray-400">
            Nos pièces les plus rares et premium, sélectionnées maison par maison. Elles ne sont proposées qu'ici, en quantités limitées.
          </p>
          {groups.filter((g) => g.exclusive).length > 1 && (
            <nav className="mt-8 flex flex-wrap gap-2" aria-label="Exclusivités">
              {groups
                .filter((g) => g.exclusive)
                .map((g) => (
                  <a key={g.key} href={`#${g.exclusive!.slug}`} className="rounded-full border border-gold/40 px-5 py-2 text-xs uppercase tracking-[0.2em] text-gold transition-colors hover:bg-gold hover:text-primary-black">
                    Exclu {g.exclusive!.name}
                  </a>
                ))}
            </nav>
          )}
        </div>
      </section>

      {loading ? (
        <section className="container-custom py-16">
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 lg:gap-x-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </section>
      ) : groups.length === 0 ? (
        <section className="container-custom py-28 text-center">
          <p className="font-display text-6xl text-gold/40">★</p>
          <h2 className="mt-6 text-3xl">De nouvelles exclusivités arrivent bientôt</h2>
          <Link to="/collection" className="mt-6 inline-block text-sm uppercase tracking-[0.2em] text-gold hover:underline">
            Découvrir la boutique
          </Link>
        </section>
      ) : (
        groups.map((g) => (
          <section key={g.key} id={g.exclusive?.slug} className="container-custom scroll-mt-28 border-b border-white/5 py-14 last:border-0 md:py-20">
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="eyebrow mb-2">Exclusivité</p>
                <h2 className="text-3xl font-semibold md:text-5xl">
                  Exclu <span className="text-gold-gradient">{g.exclusive?.name ?? 'Autres pièces'}</span>
                </h2>
                {g.exclusive?.description && <p className="mt-3 max-w-2xl text-sm text-gray-400">{g.exclusive.description}</p>}
              </div>
              {g.exclusive && g.items.length > 0 && (
                <Link to={`/exclusivites/${g.exclusive.slug}`} className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-gold hover:underline">
                  Voir les {g.items.length} pièces <HiArrowRight />
                </Link>
              )}
            </div>
            {g.items.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gold/30 px-6 py-14 text-center">
                <p className="font-display text-4xl text-gold/50">★</p>
                <p className="mt-3 text-lg">Les pièces de cette exclusivité arrivent bientôt.</p>
                <p className="mt-1 text-sm text-gray-500">Revenez très vite, ou suivez-nous sur Instagram pour la révélation.</p>
              </div>
            ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 lg:gap-x-6">
              {g.items.slice(0, g.exclusive ? PREVIEW : undefined).map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
            )}
          </section>
        ))
      )}
    </>
  )
}
