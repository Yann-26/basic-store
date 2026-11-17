import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { HiEnvelope, HiCheckCircle } from 'react-icons/hi2'
import { isValidEmail } from '@trs/shared'
import { authService } from '../services/authService'
import { errorMessage } from '../core/http'
import { useSettings } from '../context/SettingsContext'
import { useRecaptchaPreload } from '../hooks/useRecaptchaPreload'
import AuthShell from '../components/auth/AuthShell'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import RecaptchaNotice from '../components/ui/RecaptchaNotice'

export default function ForgotPassword() {
  const { settings } = useSettings()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useRecaptchaPreload()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidEmail(email.trim())) return setError('Email invalide')
    setLoading(true)
    setError(null)
    try {
      await authService.forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(errorMessage(err, 'Envoi impossible, réessayez.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>{`Mot de passe oublié | ${settings.store_name}`}</title>
      </Helmet>
      <AuthShell title="Mot de passe oublié" subtitle="Recevez un lien pour en choisir un nouveau.">
        {sent ? (
          <div className="space-y-6 text-center">
            <HiCheckCircle className="mx-auto h-12 w-12 text-gold" />
            <p className="text-gray-300">
              Si un compte existe pour <strong className="text-white">{email.trim()}</strong>, un email avec un lien de réinitialisation vient de partir. Il est valable 1 heure.
            </p>
            <p className="text-sm text-gray-500">Pensez à vérifier vos courriers indésirables.</p>
            <Link to="/login" className="inline-block text-sm text-gold hover:underline">
              Retour à la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-5">
            <Input label="Email du compte" type="email" icon={HiEnvelope} value={email} onChange={(e) => setEmail(e.target.value)} error={error ?? undefined} required autoComplete="email" autoFocus />
            <Button type="submit" size="lg" className="w-full" loading={loading}>
              Envoyer le lien
            </Button>
            <RecaptchaNotice />
            <p className="text-center text-sm text-gray-400">
              <Link to="/login" className="text-gold hover:underline">
                Retour à la connexion
              </Link>
            </p>
          </form>
        )}
      </AuthShell>
    </>
  )
}
