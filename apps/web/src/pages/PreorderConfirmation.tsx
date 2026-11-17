import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { FaWhatsapp } from 'react-icons/fa'
import { HiCheckBadge, HiClipboardDocument } from 'react-icons/hi2'
import { formatCurrency, ONE_SIZE, formatPieceNumbers } from '@trs/shared'
import { engagementService, type TrackingView } from '../services/engagementService'
import PaystackPay from '../components/payments/PaystackPay'
import ThankYouCard from '../components/payments/ThankYouCard'
import { readJSON } from '../core/storage'
import { useSettings } from '../context/SettingsContext'
import { whatsappLink } from '../utils/constants'
import OrderTimeline from '../components/orders/OrderTimeline'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import type { LastOrder } from './PreorderCheckout'

export default function PreorderConfirmation() {
  const { preorderNumber = '' } = useParams()
  const [params] = useSearchParams()
  const [data, setData] = useState<TrackingView | null>(null)
  const [loading, setLoading] = useState(true)
  const { settings } = useSettings()
  const last = readJSON<LastOrder | null>('last_order', null, 'session')
  const canPay = !!last && last.preorder_number === preorderNumber

  useEffect(() => {
    engagementService
      .track(preorderNumber)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [preorderNumber])

  const paid = params.get('paid') === '1' || (data && data.payment_status !== 'pending')

  const copy = async () => {
    await navigator.clipboard.writeText(preorderNumber).catch(() => undefined)
    toast.success('Numéro copié')
  }

  if (loading) return <div className="py-40"><Spinner /></div>

  return (
    <>
      <Helmet>
        <title>{`Précommande ${preorderNumber} | ${settings.store_name}`}</title>
      </Helmet>
      {paid && <ThankYouCard firstName={data?.customer?.first_name} preorderNumber={preorderNumber} />}
      <section className="container-custom max-w-4xl py-14">
        {!paid && <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gold-gradient">
            <HiCheckBadge className="h-10 w-10 text-primary-black" />
          </div>
          <p className="eyebrow mt-8">{paid ? 'Acompte reçu' : 'Précommande enregistrée'}</p>
          <h1 className="mt-3 text-4xl font-semibold md:text-5xl">{paid ? 'Merci, elle est à vous ✨' : 'Plus qu’une étape'}</h1>
          <p className="mx-auto mt-4 max-w-lg text-gray-400">
            {paid
              ? 'Votre précommande est confirmée. Vous recevrez un email à chaque étape clé.'
              : "Réglez l'acompte pour confirmer votre précommande et lancer la fabrication de vos pièces. Le solde se règle avant la livraison."}
          </p>
          <button onClick={copy} className="mt-6 inline-flex items-center gap-3 rounded-full border border-gold/40 px-6 py-3 font-mono text-xl text-gold hover:bg-gold/10">
            {preorderNumber} <HiClipboardDocument className="h-5 w-5" />
          </button>
        </motion.div>}

        {!paid && (
          <div className="mx-auto mt-10 max-w-md rounded-3xl border border-gold/30 bg-gold/5 p-6 text-center">
            {canPay ? (
              <>
                <p className="text-sm text-gray-300">{(data?.deposit_amount ?? last!.deposit_amount) < (data?.total_price ?? last!.total_price) ? 'Acompte à régler' : 'Montant à régler'}</p>
                <p className="mb-5 font-display text-4xl text-gold">{formatCurrency(data?.deposit_amount ?? last!.deposit_amount)}</p>
                <PaystackPay orderId={last!.order_id} amount={data?.deposit_amount ?? last!.deposit_amount} />
              </>
            ) : (
              <p className="text-sm text-gray-300">Pour régler votre acompte, contactez-nous sur WhatsApp avec votre numéro de précommande.</p>
            )}
            <a href={whatsappLink(settings.store_whatsapp, `Bonjour, ma précommande ${preorderNumber}`)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gold">
              <FaWhatsapp /> Besoin d'aide ?
            </a>
          </div>
        )}

        {data && (
          <div className="mt-14 grid gap-8 md:grid-cols-[1.2fr_1fr]">
            <div className="rounded-3xl border border-white/5 bg-dark-800 p-6">
              <h2 className="mb-6 font-display text-xl">Suivi</h2>
              <OrderTimeline status={data.status} timeline={data.timeline} />
            </div>
            <div className="space-y-4 rounded-3xl border border-white/5 bg-dark-800 p-6">
              <h2 className="font-display text-xl">Vos pièces</h2>
              {data.items.map((i, idx) => (
                <div key={idx} className="flex gap-3 text-sm">
                  <div className="h-16 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-dark-700">{i.image && <img src={i.image} alt="" className="h-full w-full object-cover" />}</div>
                  <div className="flex-1">
                    <p className="font-medium">{i.product_name}</p>
                    <p className="text-xs text-gray-500">
                      {i.size && i.size !== ONE_SIZE ? `Taille ${i.size} · ` : ''}×{i.quantity}
                    </p>
                    {(i.piece_numbers ?? []).length > 0 && <p className="mt-1 text-xs font-medium text-gold">Pièce {formatPieceNumbers(i.piece_numbers, i.series_size)}</p>}
                  </div>
                  <span>{formatCurrency(i.product_price * i.quantity)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-white/10 pt-4 text-sm">
                <span className="text-gray-400">Total</span>
                <span>{formatCurrency(data.total_price)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-12 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to={`/track?number=${preorderNumber}`}>
            <Button variant="outline" className="w-full">
              Suivre ma commande
            </Button>
          </Link>
          <Link to="/collection">
            <Button variant="ghost" className="w-full">
              Continuer mes achats
            </Button>
          </Link>
        </div>
      </section>
    </>
  )
}
