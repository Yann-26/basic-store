import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { HiAdjustmentsHorizontal, HiMagnifyingGlass, HiXMark } from 'react-icons/hi2'
import {
  GENDERS,
  PRODUCT_CATEGORIES,
  PRODUCT_SORTS,
  SIZE_SYSTEMS,
  getCategory,
  type Product,
  type ProductListQuery,
} from '@trs/shared'
import { catalogService } from '../services/catalogService'
import { useSettings } from '../context/SettingsContext'
import { useDebounce } from '../hooks/useDebounce'
import ProductCard, { ProductCardSkeleton } from '../components/products/ProductCard'
import ExclusiveBanner from '../components/exclusives/ExclusiveBanner'
import Button from '../components/ui/Button'

const PAGE_SIZE = 24
const PRICE_RANGES = [
  { id: '', label: 'Tous les prix' },
  { id: '0-25000', label: 'Moins de 25 000 F' },
  { id: '25000-50000', label: '25 000 – 50 000 F' },
  { id: '50000-100000', label: '50 000 – 100 000 F' },
  { id: '100000-', label: 'Plus de 100 000 F' },
]

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'rounded-full border px-3.5 py-1.5 text-xs transition-colors',
        active ? 'border-gold bg-gold text-primary-black' : 'border-white/10 text-gray-300 hover:border-gold/60',
      )}
    >
      {children}
    </button>
  )
}

export default function CollectionPage() {
  const [params, setParams] = useSearchParams()
  const { settings } = useSettings()
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useState(params.get('search') ?? '')
  const debouncedSearch = useDebounce(search)

  const category = params.get('category') ?? ''
  const subcategory = params.get('subcategory') ?? ''
  const gender = params.get('gender') ?? ''
  const size = params.get('size') ?? ''
  const price = params.get('price') ?? ''
  const sort = params.get('sort') ?? 'shuffle'
  const cat = getCategory(category || undefined)
  const sizeOptions = category ? SIZE_SYSTEMS[cat?.sizeSystem ?? 'custom'].sizes.filter((s) => s !== 'TU') : []

  const query = useMemo<ProductListQuery>(() => {
    const [min, max] = price.split('-')
    return {
      category: category || undefined,
      subcategory: subcategory || undefined,
      gender: gender || undefined,
      size: size || undefined,
      search: params.get('search') || undefined,
      minPrice: min ? Number(min) : undefined,
      maxPrice: max ? Number(max) : undefined,
      sort,
      limit: PAGE_SIZE,
    }
  }, [category, subcategory, gender, size, price, sort, params])

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }

  // Keep the search box and the URL in sync (debounced).
  useEffect(() => {
    if ((params.get('search') ?? '') !== debouncedSearch.trim()) update({ search: debouncedSearch.trim() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    catalogService
      .getProducts(query, ctrl.signal)
      .then((page) => {
        setProducts(page.items)
        setTotal(page.total)
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setProducts([])
      })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [query])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const page = await catalogService.getProducts({ ...query, offset: products.length })
      setProducts((prev) => [...prev, ...page.items])
      setTotal(page.total)
    } finally {
      setLoadingMore(false)
    }
  }

  const activeCount = [subcategory, gender, size, price].filter(Boolean).length
  const title = cat?.label ?? (gender ? GENDERS.find((g) => g.id === gender)?.label : null) ?? 'La Boutique'

  const filters = (
    <div className="space-y-8">
      <div>
        <p className="eyebrow mb-3">Catégorie</p>
        <div className="flex flex-wrap gap-2">
          <Chip active={!category} onClick={() => update({ category: '', subcategory: '', size: '' })}>
            Tout
          </Chip>
          {PRODUCT_CATEGORIES.map((c) => (
            <Chip key={c.id} active={category === c.id} onClick={() => update({ category: c.id, subcategory: '', size: '' })}>
              {c.label}
            </Chip>
          ))}
        </div>
      </div>
      {cat && (
        <div>
          <p className="eyebrow mb-3">Type</p>
          <div className="flex flex-wrap gap-2">
            {cat.subcategories.map((s) => (
              <Chip key={s} active={subcategory === s} onClick={() => update({ subcategory: subcategory === s ? '' : s })}>
                {s}
              </Chip>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="eyebrow mb-3">Pour</p>
        <div className="flex flex-wrap gap-2">
          {GENDERS.map((g) => (
            <Chip key={g.id} active={gender === g.id} onClick={() => update({ gender: gender === g.id ? '' : g.id })}>
              {g.label}
            </Chip>
          ))}
        </div>
      </div>
      {sizeOptions.length > 0 && (
        <div>
          <p className="eyebrow mb-3">{SIZE_SYSTEMS[cat!.sizeSystem].label}</p>
          <div className="flex flex-wrap gap-2">
            {sizeOptions.map((s) => (
              <Chip key={s} active={size === s} onClick={() => update({ size: size === s ? '' : s })}>
                {s}
              </Chip>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="eyebrow mb-3">Prix</p>
        <div className="flex flex-wrap gap-2">
          {PRICE_RANGES.map((r) => (
            <Chip key={r.id} active={price === r.id} onClick={() => update({ price: r.id })}>
              {r.label}
            </Chip>
          ))}
        </div>
      </div>
      {activeCount > 0 && (
        <button onClick={() => update({ subcategory: '', gender: '', size: '', price: '' })} className="text-xs uppercase tracking-widest text-gray-400 underline hover:text-gold">
          Réinitialiser les filtres
        </button>
      )}
    </div>
  )

  return (
    <>
      <Helmet>
        <title>{`${title} | ${settings.store_name}`}</title>
        <meta name="description" content={cat?.description ?? 'Vêtements, chaussures, sacs, bijoux et accessoires premium en précommande.'} />
      </Helmet>

      <section className="border-b border-white/5 bg-[radial-gradient(ellipse_at_top,rgb(var(--glow)/0.12),transparent_60%)] pb-10 pt-14">
        <div className="container-custom">
          <p className="eyebrow mb-3">{subcategory || 'Collection'}</p>
          <h1 className="text-4xl font-semibold md:text-6xl">{title}</h1>
          <p className="mt-3 max-w-xl text-gray-400">{cat?.description ?? 'Toutes nos pièces, de la tête aux pieds.'}</p>
        </div>
      </section>

      <section className="container-custom py-10">
        <ExclusiveBanner compact className="mb-10" />
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <HiMagnifyingGlass className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une pièce…" className="field !rounded-full pl-12" aria-label="Rechercher" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setFiltersOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 text-xs uppercase tracking-widest lg:hidden">
              <HiAdjustmentsHorizontal className="h-4 w-4" /> Filtres {activeCount > 0 && <span className="rounded-full bg-gold px-1.5 text-primary-black">{activeCount}</span>}
            </button>
            <select value={sort} onChange={(e) => update({ sort: e.target.value })} className="field !w-auto !rounded-full" aria-label="Trier">
              {PRODUCT_SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[260px_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-28">{filters}</div>
          </aside>

          <div>
            <p className="mb-6 text-sm text-gray-500">
              {loading ? 'Chargement…' : `${total} pièce${total > 1 ? 's' : ''}`}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:gap-x-6">
              {loading ? Array.from({ length: 9 }).map((_, i) => <ProductCardSkeleton key={i} />) : products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
            </div>
            {!loading && products.length === 0 && (
              <div className="rounded-3xl border border-dashed border-white/10 py-20 text-center">
                <p className="font-display text-2xl">Aucune pièce ne correspond</p>
                <p className="mt-2 text-sm text-gray-500">Essayez d'élargir vos filtres ou votre recherche.</p>
              </div>
            )}
            {!loading && products.length < total && (
              <div className="mt-14 text-center">
                <p className="mb-4 text-xs text-gray-500">
                  {products.length} sur {total}
                </p>
                <Button variant="outline" onClick={loadMore} loading={loadingMore}>
                  Voir plus
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      <AnimatePresence>
        {filtersOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/70 lg:hidden" onClick={() => setFiltersOpen(false)} />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 260 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-gold/30 bg-dark-800 p-6 lg:hidden"
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="font-display text-2xl">Filtres</h2>
                <button onClick={() => setFiltersOpen(false)} aria-label="Fermer les filtres">
                  <HiXMark className="h-6 w-6" />
                </button>
              </div>
              {filters}
              <Button className="mt-8 w-full" onClick={() => setFiltersOpen(false)}>
                Voir {total} pièce{total > 1 ? 's' : ''}
              </Button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
