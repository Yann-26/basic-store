import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import toast from 'react-hot-toast'
import { HiLockClosed } from 'react-icons/hi2'
import { checkPasswordStrength } from '@trs/shared'
import { authService } from '../services/authService'
import { errorMessage } from '../core/http'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import AuthShell from '../components/auth/AuthShell'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

export default function ResetPassword() {
  const { settings } = useSettings()
  const { logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const token = useSearchParams()[0].get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const strength = checkPasswordStrength(password)
    if (!strength.ok) return setError(strength.message ?? 'Mot de passe trop faible')
    if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas')
    setLoading(true)
    setError(null)
    try {
      await authService.resetPassword(token, password)
      // Every session was revoked server-side, this one included.
      if (isAuthenticated) logout(true)
      toast.success('Mot de passe modifié. Connectez-vous avec le nouveau.')
      navigate('/login', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Lien invalide ou expiré'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>{`Nouveau mot de passe | ${settings.store_name}`}</title>
      </Helmet>
      <AuthShell title="Nouveau mot de passe" subtitle="Choisissez un mot de passe que vous n'utilisez nulle part ailleurs.">
        {!token ? (
          <div className="space-y-4 text-center">
            <p className="text-gray-300">Ce lien est incomplet.</p>
            <Link to="/mot-de-passe-oublie" className="text-gold hover:underline">
              Demander un nouveau lien
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-5">
            <Input label="Nouveau mot de passe" type="password" icon={HiLockClosed} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" hint="8 caractères minimum, avec des lettres et au moins un chiffre ou symbole." autoFocus />
            <Input label="Confirmer" type="password" icon={HiLockClosed} value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
            {error && (
              <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}{' '}
                {/expir|invalide/i.test(error) && (
                  <Link to="/mot-de-passe-oublie" className="underline">
                    Nouveau lien
                  </Link>
                )}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" loading={loading}>
              Enregistrer
            </Button>
          </form>
        )}
      </AuthShell>
    </>
  )
}
