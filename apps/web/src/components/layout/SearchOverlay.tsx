import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { HiMagnifyingGlass, HiXMark, HiArrowRight } from 'react-icons/hi2'
import { formatCurrency, PRODUCT_CATEGORIES, type Product } from '@trs/shared'
import { catalogService } from '../../services/catalogService'
import { mainImage } from '../../context/WishlistContext'
import { useDebounce } from '../../hooks/useDebounce'

export default function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const debounced = useDebounce(query.trim(), 300)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (debounced.length < 2) {
      setResults([])
      return
    }
    const ctrl = new AbortController()
    setLoading(true)
    catalogService
      .getProducts({ search: debounced, limit: 6 }, ctrl.signal)
      .then((page) => setResults(page.items))
      .catch(() => undefined)
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [debounced])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    navigate(`/collection?search=${encodeURIComponent(query.trim())}`)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-primary-black/95 backdrop-blur-xl">
          <div className="container-custom pt-8">
            <div className="flex justify-end">
              <button onClick={onClose} className="rounded-full p-2 text-gray-400 hover:text-white" aria-label="Fermer la recherche">
                <HiXMark className="h-7 w-7" />
              </button>
            </div>
            <form onSubmit={submit} className="mx-auto mt-6 max-w-3xl">
              <label htmlFor="site-search" className="eyebrow">
                Rechercher
              </label>
              <div className="mt-3 flex items-center gap-3 border-b border-gold/40 pb-3">
                <HiMagnifyingGlass className="h-7 w-7 text-gold" />
                <input
                  id="site-search"
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Robe, sneakers, sac, montre…"
                  className="w-full bg-transparent font-display text-2xl text-white placeholder:text-gray-600 focus:outline-none md:text-4xl"
                  autoComplete="off"
                />
              </div>
            </form>

            <div className="mx-auto mt-8 max-w-3xl">
              {debounced.length < 2 ? (
                <div className="flex flex-wrap gap-2">
                  {PRODUCT_CATEGORIES.map((c) => (
                    <Link key={c.id} to={`/collection?category=${c.id}`} onClick={onClose} className="rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300 hover:border-gold hover:text-gold">
                      {c.label}
                    </Link>
                  ))}
                </div>
              ) : loading ? (
                <p className="text-gray-500">Recherche…</p>
              ) : results.length === 0 ? (
                <p className="text-gray-500">Aucun résultat pour « {debounced} ».</p>
              ) : (
                <ul className="divide-y divide-white/5">
                  {results.map((p) => (
                    <li key={p.id}>
                      <Link to={`/product/${p.slug}`} onClick={onClose} className="group flex items-center gap-4 py-3">
                        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-dark-700">
                          {mainImage(p) && <img src={mainImage(p)} alt="" className="h-full w-full object-cover" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium group-hover:text-gold">{p.name}</p>
                          <p className="text-sm text-gray-500">{PRODUCT_CATEGORIES.find((c) => c.id === p.category)?.label}</p>
                        </div>
                        <span className="font-semibold text-gold">{formatCurrency(p.price)}</span>
                      </Link>
                    </li>
                  ))}
                  <li className="pt-4">
                    <button onClick={submit} className="inline-flex items-center gap-2 text-sm text-gold hover:underline">
                      Voir tous les résultats <HiArrowRight />
                    </button>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
