import { useState } from 'react'
import toast from 'react-hot-toast'
import { HiLockClosed } from 'react-icons/hi2'
import { formatCurrency } from '@trs/shared'
import Button from '../ui/Button'
import { paymentService } from '../../services/paymentService'
import { errorMessage } from '../../core/http'

/** The ways to pay that Paystack offers in Côte d'Ivoire. */
const PAY_METHODS = ['Wave', 'Orange Money', 'MTN', 'Moov', 'Carte bancaire']

/**
 * Pay online with Paystack: the API opens a secure checkout for what the order
 * still needs (the amount is decided by the server), the customer pays there
 * by Mobile Money or card, and comes back to the thank-you page.
 */
export default function PaystackPay({ orderId, amount, label }: { orderId: string; amount: number; label?: string }) {
  const [busy, setBusy] = useState(false)

  const pay = async () => {
    setBusy(true)
    try {
      const { authorization_url } = await paymentService.initialize({ orderId })
      window.location.assign(authorization_url)
    } catch (error) {
      toast.error(errorMessage(error, 'Le paiement n’a pas pu s’ouvrir, réessayez.'))
      setBusy(false)
    }
  }

  return (
    <div>
      <Button size="lg" className="w-full" icon={HiLockClosed} loading={busy} onClick={pay}>
        {label ?? `Payer ${formatCurrency(amount)}`}
      </Button>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5" aria-label="Moyens de paiement acceptés">
        {PAY_METHODS.map((m) => (
          <span key={m} className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] text-gray-400">
            {m}
          </span>
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-gray-500">Paiement sécurisé par Paystack · montant confirmé par nos serveurs</p>
    </div>
  )
}
