import { useEffect, useMemo, useState } from 'react'
import { HiArrowDown, HiArrowUp, HiMagnifyingGlass, HiPlus, HiXMark } from 'react-icons/hi2'
import type { Product } from '@trs/shared'
import { productsService } from '../../services/productsService'
import Spinner from '../../components/ui/Spinner'

const SHOWCASE_MAX = 12

const thumb = (p: Product) => (p.product_media ?? []).find((m) => m.is_main && m.media_type === 'image')?.file_path ?? (p.product_media ?? []).find((m) => m.media_type === 'image')?.file_path

/** Picks and orders products (the home page's 3D ring by default; reused by Marketing). */
interface PickerProps {
  value: string[]
  onChange: (ids: string[]) => void
  /** Heading of the chosen list. */
  label?: string
  max?: number
  /** Shown while nothing is chosen. */
  emptyHint?: string
  /** Advice under a list shorter than this (3D ring: at least 3). */
  minAdvice?: { count: number; text: string } | null
}

export default function ShowcasePicker({
  value,
  onChange,
  label = 'Dans le présentoir',
  max = SHOWCASE_MAX,
  emptyHint = 'Aucun produit choisi : les 5 premiers produits ajoutés s’affichent.',
  minAdvice = { count: 3, text: 'Conseil : au moins 3 produits pour un bel effet 3D.' },
}: PickerProps) {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    productsService
      .getAll()
      .then(setProducts)
      .catch(() => setProducts([]))
  }, [])

  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products])
  const picked = value.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p))
  const candidates = (products ?? [])
    .filter((p) => !value.includes(p.id) && p.is_active)
    .filter((p) => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))
    .slice(0, 30)

  const move = (i: number, d: -1 | 1) => {
    const next = [...value]
    const j = i + d
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    onChange(next)
  }

  if (!products) return <Spinner size="sm" />

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-gray-300">
          {label} ({picked.length}/{max})
        </p>
        {picked.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">
            {emptyHint}
          </p>
        ) : (
          <ol className="space-y-2">
            {picked.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-dark-700 p-2 pr-3">
                <span className="w-5 text-center text-xs text-gray-500">{i + 1}</span>
                {thumb(p) ? <img src={thumb(p)} alt="" className="h-12 w-10 rounded-lg object-cover" /> : <span className="h-12 w-10 rounded-lg bg-dark-600" />}
                <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-full p-1.5 text-gray-400 hover:text-white disabled:opacity-30" aria-label={`Monter ${p.name}`}>
                  <HiArrowUp className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === picked.length - 1} className="rounded-full p-1.5 text-gray-400 hover:text-white disabled:opacity-30" aria-label={`Descendre ${p.name}`}>
                  <HiArrowDown className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => onChange(value.filter((id) => id !== p.id))} className="rounded-full p-1.5 text-gray-400 hover:text-red-400" aria-label={`Retirer ${p.name}`}>
                  <HiXMark className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ol>
        )}
        {minAdvice && picked.length > 0 && picked.length < minAdvice.count && <p className="mt-2 text-xs text-amber-300">{minAdvice.text}</p>}
      </div>

      <div>
        <label className="relative mb-2 block">
          <HiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un produit…" className="field pl-9" aria-label="Rechercher un produit" />
        </label>
        <ul className="max-h-80 space-y-1 overflow-y-auto pr-1">
          {candidates.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                disabled={value.length >= max}
                onClick={() => onChange([...value, p.id])}
                className="flex w-full items-center gap-3 rounded-2xl p-2 pr-3 text-left hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {thumb(p) ? <img src={thumb(p)} alt="" className="h-10 w-8 rounded-lg object-cover" /> : <span className="h-10 w-8 rounded-lg bg-dark-600" />}
                <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                <HiPlus className="h-4 w-4 text-gold" />
              </button>
            </li>
          ))}
          {candidates.length === 0 && <li className="p-3 text-sm text-gray-500">Aucun produit à ajouter.</li>}
        </ul>
      </div>
    </div>
  )
}
