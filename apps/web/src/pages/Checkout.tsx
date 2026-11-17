import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { HiArrowLeft, HiShieldCheck, HiUser, HiTruck, HiCreditCard, HiBuildingStorefront, HiBanknotes, HiDevicePhoneMobile } from 'react-icons/hi2'
import {
  CHECKOUT_PAYMENT_LABELS,
  DELIVERY_ZONE_LABELS,
  computeOrderTotals,
  formatCurrency,
  isValidEmail,
  isValidPhone,
  ONE_SIZE,
  sizeLabelFor,
  type CheckoutPaymentMode,
  type DeliveryZone,
} from '@trs/shared'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import RecaptchaNotice from '../components/ui/RecaptchaNotice'
import { useCart } from '../context/CartContext'
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

/** What the confirmation page needs to open the online payment right after the order. */
export interface LastOrder {
  order_id: string
  preorder_number: string
  email: string
  payment_method: CheckoutPaymentMode
  due_now: number
  total_price: number
}

function Section({ icon: Icon, title, subtitle, children }: { icon: typeof HiUser; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="border border-dark-600 bg-dark-800">
      <header className="flex items-center gap-4 border-b border-dark-600 p-6">
        <Icon className="h-5 w-5 text-gold" />
        <div>
          <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.2em]">{title}</h2>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
      </header>
      <div className="space-y-5 p-6">{children}</div>
    </section>
  )
}

/** A big radio card (delivery zone, payment mode). */
function Choice({ checked, onSelect, icon: Icon, title, detail, aside, disabled }: { checked: boolean; onSelect: () => void; icon: typeof HiUser; title: string; detail: string; aside?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
      className={clsx(
        'flex w-full items-start gap-4 border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        checked ? 'border-gold bg-dark-700' : 'border-dark-600 hover:border-gray-500',
      )}
    >
      <span className={clsx('mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border', checked ? 'border-gold' : 'border-gray-500')}>
        {checked && <span className="h-2 w-2 rounded-full bg-gold" />}
      </span>
      <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-gray-500">{detail}</span>
      </span>
      {aside && <span className="text-sm font-medium tabular-nums">{aside}</span>}
    </button>
  )
}

export default function Checkout() {
  const { items, subtotal, totalItems, clearCart } = useCart()
  const { user } = useAuth()
  const { settings } = useSettings()
  const navigate = useNavigate()
  const [form, setForm] = useState<CheckoutCustomer>(EMPTY)
  const [zone, setZone] = useState<DeliveryZone>('abidjan')
  const [payment, setPayment] = useState<CheckoutPaymentMode>(settings.cash_on_delivery_enabled ? 'cash_on_delivery' : 'online')
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

  // Only one payment mode switched on in the back-office: it is the one.
  useEffect(() => {
    if (!settings.cash_on_delivery_enabled && payment === 'cash_on_delivery') setPayment('online')
    if (!settings.online_payment_enabled && payment === 'online') setPayment('cash_on_delivery')
  }, [settings.cash_on_delivery_enabled, settings.online_payment_enabled, payment])

  useEffect(() => {
    if (user) {
      setForm((f) => ({ ...f, firstName: f.firstName || user.first_name, lastName: f.lastName || user.last_name, email: f.email || user.email, phone: f.phone || user.phone || '' }))
    }
  }, [user])

  // Indicative: the API decides the final amounts from the database.
  const delivery = { abidjan: settings.delivery_fee_abidjan, interior: settings.delivery_fee_interior, freeFrom: settings.free_delivery_from }
  const totals = computeOrderTotals(
    items.map((i) => ({ unitPrice: i.price, quantity: i.quantity })),
    { discount: quote?.discount ?? 0, zone, payment, delivery },
  )
  const feeFor = (z: DeliveryZone) => computeOrderTotals([{ unitPrice: subtotal - (quote?.discount ?? 0), quantity: 1 }], { zone: z, delivery }).deliveryFee
  const feeLabel = (z: DeliveryZone) => (feeFor(z) === 0 ? 'Gratuit' : formatCurrency(feeFor(z)))
  const pickup = zone === 'pickup'

  if (items.length === 0 && !loading) {
    return (
      <div className="container-custom py-32 text-center">
        <h1 className="text-4xl">Votre panier est vide</h1>
        <p className="mt-3 text-gray-400">Ajoutez des articles avant de passer commande.</p>
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
    if (!isValidEmail(form.email.trim())) e.email = 'Email requis pour la confirmation'
    if (!form.city) e.city = pickup ? 'Indiquez votre ville' : 'Ville requise'
    if (!pickup && form.address.trim().length < 3) e.address = 'Adresse de livraison requise'
    if (!accepted) e.terms = 'Veuillez accepter les conditions de vente'
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
        customer: { ...form, email: form.email.trim(), address: pickup ? '' : form.address },
        items: orderLines(),
        payment_method: payment,
        delivery_zone: zone,
        promo_code: quote?.code,
      })
      const last: LastOrder = {
        order_id: order.order_id,
        preorder_number: order.preorder_number,
        email: form.email.trim(),
        payment_method: order.payment_method,
        due_now: order.due_now,
        total_price: order.total_price,
      }
      writeJSON('last_order', last, 'session')
      if (quote) referralMemory.forget()
      clearCart()
      // Online: paid (Paystack) from the confirmation page. On delivery: nothing more to do.
      navigate(`/commande/confirmation/${order.preorder_number}`)
    } catch (error) {
      toast.error(errorMessage(error, 'Impossible de créer la commande'))
      setLoading(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>{`Commander | ${settings.store_name}`}</title>
      </Helmet>

      <section className="container-custom max-w-6xl py-10 md:py-14">
        <Link to="/panier" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gold">
          <HiArrowLeft className="h-4 w-4" /> Retour au panier
        </Link>
        <h1 className="mt-4 text-4xl md:text-5xl">Finaliser ma commande</h1>

        <form onSubmit={submit} noValidate className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <Section icon={HiUser} title="Vos coordonnées" subtitle="Nous vous appelons pour confirmer la livraison">
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

            <Section icon={HiTruck} title="Livraison" subtitle="On livre partout en Côte d’Ivoire">
              <div role="radiogroup" aria-label="Mode de livraison" className="space-y-3">
                <Choice checked={zone === 'abidjan'} onSelect={() => setZone('abidjan')} icon={HiTruck} title={DELIVERY_ZONE_LABELS.abidjan} detail="Livraison en 24 à 48 h, toutes communes" aside={feeLabel('abidjan')} />
                <Choice checked={zone === 'interior'} onSelect={() => setZone('interior')} icon={HiTruck} title={DELIVERY_ZONE_LABELS.interior} detail="Expédition par car ou coursier, 2 à 5 jours" aside={feeLabel('interior')} />
                <Choice checked={zone === 'pickup'} onSelect={() => setZone('pickup')} icon={HiBuildingStorefront} title={DELIVERY_ZONE_LABELS.pickup} detail={settings.store_address || 'Angré Nouveau CHU, Djorogobité 1'} aside="Gratuit" />
              </div>
              {settings.free_delivery_from > 0 && (
                <p className="text-xs text-gray-500">Livraison offerte dès {formatCurrency(settings.free_delivery_from)} d’achat.</p>
              )}
              <div className="space-y-1.5">
                <label htmlFor="city" className="block text-xs font-medium uppercase tracking-[0.15em] text-gray-300">
                  {pickup ? 'Votre ville' : 'Ville / commune'} <span className="text-gold">*</span>
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
              {!pickup && (
                <Input label="Adresse" required placeholder="Commune, quartier, rue, repère…" value={form.address} onChange={set('address')} error={errors.address} autoComplete="street-address" />
              )}
              <div className="space-y-1.5">
                <label htmlFor="notes" className="block text-xs font-medium uppercase tracking-[0.15em] text-gray-300">
                  Notes (optionnel)
                </label>
                <textarea id="notes" rows={3} value={form.notes} onChange={set('notes')} className="field resize-none" placeholder="Heure de passage, précisions pour le livreur…" />
              </div>
            </Section>

            <Section icon={HiCreditCard} title="Paiement" subtitle="Choisissez comment vous payez">
              <div role="radiogroup" aria-label="Mode de paiement" className="space-y-3">
                <Choice
                  checked={payment === 'cash_on_delivery'}
                  onSelect={() => setPayment('cash_on_delivery')}
                  disabled={!settings.cash_on_delivery_enabled}
                  icon={HiBanknotes}
                  title={pickup ? 'Paiement au retrait en boutique' : CHECKOUT_PAYMENT_LABELS.cash_on_delivery}
                  detail={pickup ? 'Espèces, Mobile Money ou carte à la boutique' : 'Espèces ou Mobile Money, au livreur'}
                />
                <Choice
                  checked={payment === 'online'}
                  onSelect={() => setPayment('online')}
                  disabled={!settings.online_payment_enabled}
                  icon={HiDevicePhoneMobile}
                  title={CHECKOUT_PAYMENT_LABELS.online}
                  detail="Wave, Orange Money, MTN, Moov ou carte bancaire — page sécurisée Paystack"
                />
              </div>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-300">
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-gold)]" />
                <span>
                  J’accepte les{' '}
                  <Link to="/faq" className="text-gold underline">
                    conditions de vente et de livraison
                  </Link>
                  {payment === 'online' ? ` et je règle ${formatCurrency(totals.total)} en ligne maintenant.` : ` et je règle ${formatCurrency(totals.total)} ${pickup ? 'au retrait' : 'à la livraison'}.`}
                </span>
              </label>
              {errors.terms && <p className="text-xs text-red-400">{errors.terms}</p>}
            </Section>
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="border border-dark-600 bg-dark-800 p-6">
              <h2 className="font-display text-2xl">Récapitulatif</h2>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                {totalItems} article{totalItems > 1 ? 's' : ''}
              </p>
              <ul className="my-6 max-h-72 space-y-4 overflow-y-auto pr-1">
                {items.map((i) => (
                  <li key={lineKey(i)} className="flex gap-3">
                    <div className="relative h-16 w-14 flex-shrink-0 overflow-hidden bg-dark-700">
                      {i.image && <img src={i.image} alt="" className="h-full w-full object-cover" />}
                      <span className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center bg-gold text-[10px] font-bold text-primary-black">{i.quantity}</span>
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
              <div className="mb-5 border-t border-dark-600 pt-5">
                <label htmlFor="promo" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-400">
                  Code promo ou de parrainage
                </label>
                {quote ? (
                  <div className="flex items-center justify-between gap-3 border border-gold/30 px-4 py-3">
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
                      className="min-w-0 flex-1 border border-dark-500 bg-transparent px-4 py-2.5 font-mono text-sm uppercase tracking-[0.15em] outline-none placeholder:text-gray-600 focus:border-gold"
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
              <dl className="space-y-3 border-t border-dark-600 pt-5 text-sm">
                <div className="flex justify-between text-gray-400">
                  <dt>Articles</dt>
                  <dd className="text-white">{formatCurrency(totals.subtotal)}</dd>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-gray-400">
                    <dt>Remise ({quote?.code})</dt>
                    <dd className="text-gold">-{formatCurrency(totals.discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between text-gray-400">
                  <dt>{pickup ? 'Retrait en boutique' : 'Livraison'}</dt>
                  <dd className="text-white">{totals.deliveryFee > 0 ? formatCurrency(totals.deliveryFee) : 'Gratuit'}</dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-dark-600 pt-4">
                  <dt className="text-xs uppercase tracking-[0.2em]">Total</dt>
                  <dd className="font-display text-3xl">{formatCurrency(totals.total)}</dd>
                </div>
                <p className="text-xs text-gray-500">
                  {payment === 'online' ? 'Payé en ligne à l’étape suivante.' : pickup ? 'Payé au retrait en boutique.' : 'Payé au livreur à la réception.'}
                </p>
              </dl>
              {user?.email_verified === false && (
                <p role="alert" className="mt-6 border border-amber-400/30 bg-amber-400/10 p-3 text-center text-xs text-amber-700">
                  Confirmez d'abord votre email ({user.email}) : un lien vous a été envoyé. Le bandeau en haut de page permet de le renvoyer.
                </p>
              )}
              <Button type="submit" size="lg" className="mt-6 w-full" loading={loading} disabled={user?.email_verified === false}>
                {payment === 'online' ? `Payer ${formatCurrency(totals.total)}` : 'Confirmer la commande'}
              </Button>
              <p className="mt-4 flex items-center justify-center gap-2 text-[11px] text-gray-500">
                <HiShieldCheck className="h-4 w-4 text-gold" /> Articles réservés dès la validation · montant vérifié par nos serveurs
              </p>
              <RecaptchaNotice className="mt-4 text-center" />
            </div>
          </aside>
        </form>
      </section>
    </>
  )
}
