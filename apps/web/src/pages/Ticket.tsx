import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { HiArrowLeft, HiPrinter } from 'react-icons/hi2'
import type { Order } from '@trs/shared'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import BalanceTicket from '../components/orders/BalanceTicket'
import { accountService } from '../services/accountService'
import { useSettings } from '../context/SettingsContext'

/** "Mon compte": the payment ticket of one of my orders, to show or print. */
export default function Ticket() {
  const { preorderNumber = '' } = useParams()
  const number = preorderNumber.trim().toUpperCase()
  const { settings } = useSettings()
  const [order, setOrder] = useState<Order | null | undefined>(undefined)

  useEffect(() => {
    accountService
      .orders()
      .then((orders) => setOrder(orders.find((o) => o.preorder_number === number) ?? null))
      .catch(() => setOrder(null))
  }, [number])

  if (order === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <section className="container-custom max-w-xl py-12 md:py-16">
      <Helmet>
        <title>Ticket · {number}</title>
      </Helmet>
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Link to="/compte" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white">
          <HiArrowLeft className="h-4 w-4" /> Mes commandes
        </Link>
        {order && (
          <Button size="sm" variant="outline" icon={HiPrinter} onClick={() => window.print()}>
            Imprimer
          </Button>
        )}
      </div>
      {order ? (
        <BalanceTicket order={order} contactPhone={String(settings.store_whatsapp ?? '')} />
      ) : (
        <p className="py-16 text-center text-gray-400">
          La précommande <span className="font-mono text-gold">{number}</span> n'apparaît pas dans ce compte.
        </p>
      )}
    </section>
  )
}
