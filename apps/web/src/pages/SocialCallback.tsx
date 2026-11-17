import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import toast from 'react-hot-toast'
import { HiEnvelope, HiExclamationTriangle, HiUser } from 'react-icons/hi2'
import { isValidEmail, SOCIAL_PROVIDER_LABELS, SOCIAL_PROVIDERS, type SocialProvider } from '@trs/shared'
import { useAuth } from '../context/AuthContext'
import { socialService } from '../services/socialService'
import { errorMessage } from '../core/http'
import AuthShell from '../components/auth/AuthShell'
import { safeRedirect } from '../components/auth/RequireAuth'
import { PROVIDER_STYLE } from '../components/auth/providerStyle'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'

type Landing =
  | { kind: 'code'; code: string; next: string }
  | { kind: 'signup'; ticket: string; provider: SocialProvider; next: string }
  | { kind: 'error'; message: string }

/** The API puts the result in the URL fragment (never sent to a server); read it once, then wipe it. */
function readLanding(): Landing {
  const q = new URLSearchParams(window.location.hash.slice(1))
  const next = safeRedirect(q.get('next'))
  const provider = q.get('provider') as SocialProvider | null
  if (q.get('code')) return { kind: 'code', code: q.get('code')!, next }
  if (q.get('signup') && provider && SOCIAL_PROVIDERS.includes(provider)) return { kind: 'signup', ticket: q.get('signup')!, provider, next }
  return { kind: 'error', message: q.get('error') || 'La connexion a échoué. Réessayez.' }
}

function SignupForm({ ticket, provider, next }: { ticket: string; provider: SocialProvider; next: string }) {
  const { applySession } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { icon: Icon } = PROVIDER_STYLE[provider]

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidEmail(form.email.trim())) return setError('Adresse email invalide')
    if (form.firstName.trim().length < 2 || form.lastName.trim().length < 2) return setError('Prénom et nom requis')
    setLoading(true)
    setError(null)
    try {
      applySession(await socialService.completeSignup({ ticket, email: form.email.trim(), firstName: form.firstName.trim(), lastName: form.lastName.trim() }))
      toast.success('Compte créé ✨ Confirmez votre email pour pouvoir commander.')
      navigate(next, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-dark-800 p-4 text-sm text-gray-300">
        <Icon className="h-6 w-6 flex-shrink-0" />
        <span>
          {SOCIAL_PROVIDER_LABELS[provider]} ne partage pas votre adresse email. Indiquez-la pour recevoir le suivi de vos commandes.
        </span>
      </div>
      <Input label="Email" type="email" icon={HiEnvelope} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email" />
      <div className="grid gap-5 sm:grid-cols-2">
        <Input label="Prénom" icon={HiUser} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required autoComplete="given-name" />
        <Input label="Nom" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required autoComplete="family-name" />
      </div>
      {error && <p className="rounded-2xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      <Button type="submit" size="lg" className="w-full" loading={loading}>
        Créer mon compte
      </Button>
      <p className="text-center text-xs text-gray-500">Un lien de confirmation vous sera envoyé par email.</p>
    </form>
  )
}

/** Where Google / Facebook / TikTok sign-in lands (via the API callback). */
export default function SocialCallback() {
  const [landing] = useState(readLanding)
  const [failure, setFailure] = useState<string | null>(landing.kind === 'error' ? landing.message : null)
  const { applySession } = useAuth()
  const navigate = useNavigate()
  const done = useRef(false)

  useEffect(() => {
    // Keep the one-time code out of the history and of any later copy of the URL.
    window.history.replaceState(window.history.state, '', window.location.pathname)
    if (landing.kind !== 'code' || done.current) return
    done.current = true // StrictMode runs effects twice; the code only works once
    socialService
      .exchange(landing.code)
      .then((res) => {
        applySession(res)
        toast.success(`Bienvenue ${res.user.first_name} ✨`)
        navigate(landing.next, { replace: true })
      })
      .catch((err) => setFailure(errorMessage(err)))
  }, [landing, applySession, navigate])

  return (
    <>
      <Helmet>
        <title>Connexion</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      {failure ? (
        <AuthShell title="Connexion impossible" subtitle="Nous n’avons pas pu vous connecter.">
          <div className="space-y-6">
            <p className="flex gap-3 rounded-2xl bg-red-500/10 p-4 text-sm text-red-200">
              <HiExclamationTriangle className="h-5 w-5 flex-shrink-0 text-red-300" />
              <span>{failure}</span>
            </p>
            <Link to="/login" replace className="block">
              <Button size="lg" className="w-full">
                Retour à la connexion
              </Button>
            </Link>
          </div>
        </AuthShell>
      ) : landing.kind === 'signup' ? (
        <AuthShell title="Dernière étape" subtitle="Complétez votre compte pour rejoindre le Cercle.">
          <SignupForm ticket={landing.ticket} provider={landing.provider} next={landing.next} />
        </AuthShell>
      ) : (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-gray-400">
          <Spinner />
          <p>Connexion en cours…</p>
        </div>
      )}
    </>
  )
}
