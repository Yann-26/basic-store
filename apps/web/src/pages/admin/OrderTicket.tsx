import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { HiArrowLeft, HiPrinter } from 'react-icons/hi2'
import type { Order } from '@trs/shared'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import BalanceTicket from '../../components/orders/BalanceTicket'
import { ordersService } from '../../services/ordersService'
import { useSettings } from '../../context/SettingsContext'
import { errorMessage } from '../../core/http'

/** Back-office: the ticket to print and slip into the parcel. */
export default function AdminOrderTicket() {
  const { id = '' } = useParams()
  const { settings } = useSettings()
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ordersService
      .getById(id)
      .then(setOrder)
      .catch((e) => setError(errorMessage(e, 'Commande introuvable')))
  }, [id])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link to="/admin/orders" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white">
          <HiArrowLeft className="h-4 w-4" /> Commandes
        </Link>
        {order && (
          <Button size="sm" icon={HiPrinter} onClick={() => window.print()}>
            Imprimer le ticket
          </Button>
        )}
      </div>
      {error ? (
        <p className="py-16 text-center text-gray-400">{error}</p>
      ) : order ? (
        <BalanceTicket order={order} contactPhone={String(settings.store_whatsapp ?? '')} />
      ) : (
        <div className="py-24">
          <Spinner />
        </div>
      )}
    </div>
  )
}
