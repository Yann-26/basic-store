import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { HiEnvelope, HiLockClosed, HiEye, HiEyeSlash } from 'react-icons/hi2'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useRecaptchaPreload } from '../hooks/useRecaptchaPreload'
import AuthShell from '../components/auth/AuthShell'
import SocialButtons from '../components/auth/SocialButtons'
import { safeRedirect } from '../components/auth/RequireAuth'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import RecaptchaNotice from '../components/ui/RecaptchaNotice'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const { settings } = useSettings()
  const navigate = useNavigate()
  const state = useLocation().state as { from?: string; reason?: string } | null
  const from = safeRedirect(state?.from)
  useRecaptchaPreload()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const user = await login(email.trim(), password)
    setLoading(false)
    if (user) navigate(user.role === 'admin' && from === '/' ? '/admin' : from, { replace: true })
  }

  return (
    <>
      <Helmet>
        <title>{`Connexion | ${settings.store_name}`}</title>
      </Helmet>
      <AuthShell title="Bon retour" subtitle={state?.reason ?? 'Connectez-vous à votre compte.'}>
        <SocialButtons next={from} />
        <form onSubmit={submit} className="space-y-5">
          <Input label="Email" type="email" icon={HiEnvelope} value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          <div className="relative">
            <Input label="Mot de passe" type={show ? 'text' : 'password'} icon={HiLockClosed} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-4 top-[38px] text-gray-500 hover:text-white" aria-label={show ? 'Masquer' : 'Afficher'}>
              {show ? <HiEyeSlash className="h-5 w-5" /> : <HiEye className="h-5 w-5" />}
            </button>
          </div>
          <div className="-mt-2 text-right">
            <Link to="/mot-de-passe-oublie" className="text-xs text-gray-400 hover:text-gold">
              Mot de passe oublié ?
            </Link>
          </div>
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Se connecter
          </Button>
          <RecaptchaNotice />
          <p className="text-center text-sm text-gray-400">
            Pas encore de compte ?{' '}
            <Link to="/register" state={state} className="text-gold hover:underline">
              Créer un compte
            </Link>
          </p>
        </form>
      </AuthShell>
    </>
  )
}
