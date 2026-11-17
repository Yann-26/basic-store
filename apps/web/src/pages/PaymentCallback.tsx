import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { HiClock, HiXCircle } from 'react-icons/hi2'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import ThankYouCard from '../components/payments/ThankYouCard'
import { paymentService, type PaymentVerification } from '../services/paymentService'
import { errorMessage } from '../core/http'
import { readJSON } from '../core/storage'
import { useSettings } from '../context/SettingsContext'
import type { LastOrder } from './Checkout'

/**
 * Where Paystack sends the customer back: the API checks with Paystack whether
 * the payment went through, then the thank-you card — or a way to try again.
 */
export default function PaymentCallback() {
  const [params] = useSearchParams()
  const { settings } = useSettings()
  const [result, setResult] = useState<PaymentVerification | null>(null)
  const [error, setError] = useState<string | null>(null)
  const once = useRef(false)
  const last = readJSON<LastOrder | null>('last_order', null, 'session')

  useEffect(() => {
    if (once.current) return
    once.current = true
    const reference = params.get('reference') || params.get('trxref')
    if (!reference) {
      setError('Aucune référence de paiement trouvée.')
      return
    }
    paymentService
      .verify(reference)
      .then(setResult)
      .catch((e) => setError(errorMessage(e, 'Vérification du paiement impossible.')))
  }, [params])

  const number = result?.preorder_number ?? last?.preorder_number ?? null

  if (result?.status === 'success') {
    return (
      <>
        <Helmet>
          <title>{`Merci | ${settings.store_name}`}</title>
        </Helmet>
        <ThankYouCard firstName={result.first_name} amount={result.amount} preorderNumber={number} />
      </>
    )
  }

  if (!result && !error) {
    return (
      <section className="container-custom max-w-lg py-32 text-center">
        <Spinner size="lg" />
        <h1 className="mt-8 text-3xl">Vérification du paiement…</h1>
        <p className="mt-2 text-gray-400">Merci de patienter quelques secondes.</p>
      </section>
    )
  }

  const review = result?.status === 'review'
  return (
    <section className="container-custom max-w-lg py-32 text-center">
      {review ? <HiClock className="mx-auto h-16 w-16 text-gold" /> : <HiXCircle className="mx-auto h-16 w-16 text-red-400" />}
      <h1 className="mt-6 text-3xl">{review ? 'Paiement en cours de vérification' : 'Paiement non confirmé'}</h1>
      <p className="mt-2 text-gray-400">
        {review
          ? 'Nous avons bien reçu votre paiement et le vérifions. Vous recevrez un email dès que votre commande est confirmée.'
          : (error ?? "Le paiement n'a pas été finalisé. Vous pouvez réessayer quand vous voulez.")}
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        {!review && number && (
          <Link to={`/payer/${encodeURIComponent(number)}`}>
            <Button>Réessayer le paiement</Button>
          </Link>
        )}
        <Link to="/contact">
          <Button variant="outline">Contacter la Maison</Button>
        </Link>
      </div>
    </section>
  )
}
