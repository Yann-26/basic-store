import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { HiCheckCircle, HiTicket } from 'react-icons/hi2'
import { formatCurrency, paymentProgress, type Order } from '@trs/shared'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import PaymentProgress from '../components/orders/PaymentProgress'
import { accountService } from '../services/accountService'
import PaystackPay from '../components/payments/PaystackPay'
import { errorMessage } from '../core/http'
import toast from 'react-hot-toast'

/** Where the ticket's QR code leads: pay what is left on one of my orders. */
export default function PayBalance() {
  const { preorderNumber = '' } = useParams()
  const number = preorderNumber.trim().toUpperCase()
  const [order, setOrder] = useState<Order | null | undefined>(undefined)

  useEffect(() => {
    accountService
      .orders()
      .then((orders) => setOrder(orders.find((o) => o.preorder_number === number) ?? null))
      .catch((e) => {
        toast.error(errorMessage(e, 'Impossible de charger vos commandes'))
        setOrder(null)
      })
  }, [number])

  if (order === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (order === null) {
    return (
      <section className="container-custom max-w-lg py-24 text-center">
        <h1 className="text-3xl">Commande introuvable</h1>
        <p className="mt-3 text-gray-400">
          La commande <span className="font-mono text-gold">{number}</span> n'apparaît pas dans ce compte. Connectez-vous avec le compte qui l'a passée, ou contactez-nous.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/compte">
            <Button>Mes commandes</Button>
          </Link>
          <Link to="/contact">
            <Button variant="outline">Nous contacter</Button>
          </Link>
        </div>
      </section>
    )
  }

  const p = paymentProgress(order)
  const cancelled = order.status === 'cancelled'

  return (
    <section className="container-custom max-w-lg py-16 md:py-24">
      <Helmet>
        <title>Payer le solde · {order.preorder_number}</title>
      </Helmet>
      <p className="eyebrow text-center">Paiement du solde</p>
      <h1 className="mt-3 text-center text-3xl md:text-4xl">
        Commande <span className="font-mono text-gold">{order.preorder_number}</span>
      </h1>

      <div className="mt-10 rounded-3xl border border-white/10 bg-dark-800 p-6">
        <PaymentProgress order={order} />
        <ul className="mt-5 space-y-1 border-t border-white/5 pt-4 text-sm text-gray-300">
          {(order.order_items ?? []).map((i, n) => (
            <li key={i.id ?? n} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">
                {i.product_name}
                {i.quantity > 1 && ` ×${i.quantity}`}
              </span>
              <span className="whitespace-nowrap">{formatCurrency(i.product_price * i.quantity)}</span>
            </li>
          ))}
        </ul>
      </div>

      {cancelled ? (
        <p className="mt-8 text-center text-gray-400">Cette commande a été annulée : il n'y a rien à payer.</p>
      ) : p.outstanding > 0 ? (
        <div className="mt-8 text-center">
          <PaystackPay orderId={order.id} amount={p.paid > 0 ? p.outstanding : Math.min(order.deposit_amount, p.outstanding)} />
        </div>
      ) : (
        <div className="mt-8 flex flex-col items-center gap-2 text-center">
          <HiCheckCircle className="h-12 w-12 text-emerald-400" />
          <p className="text-lg">Cette commande est payée à 100 %. Merci !</p>
        </div>
      )}

      <div className="mt-8 text-center">
        <Link to={`/compte/ticket/${encodeURIComponent(order.preorder_number)}`} className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gold hover:underline">
          <HiTicket className="h-4 w-4" /> Voir mon ticket
        </Link>
      </div>
    </section>
  )
}
