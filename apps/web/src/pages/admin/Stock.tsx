import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { HiMagnifyingGlass, HiPlus, HiMinus, HiArrowPath, HiExclamationTriangle } from 'react-icons/hi2'
import { MANUAL_STOCK_REASONS, STOCK_MOVEMENT_LABELS, formatCurrency, type ManualStockReason, type StockMovement } from '@trs/shared'
import { stockService, type StockProduct } from '../../services/stockService'
import { mainImage } from '../../context/WishlistContext'
import { errorMessage } from '../../core/http'
import { useDebounce } from '../../hooks/useDebounce'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'

const REASON_HINTS: Record<ManualStockReason, string> = {
  restock: 'Arrivage de marchandise : ajoute des pièces.',
  sale_in_store: 'Vendu directement en boutique : retire des pièces.',
  adjustment: 'Inventaire, pièce abîmée ou perdue : ajoute ou retire.',
}

/** The quantities of a product: one per size, or a single one. */
function sizeRows(p: StockProduct): { size: string | null; quantity: number }[] {
  return p.sizes.length > 0 ? p.sizes.map((s) => ({ size: s, quantity: p.size_stock?.[s] ?? 0 })) : [{ size: null, quantity: p.stock }]
}

function AdjustModal({ product, onClose, onDone }: { product: StockProduct | null; onClose: () => void; onDone: () => void }) {
  const [size, setSize] = useState<string>('')
  const [reason, setReason] = useState<ManualStockReason>('restock')
  const [direction, setDirection] = useState<1 | -1>(1)
  const [quantity, setQuantity] = useState('1')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!product) return
    setSize(product.sizes[0] ?? '')
    setReason('restock')
    setDirection(1)
    setQuantity('1')
    setNote('')
  }, [product])

  useEffect(() => {
    if (reason === 'restock') setDirection(1)
    if (reason === 'sale_in_store') setDirection(-1)
  }, [reason])

  if (!product) return null
  const current = product.sizes.length ? (product.size_stock?.[size] ?? 0) : product.stock
  const qty = Math.max(0, Math.round(Number(quantity) || 0))
  const next = current + direction * qty

  const save = async () => {
    if (qty <= 0) return toast.error('Indiquez une quantité')
    if (next < 0) return toast.error(`Il n’y a que ${current} pièce(s) en stock`)
    setSaving(true)
    try {
      await stockService.adjust({ product_id: product.id, size: product.sizes.length ? size : null, delta: direction * qty, reason, note: note.trim() || undefined })
      toast.success(`Stock mis à jour : ${next} pièce(s)${product.sizes.length ? ` en ${size}` : ''}`)
      onDone()
      onClose()
    } catch (e) {
      toast.error(errorMessage(e, 'Mise à jour impossible'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={!!product} onClose={onClose} title={`Stock — ${product.name}`}>
      <div className="space-y-5">
        {product.sizes.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-gray-300">Taille</p>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  className={clsx('min-w-14 rounded-xl border px-3 py-2 text-sm', size === s ? 'border-gold bg-gold text-primary-black' : 'border-white/10 text-gray-300')}
                >
                  {s} <span className="opacity-60">({product.size_stock?.[s] ?? 0})</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-gray-300">Motif</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {MANUAL_STOCK_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={clsx('rounded-xl border px-3 py-2 text-sm', reason === r ? 'border-gold bg-gold/10 text-gold' : 'border-white/10 text-gray-300')}
              >
                {STOCK_MOVEMENT_LABELS[r]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">{REASON_HINTS[reason]}</p>
        </div>
        <div className="flex items-end gap-3">
          {reason === 'adjustment' && (
            <div className="flex rounded-xl border border-white/10">
              <button type="button" onClick={() => setDirection(1)} className={clsx('p-3', direction === 1 ? 'text-gold' : 'text-gray-500')} aria-label="Ajouter" aria-pressed={direction === 1}>
                <HiPlus className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setDirection(-1)} className={clsx('p-3', direction === -1 ? 'text-gold' : 'text-gray-500')} aria-label="Retirer" aria-pressed={direction === -1}>
                <HiMinus className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="flex-1">
            <Input label={direction === 1 ? 'Pièces ajoutées' : 'Pièces retirées'} type="number" min={1} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
        </div>
        <Input label="Note (optionnel)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex : arrivage fournisseur du 12/11" />
        <p className={clsx('rounded-xl p-3 text-sm', next < 0 ? 'bg-red-500/10 text-red-300' : 'bg-white/5 text-gray-300')}>
          {current} → <strong className="text-white">{next}</strong> pièce(s){product.sizes.length ? ` en ${size}` : ''}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} loading={saving} disabled={qty <= 0 || next < 0}>
            Enregistrer
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function Movements({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<StockMovement[] | null>(null)
  useEffect(() => {
    stockService
      .movements({ limit: 30 })
      .then((r) => setRows(r.movements))
      .catch(() => setRows([]))
  }, [refreshKey])
  return (
    <section className="rounded-2xl border border-dark-600 bg-dark-800">
      <h2 className="border-b border-dark-600 p-4 text-sm font-semibold uppercase tracking-[0.15em]">Derniers mouvements</h2>
      {rows === null ? (
        <div className="py-10">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <p className="p-6 text-sm text-gray-500">Aucun mouvement pour l’instant.</p>
      ) : (
        <ul className="divide-y divide-dark-600 text-sm">
          {rows.map((m) => (
            <li key={m.id} className="flex items-center gap-3 p-4">
              <span className={clsx('w-12 text-right font-semibold tabular-nums', m.delta > 0 ? 'text-emerald-400' : 'text-red-400')}>
                {m.delta > 0 ? `+${m.delta}` : m.delta}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  {m.product_name}
                  {m.size && <span className="text-gray-500"> · {m.size}</span>}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {STOCK_MOVEMENT_LABELS[m.reason]}
                  {m.note ? ` — ${m.note}` : ''}
                </p>
              </div>
              <time className="text-xs text-gray-500">{new Date(m.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Back-office: what is on the shelves, size by size, and every movement of the stock. */
export default function AdminStock() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [lowOnly, setLowOnly] = useState(params.get('low') === '1')
  const debounced = useDebounce(search, 300)
  const [items, setItems] = useState<StockProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [adjusting, setAdjusting] = useState<StockProduct | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const page = await stockService.overview({ search: debounced, low: lowOnly, limit: 100 })
      setItems(page.items)
    } catch (e) {
      toast.error(errorMessage(e, 'Erreur de chargement du stock'))
    } finally {
      setLoading(false)
    }
  }, [debounced, lowOnly])

  useEffect(() => {
    void load()
    setParams((p) => {
      const next = new URLSearchParams(p)
      if (debounced) next.set('q', debounced)
      else next.delete('q')
      if (lowOnly) next.set('low', '1')
      else next.delete('low')
      return next
    }, { replace: true })
  }, [load, debounced, lowOnly, setParams])

  const out = items.filter((p) => p.out).length
  const low = items.filter((p) => p.low).length
  const units = items.reduce((s, p) => s + p.total_stock, 0)
  const value = items.reduce((s, p) => s + p.total_stock * p.price, 0)

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold">Stock</h1>
          <p className="mt-1 text-gray-400">Les commandes en ligne réservent le stock ; une annulation ou un retour le remet en rayon.</p>
        </div>
        <Button variant="outline" icon={HiArrowPath} onClick={() => void load()}>
          Actualiser
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Pièces en stock', value: String(units) },
          { label: 'Valeur (prix de vente)', value: formatCurrency(value) },
          { label: 'Stock bas', value: String(low), tone: low ? 'text-amber-400' : '' },
          { label: 'Épuisés', value: String(out), tone: out ? 'text-red-400' : '' },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-dark-600 bg-dark-800 p-5">
            <p className="text-xs uppercase tracking-[0.15em] text-gray-500">{k.label}</p>
            <p className={clsx('mt-2 text-2xl font-semibold', k.tone)}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <HiMagnifyingGlass className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un produit…" className="field pl-11" />
        </div>
        <button
          onClick={() => setLowOnly((v) => !v)}
          aria-pressed={lowOnly}
          className={clsx('inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm', lowOnly ? 'border-amber-400 bg-amber-400/10 text-amber-300' : 'border-dark-600 text-gray-400')}
        >
          <HiExclamationTriangle className="h-4 w-4" /> Stock bas et épuisés
        </button>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.6fr_1fr]">
        <section className="overflow-x-auto rounded-2xl border border-dark-600 bg-dark-800">
          {loading ? (
            <div className="py-16">
              <Spinner />
            </div>
          ) : items.length === 0 ? (
            <p className="p-8 text-center text-gray-500">{lowOnly ? 'Aucun produit en stock bas. 👌' : 'Aucun produit.'}</p>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.12em] text-gray-500">
                  <th className="p-4">Produit</th>
                  <th className="p-4">Par taille</th>
                  <th className="p-4 text-right">Total</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-t border-dark-600">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-10 flex-shrink-0 overflow-hidden rounded bg-dark-700">{mainImage(p) && <img src={mainImage(p)} alt="" className="h-full w-full object-cover" />}</div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{p.name}</p>
                          <p className="text-xs text-gray-500">{formatCurrency(p.price)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5">
                        {sizeRows(p).map((r) => (
                          <span
                            key={r.size ?? 'tu'}
                            className={clsx(
                              'rounded-md px-2 py-0.5 text-xs tabular-nums',
                              r.quantity === 0 ? 'bg-red-500/10 text-red-300' : r.quantity <= (p.low_stock_threshold ?? 3) ? 'bg-amber-500/10 text-amber-300' : 'bg-white/5 text-gray-300',
                            )}
                          >
                            {r.size ? `${r.size} : ` : ''}
                            {r.quantity}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className={clsx('p-4 text-right font-semibold tabular-nums', p.out ? 'text-red-400' : p.low ? 'text-amber-400' : '')}>{p.total_stock}</td>
                    <td className="p-4 text-right">
                      <Button size="sm" variant="outline" onClick={() => setAdjusting(p)}>
                        Mouvement
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <Movements refreshKey={refreshKey} />
      </div>

      <AdjustModal
        product={adjusting}
        onClose={() => setAdjusting(null)}
        onDone={() => {
          void load()
          setRefreshKey((k) => k + 1)
        }}
      />
    </div>
  )
}
