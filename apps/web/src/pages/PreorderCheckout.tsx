import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import toast from 'react-hot-toast'
import { HiArrowLeft, HiLockClosed, HiShieldCheck, HiUser, HiTruck, HiCreditCard } from 'react-icons/hi2'
import { formatCurrency, isValidEmail, isValidPhone, ONE_SIZE, sizeLabelFor, splitPayment } from '@trs/shared'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import RecaptchaNotice from '../components/ui/RecaptchaNotice'
import { usePreorder } from '../context/PreorderContext'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { ordersService } from '../services/ordersService'
import { promoService, referralMemory, type PromoQuote } from '../services/promoService'
import { errorMessage } from '../core/http'
import { writeJSON } from '../core/storage'
import { useRecaptchaPreload } from '../hooks/useRecaptchaPreload'
import { IVORIAN_CITIES } from '../utils/constants'
import { lineKey, type CheckoutCustomer } from '../types/cart'

const EMPTY: CheckoutCustomer = { firstName: '', lastName: '', phone: '', whatsapp: '', email: '', city: '', address: '', notes: '' }

export interface LastOrder {
  order_id: string
  preorder_number: string
  email: string
  deposit_amount: number
  total_price: number
}

function Section({ icon: Icon, title, subtitle, children }: { icon: typeof HiUser; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/5 bg-dark-800">
      <header className="flex items-center gap-4 border-b border-white/5 p-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/40">
          <Icon className="h-5 w-5 text-gold" />
        </div>
        <div>
          <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.2em]">{title}</h2>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
      </header>
      <div className="space-y-5 p-6">{children}</div>
    </section>
  )
}

export default function PreorderCheckout() {
  const { items, totalPrice, totalItems, depositPercentage, clearPreorder } = usePreorder()
  const { user } = useAuth()
  const { settings } = useSettings()
  const navigate = useNavigate()
  const [form, setForm] = useState<CheckoutCustomer>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutCustomer | 'terms', string>>>({})
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  // Promo or referral code: the server says what it takes off; the order re-checks it.
  const [codeInput, setCodeInput] = useState(() => referralMemory.read() ?? '')
  const [quote, setQuote] = useState<PromoQuote | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const basketKey = items.map((i) => `${lineKey(i)}×${i.quantity}`).join('|')
  useRecaptchaPreload()

  const orderLines = () => items.map((i) => ({ product_id: i.id, size: i.size, color: i.color, quantity: i.quantity }))

  const applyCode = async (raw = codeInput, quiet = false) => {
    const code = raw.trim()
    if (!code) return
    if (!user) {
      setCodeError('Connectez-vous pour utiliser un code.')
      return
    }
    setApplying(true)
    setCodeError(null)
    try {
      const q = await promoService.quote(code, orderLines())
      setQuote(q)
      setCodeInput(q.code)
      if (!quiet) toast.success(q.referral ? 'Code de parrainage appliqué' : 'Code appliqué')
    } catch (error) {
      setQuote(null)
      setCodeError(errorMessage(error, 'Ce code ne s’applique pas.'))
    } finally {
      setApplying(false)
    }
  }

  const removeCode = () => {
    setQuote(null)
    setCodeError(null)
    setCodeInput('')
    referralMemory.forget()
  }

  // A friend's code from a shared link is applied by itself; the amount follows the basket.
  useEffect(() => {
    const code = quote?.code ?? referralMemory.read()
    if (user && items.length > 0 && code) void applyCode(code, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, basketKey])

  // Deposit now on what is due after any code; the balance is paid before delivery (the API decides the final amounts).
  const due = quote ? quote.total : totalPrice
  const { deposit: toPay, remaining } = splitPayment(due, depositPercentage)

  useEffect(() => {
    if (user) {
      setForm((f) => ({ ...f, firstName: f.firstName || user.first_name, lastName: f.lastName || user.last_name, email: f.email || user.email, phone: f.phone || user.phone || '' }))
    }
  }, [user])

  if (items.length === 0 && !loading) {
    return (
      <div className="container-custom py-32 text-center">
        <p className="font-display text-6xl text-gold/40">★</p>
        <h1 className="mt-6 text-4xl">Votre sélection est vide</h1>
        <p className="mt-3 text-gray-400">Ajoutez des pièces avant de finaliser votre précommande.</p>
        <Link to="/collection" className="mt-8 inline-block">
          <Button>Découvrir la boutique</Button>
        </Link>
      </div>
    )
  }

  const set = (field: keyof CheckoutCustomer) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    if (errors[field]) setErrors(({ [field]: _removed, ...rest }) => rest)
  }

  const validate = () => {
    const e: typeof errors = {}
    if (!form.firstName.trim()) e.firstName = 'Prénom requis'
    if (!form.lastName.trim()) e.lastName = 'Nom requis'
    if (!isValidPhone(form.phone)) e.phone = 'Numéro invalide (10 chiffres)'
    if (form.whatsapp && !isValidPhone(form.whatsapp)) e.whatsapp = 'Numéro invalide'
    if (!isValidEmail(form.email.trim())) e.email = 'Email requis pour le paiement et la confirmation'
    if (!form.city) e.city = 'Ville requise'
    if (form.address.trim().length < 3) e.address = 'Adresse requise'
    if (!accepted) e.terms = 'Veuillez accepter les conditions de précommande'
    return e
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) {
      toast.error('Merci de compléter les champs indiqués')
      return
    }

    setLoading(true)
    try {
      const order = await ordersService.create({
        customer: { ...form, email: form.email.trim() },
        items: items.map((i) => ({ product_id: i.id, size: i.size, color: i.color, quantity: i.quantity })),
        payment_method: 'paystack',
        promo_code: quote?.code,
      })
      const last: LastOrder = {
        order_id: order.order_id,
        preorder_number: order.preorder_number,
        email: form.email.trim(),
        deposit_amount: order.deposit_amount,
        total_price: order.total_price,
      }
      writeJSON('last_order', last, 'session')
      if (quote) referralMemory.forget()
      clearPreorder()
      // Paid online (Paystack) from the confirmation page.
      navigate(`/preorder/confirmation/${order.preorder_number}`)
    } catch (error) {
      toast.error(errorMessage(error, 'Impossible de créer la précommande'))
      setLoading(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>{`Finaliser ma précommande | ${settings.store_name}`}</title>
      </Helmet>

      <section className="container-custom max-w-6xl py-10 md:py-14">
        <Link to="/preorder" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gold">
          <HiArrowLeft className="h-4 w-4" /> Retour à ma sélection
        </Link>
        <h1 className="mt-4 text-4xl font-semibold md:text-5xl">
          Finaliser ma <span className="text-gold-gradient italic">précommande</span>
        </h1>

        <form onSubmit={submit} noValidate className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <Section icon={HiUser} title="Vos coordonnées" subtitle="Pour vous tenir informé(e) de chaque étape">
              <div className="grid gap-5 sm:grid-cols-2">
                <Input label="Prénom" required value={form.firstName} onChange={set('firstName')} error={errors.firstName} autoComplete="given-name" />
                <Input label="Nom" required value={form.lastName} onChange={set('lastName')} error={errors.lastName} autoComplete="family-name" />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Input label="Téléphone" required type="tel" placeholder="07 00 00 00 00" value={form.phone} onChange={set('phone')} error={errors.phone} autoComplete="tel" />
                <Input label="WhatsApp" type="tel" placeholder="Si différent" value={form.whatsapp} onChange={set('whatsapp')} error={errors.whatsapp} />
              </div>
              <Input label="Email" required type="email" placeholder="vous@email.com" value={form.email} onChange={set('email')} error={errors.email} autoComplete="email" />
            </Section>

            <Section icon={HiTruck} title="Livraison" subtitle="Où souhaitez-vous recevoir vos pièces ?">
              <div className="space-y-1.5">
                <label htmlFor="city" className="block text-xs font-medium uppercase tracking-[0.15em] text-gray-300">
                  Ville <span className="text-gold">*</span>
                </label>
                <select id="city" value={form.city} onChange={set('city')} className={`field ${errors.city ? '!border-red-500' : ''}`}>
                  <option value="">Sélectionnez votre ville</option>
                  {IVORIAN_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {errors.city && <p className="text-xs text-red-400">{errors.city}</p>}
              </div>
              <Input label="Adresse" required placeholder="Quartier, rue, repère…" value={form.address} onChange={set('address')} error={errors.address} autoComplete="street-address" />
              <div className="space-y-1.5">
                <label htmlFor="notes" className="block text-xs font-medium uppercase tracking-[0.15em] text-gray-300">
                  Notes (optionnel)
                </label>
                <textarea id="notes" rows={3} value={form.notes} onChange={set('notes')} className="field resize-none" placeholder="Instructions pour la livraison, précisions sur la taille…" />
              </div>
            </Section>

            <Section icon={HiCreditCard} title="Paiement" subtitle="En ligne, sécurisé">
              <div className="flex items-center gap-4 rounded-2xl border border-gold/40 bg-gold/5 p-4">
                <HiLockClosed className="h-6 w-6 text-gold" />
                <div className="text-sm">
                  <p className="font-medium">Mobile Money ou carte</p>
                  <p className="text-gray-400">
                    À l'étape suivante, vous payez {remaining > 0 ? "l'acompte " : ''}sur la page sécurisée Paystack : Wave, Orange Money, MTN, Moov ou carte bancaire. Votre commande est confirmée dès réception.
                  </p>
                </div>
              </div>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-300">
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-gold)]" />
                <span>
                  {remaining > 0
                    ? `J'accepte de régler aujourd'hui un acompte de ${depositPercentage} % (${formatCurrency(toPay)}) et le solde de ${formatCurrency(remaining)} avant la livraison, selon les `
                    : `J'accepte de régler le montant total de ${formatCurrency(toPay)} aujourd'hui, selon les `}
                  <Link to="/faq" className="text-gold underline">
                    conditions de précommande
                  </Link>
                  .
                </span>
              </label>
              {errors.terms && <p className="text-xs text-red-400">{errors.terms}</p>}
            </Section>
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-3xl border border-gold/20 bg-dark-800 p-6">
              <h2 className="font-display text-2xl">Récapitulatif</h2>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                {totalItems} article{totalItems > 1 ? 's' : ''}
              </p>
              <ul className="my-6 max-h-72 space-y-4 overflow-y-auto pr-1">
                {items.map((i) => (
                  <li key={lineKey(i)} className="flex gap-3">
                    <div className="relative h-16 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-dark-700">
                      {i.image && <img src={i.image} alt="" className="h-full w-full object-cover" />}
                      <span className="absolute -right-0 -top-0 flex h-5 w-5 items-center justify-center rounded-bl-lg bg-gold text-[10px] font-bold text-primary-black">{i.quantity}</span>
                    </div>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="truncate font-medium">{i.name}</p>
                      <p className="text-xs text-gray-500">
                        {i.size !== ONE_SIZE ? `${sizeLabelFor(i.category)} ${i.size}` : 'Taille unique'}
                        {i.color ? ` · ${i.color}` : ''}
                      </p>
                    </div>
                    <span className="text-sm">{formatCurrency(i.price * i.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="mb-5 border-t border-white/10 pt-5">
                <label htmlFor="promo" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-400">
                  Code promo ou de parrainage
                </label>
                {quote ? (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-gold/30 bg-gold/5 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm tracking-[0.15em] text-gold">{quote.code}</p>
                      <p className="text-[11px] text-gray-400">{quote.referral ? 'Parrainage : première commande' : quote.kind === 'percent' ? `-${quote.value} %` : `-${formatCurrency(quote.value)}`}</p>
                    </div>
                    <button type="button" onClick={removeCode} className="text-xs text-gray-400 underline-offset-4 hover:text-white hover:underline">
                      Retirer
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      id="promo"
                      value={codeInput}
                      onChange={(e) => {
                        setCodeInput(e.target.value.toUpperCase())
                        setCodeError(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void applyCode()
                        }
                      }}
                      placeholder="EX. BIENVENUE"
                      autoComplete="off"
                      maxLength={30}
                      className="min-w-0 flex-1 rounded-full border border-white/15 bg-transparent px-4 py-2.5 font-mono text-sm uppercase tracking-[0.15em] outline-none placeholder:text-gray-600 focus:border-gold"
                      aria-invalid={!!codeError}
                      aria-describedby={codeError ? 'promo-error' : undefined}
                    />
                    <Button type="button" variant="outline" size="sm" loading={applying} onClick={() => void applyCode()} disabled={!codeInput.trim()}>
                      Appliquer
                    </Button>
                  </div>
                )}
                {codeError && (
                  <p id="promo-error" role="alert" className="mt-2 text-xs text-red-400">
                    {codeError}
                  </p>
                )}
              </div>
              <dl className="space-y-3 border-t border-white/10 pt-5 text-sm">
                <div className="flex justify-between text-gray-400">
                  <dt>Articles</dt>
                  <dd className="text-white">{formatCurrency(quote?.subtotal ?? totalPrice)}</dd>
                </div>
                {quote && quote.discount > 0 && (
                  <div className="flex justify-between text-gray-400">
                    <dt>Remise ({quote.code})</dt>
                    <dd className="text-gold">-{formatCurrency(quote.discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between text-gray-400">
                  <dt>Livraison</dt>
                  <dd className="text-white">Incluse</dd>
                </div>
                {remaining > 0 && (
                  <>
                    <div className="flex justify-between text-gray-400">
                      <dt>Total</dt>
                      <dd className="text-white">{formatCurrency(due)}</dd>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <dt>Solde avant la livraison</dt>
                      <dd>{formatCurrency(remaining)}</dd>
                    </div>
                  </>
                )}
                <div className="flex items-baseline justify-between border-t border-white/10 pt-4">
                  <dt className="text-xs uppercase tracking-[0.2em]">{remaining > 0 ? `Acompte (${depositPercentage} %) à payer maintenant` : 'À payer maintenant'}</dt>
                  <dd className="font-display text-3xl text-gold">{formatCurrency(toPay)}</dd>
                </div>
              </dl>
              {user?.email_verified === false && (
                <p role="alert" className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-center text-xs text-amber-200">
                  Confirmez d'abord votre email ({user.email}) : un lien vous a été envoyé. Le bandeau en haut de page permet de le renvoyer.
                </p>
              )}
              <Button type="submit" size="lg" className="mt-6 w-full" loading={loading} icon={HiLockClosed} disabled={user?.email_verified === false}>
                {remaining > 0 ? `Payer l'acompte · ${formatCurrency(toPay)}` : `Payer ${formatCurrency(toPay)}`}
              </Button>
              <p className="mt-4 flex items-center justify-center gap-2 text-[11px] text-gray-500">
                <HiShieldCheck className="h-4 w-4 text-gold" /> Montant confirmé par nos serveurs avant paiement
              </p>
              <RecaptchaNotice className="mt-4 text-center" />
            </div>
          </aside>
        </form>
      </section>
    </>
  )
}
