import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { HiClipboardDocumentList, HiUser, HiShieldCheck, HiCheckBadge, HiExclamationTriangle, HiArrowRight, HiLockClosed, HiKey, HiPhone, HiCreditCard, HiTicket, HiGift } from 'react-icons/hi2'
import { ORDER_STATUS_LABELS, SOCIAL_PROVIDER_LABELS, checkPasswordStrength, formatCurrency, isValidPhone, isWaveAwaitingCheck, paymentProgress, type LinkedAccounts, type Order, type SocialProvider, formatPieceNumbers } from '@trs/shared'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { accountService } from '../services/accountService'
import { authService } from '../services/authService'
import { socialService } from '../services/socialService'
import { newsletterService } from '../services/newsletterService'
import { PROVIDER_STYLE } from '../components/auth/providerStyle'
import { errorMessage } from '../core/http'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Spinner from '../components/ui/Spinner'
import PaymentProgress from '../components/orders/PaymentProgress'
import ReferralPanel from '../components/account/ReferralPanel'

type Tab = 'orders' | 'referral' | 'profile' | 'security'
const TABS: { id: Tab; label: string; icon: typeof HiUser }[] = [
  { id: 'orders', label: 'Mes commandes', icon: HiClipboardDocumentList },
  { id: 'referral', label: 'Parrainage', icon: HiGift },
  { id: 'profile', label: 'Mon profil', icon: HiUser },
  { id: 'security', label: 'Sécurité', icon: HiShieldCheck },
]

const STATUS_TONE: Partial<Record<Order['status'], string>> = {
  pending: 'bg-amber-500/10 text-amber-300',
  delivered: 'bg-green-500/10 text-green-400',
  cancelled: 'bg-red-500/10 text-red-400',
}

function Orders() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  useEffect(() => {
    accountService.orders().then(setOrders).catch((e) => {
      toast.error(errorMessage(e))
      setOrders([])
    })
  }, [])

  if (!orders) return <Spinner />
  if (orders.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 py-16 text-center">
        <p className="font-display text-2xl">Pas encore de commande</p>
        <p className="mt-2 text-sm text-gray-500">Vos précommandes apparaîtront ici, avec leur suivi.</p>
        <Link to="/collection" className="mt-6 inline-block">
          <Button>Découvrir la boutique</Button>
        </Link>
      </div>
    )
  }
  return (
    <ul className="space-y-4">
      {orders.map((o) => (
        <li key={o.id} className="rounded-3xl border border-white/5 bg-dark-800 p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-lg text-gold">{o.preorder_number}</p>
              <p className="text-xs text-gray-500">
                Passée le {new Date(o.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                {o.estimated_delivery && ` · livraison estimée le ${new Date(o.estimated_delivery).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`}
              </p>
            </div>
            <span className={clsx('rounded-full px-3 py-1 text-xs', STATUS_TONE[o.status] ?? 'bg-gold/10 text-gold')}>{ORDER_STATUS_LABELS[o.status]}</span>
          </div>
          <ul className="my-4 space-y-1 border-y border-white/5 py-3 text-sm text-gray-300">
            {(o.order_items ?? []).map((i) => (
              <li key={i.id} className="flex justify-between gap-4">
                <span className="truncate">
                  {i.product_name} <span className="text-gray-500">{i.size && i.size !== 'TU' ? `· ${i.size}` : ''} ×{i.quantity}</span>
                  {(i.piece_numbers ?? []).length > 0 && <span className="ml-2 text-gold">{formatPieceNumbers(i.piece_numbers)}</span>}
                </span>
                <span className="whitespace-nowrap">{formatCurrency(i.product_price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          {!!o.discount_amount && (
            <p className="mb-3 flex justify-between gap-4 text-sm text-gray-400">
              <span>Remise {o.promo_code ? `(${o.promo_code})` : ''}</span>
              <span className="text-gold">-{formatCurrency(o.discount_amount)}</span>
            </p>
          )}
          <PaymentProgress order={o} className="max-w-md" />
          {(o.payments ?? []).some(isWaveAwaitingCheck) && (
            <p className="mt-2 text-xs text-sky-300">Paiement en cours de vérification : vous recevrez un email dès qu'il est confirmé.</p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              {o.status !== 'cancelled' && paymentProgress(o).outstanding > 0 && (
                <Link to={`/payer/${encodeURIComponent(o.preorder_number)}`}>
                  <Button size="sm" icon={HiCreditCard}>
                    {paymentProgress(o).paid > 0 ? `Payer le solde · ${formatCurrency(paymentProgress(o).outstanding)}` : "Payer l'acompte"}
                  </Button>
                </Link>
              )}
              <Link to={`/compte/ticket/${encodeURIComponent(o.preorder_number)}`}>
                <Button size="sm" variant="outline" icon={HiTicket}>
                  Mon ticket
                </Button>
              </Link>
            </div>
            <Link to={`/track?number=${encodeURIComponent(o.preorder_number)}`} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-gold hover:underline">
              Suivre <HiArrowRight />
            </Link>
          </div>
        </li>
      ))}
    </ul>
  )
}

function Profile() {
  const { user, applySession, refreshUser } = useAuth()
  const [form, setForm] = useState({ first_name: user?.first_name ?? '', last_name: user?.last_name ?? '', phone: user?.phone ?? '' })
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.first_name.trim().length < 2 || form.last_name.trim().length < 2) return toast.error('Prénom et nom requis')
    if (form.phone && !isValidPhone(form.phone)) return toast.error('Numéro de téléphone invalide')
    setSaving(true)
    try {
      applySession(await accountService.updateProfile({ first_name: form.first_name.trim(), last_name: form.last_name.trim(), phone: form.phone.trim() }))
      toast.success('Profil mis à jour')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const resend = async () => {
    setSending(true)
    try {
      const res = await authService.resendVerification()
      if (res.alreadyVerified) await refreshUser()
      toast.success(res.alreadyVerified ? 'Email déjà confirmé' : 'Lien de confirmation envoyé')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={save} className="max-w-xl space-y-5">
      <div className="rounded-2xl border border-white/5 bg-dark-800 p-4">
        <p className="text-xs uppercase tracking-widest text-gray-500">Email</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <p className="font-medium">{user?.email}</p>
          {user?.email_verified ? (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <HiCheckBadge className="h-4 w-4" /> Confirmé
            </span>
          ) : (
            <button type="button" onClick={resend} disabled={sending} className="flex items-center gap-1 text-xs text-amber-300 hover:underline">
              <HiExclamationTriangle className="h-4 w-4" /> Non confirmé · {sending ? 'envoi…' : 'renvoyer le lien'}
            </button>
          )}
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Input label="Prénom" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required autoComplete="given-name" />
        <Input label="Nom" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required autoComplete="family-name" />
      </div>
      <Input label="Téléphone" type="tel" icon={HiPhone} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="07 00 00 00 00" autoComplete="tel" />
      <Button type="submit" loading={saving}>
        Enregistrer
      </Button>
      <EmailPreferences />
    </form>
  )
}

/** "Nouveautés & offres" emails: the customer's own choice, changeable at any time. */
function EmailPreferences() {
  const [optIn, setOptIn] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    newsletterService
      .getPreferences()
      .then((p) => setOptIn(p.marketingOptIn))
      .catch(() => setOptIn(false))
  }, [])
  const toggle = async () => {
    if (optIn === null) return
    setSaving(true)
    try {
      setOptIn((await newsletterService.setPreferences(!optIn)).marketingOptIn)
      toast.success(!optIn ? 'Vous recevrez nos nouveautés ✨' : 'Vous ne recevrez plus nos emails promotionnels')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="mt-8 flex max-w-xl items-start justify-between gap-4 rounded-2xl border border-white/5 bg-dark-800 p-4">
      <div>
        <p className="font-medium">Nouveautés & recommandations</p>
        <p className="mt-1 text-sm text-gray-400">Arrivages, exclusivités et une sélection basée sur vos achats. Les emails de commande restent envoyés dans tous les cas.</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={optIn ?? false}
        aria-label="Recevoir les nouveautés par email"
        disabled={optIn === null || saving}
        onClick={toggle}
        className={clsx('relative mt-1 h-7 w-12 flex-shrink-0 rounded-full transition-colors disabled:opacity-50', optIn ? 'bg-gold' : 'bg-dark-500')}
      >
        <span className={clsx('absolute top-1 h-5 w-5 rounded-full bg-white transition-all', optIn ? 'left-6' : 'left-1')} />
      </button>
    </div>
  )
}

/** Google / Facebook / TikTok linked to the account. */
function Connections({ accounts, onChange }: { accounts: LinkedAccounts; onChange: (a: LinkedAccounts) => void }) {
  const [busy, setBusy] = useState<SocialProvider | null>(null)
  const shown = accounts.providers.filter((p) => p.enabled || p.linked)
  if (shown.length === 0) return null
  const linkedCount = accounts.providers.filter((p) => p.linked).length

  const link = async (p: SocialProvider) => {
    setBusy(p)
    try {
      await socialService.link(p) // navigates away to the provider
    } catch (err) {
      toast.error(errorMessage(err))
      setBusy(null)
    }
  }

  const unlink = async (p: SocialProvider) => {
    if (!window.confirm(`Délier votre compte ${SOCIAL_PROVIDER_LABELS[p]} ? Vous ne pourrez plus l’utiliser pour vous connecter.`)) return
    setBusy(p)
    try {
      onChange(await socialService.unlink(p))
      toast.success(`${SOCIAL_PROVIDER_LABELS[p]} délié`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-semibold">Comptes connectés</h2>
      <p className="mb-4 mt-1 text-sm text-gray-500">Connectez-vous en un clic avec vos réseaux.</p>
      <ul className="divide-y divide-white/5 rounded-3xl border border-white/5 bg-dark-800">
        {shown.map((p) => {
          const { icon: Icon } = PROVIDER_STYLE[p.provider]
          const lastWay = p.linked && !accounts.passwordSet && linkedCount <= 1
          return (
            <li key={p.provider} className="flex flex-wrap items-center gap-4 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{SOCIAL_PROVIDER_LABELS[p.provider]}</p>
                <p className="truncate text-xs text-gray-500">
                  {p.linked
                    ? `Lié${p.email ? ` · ${p.email}` : p.name ? ` · ${p.name}` : ''}${p.linkedAt ? ` · depuis le ${new Date(p.linkedAt).toLocaleDateString('fr-FR')}` : ''}`
                    : 'Non lié'}
                </p>
              </div>
              {p.linked ? (
                <Button
                  variant="outline"
                  size="sm"
                  loading={busy === p.provider}
                  disabled={busy !== null || lastWay}
                  title={lastWay ? 'Définissez d’abord un mot de passe' : undefined}
                  onClick={() => unlink(p.provider)}
                >
                  Délier
                </Button>
              ) : p.enabled ? (
                <Button size="sm" loading={busy === p.provider} disabled={busy !== null} onClick={() => link(p.provider)}>
                  Lier
                </Button>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Security() {
  const { changePassword } = useAuth()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [accounts, setAccounts] = useState<LinkedAccounts | null>(null)
  const [params, setParams] = useSearchParams()

  useEffect(() => {
    socialService.connections().then(setAccounts).catch(() => setAccounts({ passwordSet: true, providers: [] }))
  }, [])

  // Back from the provider after linking
  useEffect(() => {
    const linked = params.get('linked') as SocialProvider | null
    if (!linked || !(linked in SOCIAL_PROVIDER_LABELS)) return
    toast.success(`${SOCIAL_PROVIDER_LABELS[linked]} est maintenant lié à votre compte`)
    setParams({ tab: 'security' }, { replace: true })
  }, [params, setParams])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const strength = checkPasswordStrength(form.next)
    if (!strength.ok) return toast.error(strength.message ?? 'Mot de passe trop faible')
    if (form.next !== form.confirm) return toast.error('Les deux mots de passe ne correspondent pas')
    setSaving(true)
    try {
      await changePassword(form.current, form.next)
      setForm({ current: '', next: '', confirm: '' })
      toast.success('Mot de passe modifié. Vos autres sessions ont été déconnectées.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (!accounts) return <Spinner />

  return (
    <div className="space-y-12">
      <Connections accounts={accounts} onChange={setAccounts} />
      {accounts.passwordSet ? (
    <form onSubmit={submit} className="max-w-md space-y-5">
      <h2 className="text-lg font-semibold">Mot de passe</h2>
      <Input label="Mot de passe actuel" type="password" icon={HiLockClosed} value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} required autoComplete="current-password" />
      <Input label="Nouveau mot de passe" type="password" icon={HiKey} value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} required autoComplete="new-password" hint="8 caractères minimum, avec des lettres et au moins un chiffre ou symbole." />
      <Input label="Confirmer" type="password" icon={HiKey} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required autoComplete="new-password" />
      <Button type="submit" loading={saving}>
        Changer le mot de passe
      </Button>
      <p className="text-xs text-gray-500">
        Mot de passe oublié ?{' '}
        <Link to="/mot-de-passe-oublie" className="text-gold hover:underline">
          Recevoir un lien de réinitialisation
        </Link>
      </p>
    </form>
      ) : (
        <div className="max-w-md">
          <h2 className="text-lg font-semibold">Mot de passe</h2>
          <p className="mt-2 text-sm text-gray-400">
            Votre compte a été créé avec un réseau social. Définissez un mot de passe pour pouvoir aussi vous connecter avec votre email.
          </p>
          <Link to="/mot-de-passe-oublie" className="mt-4 inline-block">
            <Button variant="outline">Définir un mot de passe</Button>
          </Link>
        </div>
      )}
    </div>
  )
}

/** Customer area: order history, profile, password. */
export default function Account() {
  const { user } = useAuth()
  const { settings } = useSettings()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'orders') as Tab

  return (
    <>
      <Helmet>
        <title>{`Mon compte | ${settings.store_name}`}</title>
      </Helmet>
      <section className="border-b border-white/5 bg-[radial-gradient(ellipse_at_top,rgb(var(--glow)/0.12),transparent_60%)] pb-8 pt-14">
        <div className="container-custom">
          <p className="eyebrow mb-3">Mon compte</p>
          <h1 className="text-4xl font-semibold md:text-5xl">
            Bonjour <span className="text-gold-gradient italic">{user?.first_name}</span>
          </h1>
        </div>
      </section>
      <section className="container-custom grid gap-8 py-10 lg:grid-cols-[220px_1fr]">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col" aria-label="Mon compte">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setParams({ tab: t.id }, { replace: true })}
              className={clsx(
                'flex flex-shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-colors',
                tab === t.id ? 'bg-gold text-primary-black' : 'text-gray-300 hover:bg-white/5',
              )}
              aria-current={tab === t.id ? 'page' : undefined}
            >
              <t.icon className="h-5 w-5" /> {t.label}
            </button>
          ))}
        </nav>
        <div>{tab === 'orders' ? <Orders /> : tab === 'referral' ? <ReferralPanel /> : tab === 'profile' ? <Profile /> : <Security />}</div>
      </section>
    </>
  )
}
