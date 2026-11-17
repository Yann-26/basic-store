import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { HiMagnifyingGlass } from 'react-icons/hi2'
import { formatCurrency, isValidOrderNumber, ONE_SIZE, ORDER_STATUS_LABELS, formatPieceNumbers } from '@trs/shared'
import { engagementService, type TrackingView } from '../services/engagementService'
import { PAYMENT_STATUS_LABELS } from '../services/ordersService'
import { errorMessage } from '../core/http'
import { useSettings } from '../context/SettingsContext'
import OrderTimeline from '../components/orders/OrderTimeline'
import Button from '../components/ui/Button'

export default function TrackOrder() {
  const [params, setParams] = useSearchParams()
  const [number, setNumber] = useState(params.get('number') ?? '')
  const [data, setData] = useState<TrackingView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { settings } = useSettings()

  const search = useCallback(
    async (value: string) => {
      const n = value.trim().toUpperCase()
      if (!isValidOrderNumber(n)) {
        setError('Format attendu : SC-2026-7KQ4M2XA')
        return
      }
      setLoading(true)
      setError(null)
      try {
        setData(await engagementService.track(n))
        setParams({ number: n }, { replace: true })
      } catch (e) {
        setData(null)
        setError(errorMessage(e, 'Précommande introuvable'))
      } finally {
        setLoading(false)
      }
    },
    [setParams],
  )

  useEffect(() => {
    const initial = params.get('number')
    if (initial) void search(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <Helmet>
        <title>{`Suivre ma commande | ${settings.store_name}`}</title>
      </Helmet>
      <section className="border-b border-white/5 bg-[radial-gradient(ellipse_at_top,rgb(var(--glow)/0.12),transparent_60%)] py-16">
        <div className="container-custom max-w-2xl text-center">
          <p className="eyebrow mb-3">Suivi en temps réel</p>
          <h1 className="text-4xl font-semibold md:text-5xl">Où en est ma commande ?</h1>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void search(number)
            }}
            className="mt-10 flex flex-col gap-3 sm:flex-row"
          >
            <div className="relative flex-1">
              <HiMagnifyingGlass className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
              <input
                value={number}
                onChange={(e) => setNumber(e.target.value.toUpperCase())}
                placeholder="SC-2026-7KQ4M2XA"
                className="field !rounded-full pl-12 font-mono tracking-wider"
                aria-label="Numéro de précommande"
              />
            </div>
            <Button type="submit" loading={loading}>
              Suivre
            </Button>
          </form>
          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
          <p className="mt-4 text-xs text-gray-500">Votre numéro figure dans l'email de confirmation.</p>
        </div>
      </section>

      {data && (
        <section className="container-custom grid max-w-5xl gap-8 py-14 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-3xl border border-white/5 bg-dark-800 p-6 md:p-8">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Précommande</p>
                <p className="font-mono text-2xl text-gold">{data.preorder_number}</p>
              </div>
              <span className="rounded-full border border-gold/40 px-4 py-1.5 text-xs uppercase tracking-widest text-gold">{ORDER_STATUS_LABELS[data.status]}</span>
            </div>
            <OrderTimeline status={data.status} timeline={data.timeline} />
          </div>
          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/5 bg-dark-800 p-6">
              <h2 className="mb-4 font-display text-xl">Articles</h2>
              <ul className="space-y-4">
                {data.items.map((i, idx) => (
                  <li key={idx} className="flex gap-3">
                    <div className="h-16 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-dark-700">{i.image && <img src={i.image} alt="" className="h-full w-full object-cover" />}</div>
                    <div className="min-w-0 flex-1 text-sm">
                      {i.product_slug ? (
                        <Link to={`/product/${i.product_slug}`} className="line-clamp-1 font-medium hover:text-gold">
                          {i.product_name}
                        </Link>
                      ) : (
                        <p className="line-clamp-1 font-medium">{i.product_name}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        {i.size && i.size !== ONE_SIZE ? `Taille ${i.size} · ` : ''}
                        {i.color ? `${i.color} · ` : ''}×{i.quantity}
                      </p>
                      {(i.piece_numbers ?? []).length > 0 && <p className="mt-1 text-xs font-medium text-gold">Pièce {formatPieceNumbers(i.piece_numbers, i.series_size)}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <dl className="space-y-3 rounded-3xl border border-white/5 bg-dark-800 p-6 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-400">Total</dt>
                <dd>{formatCurrency(data.total_price)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Acompte</dt>
                <dd className="text-gold">{formatCurrency(data.deposit_amount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Reste à payer</dt>
                <dd>{formatCurrency(data.remaining_amount)}</dd>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-3">
                <dt className="text-gray-400">Paiement</dt>
                <dd>{PAYMENT_STATUS_LABELS[data.payment_status] ?? data.payment_status}</dd>
              </div>
              {data.estimated_delivery && (
                <div className="flex justify-between">
                  <dt className="text-gray-400">Livraison estimée</dt>
                  <dd>{new Date(data.estimated_delivery).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</dd>
                </div>
              )}
            </dl>
          </aside>
        </section>
      )}
    </>
  )
}
