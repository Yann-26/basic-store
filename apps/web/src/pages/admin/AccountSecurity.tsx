import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { HiDevicePhoneMobile, HiKey, HiLockClosed, HiShieldCheck } from 'react-icons/hi2'
import { checkPasswordStrength, type TwoFactorStatus } from '@trs/shared'
import { useAuth } from '../../context/AuthContext'
import { errorMessage } from '../../core/http'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import RecoveryCodes from '../../components/admin/RecoveryCodes'
import { authService } from '../../services/authService'

const EMPTY = { current: '', next: '', confirm: '' }

/** Admin account security: password change (logs out every other session). */
export default function AccountSecurity() {
  const { user, changePassword } = useAuth()
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const strength = checkPasswordStrength(form.next)
    if (!strength.ok) return setError(strength.message ?? 'Mot de passe trop faible')
    if (form.next !== form.confirm) return setError('Les deux nouveaux mots de passe ne correspondent pas')
    setSaving(true)
    try {
      await changePassword(form.current, form.next)
      setForm(EMPTY)
      toast.success('Mot de passe modifié. Vos autres sessions ont été déconnectées.')
    } catch (err) {
      setError(errorMessage(err, 'Modification impossible'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <TwoFactorPanel />
      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <HiShieldCheck className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h2 className="text-lg font-bold uppercase tracking-wider">Sécurité du compte</h2>
            <p className="text-sm text-gray-400">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={submit} className="max-w-md space-y-5" autoComplete="on">
          <input type="email" name="username" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
          <Input
            label="Mot de passe actuel"
            type="password"
            icon={HiLockClosed}
            autoComplete="current-password"
            required
            value={form.current}
            onChange={(e) => setForm({ ...form, current: e.target.value })}
          />
          <Input
            label="Nouveau mot de passe"
            type="password"
            icon={HiKey}
            autoComplete="new-password"
            hint="8 caractères minimum, avec des lettres et au moins un chiffre ou symbole."
            required
            value={form.next}
            onChange={(e) => setForm({ ...form, next: e.target.value })}
          />
          <Input
            label="Confirmer le nouveau mot de passe"
            type="password"
            icon={HiKey}
            autoComplete="new-password"
            required
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
          {error && (
            <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}
          <Button type="submit" loading={saving}>
            Changer le mot de passe
          </Button>
        </form>

        <p className="text-xs text-gray-500">
          Après le changement, toutes les autres sessions ouvertes avec ce compte sont déconnectées.
        </p>
      </div>
    </div>
  )
}

/** Two-factor status and new recovery codes (needs a current authenticator code). */
function TwoFactorPanel() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null)
  const [code, setCode] = useState('')
  const [codes, setCodes] = useState<string[] | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    authService.twoFactorStatus().then(setStatus).catch(() => setStatus(null))
  }, [])

  const regenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await authService.regenerateRecoveryCodes(code)
      setCodes(res.recoveryCodes)
      setStatus((s) => (s ? { ...s, recoveryCodesLeft: res.recoveryCodes.length } : s))
      setCode('')
      toast.success('Nouveaux codes générés. Les anciens ne fonctionnent plus.')
    } catch (err) {
      toast.error(errorMessage(err, 'Code incorrect'))
    } finally {
      setSaving(false)
    }
  }

  const left = status?.recoveryCodesLeft ?? 0
  return (
    <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
          <HiDevicePhoneMobile className="w-5 h-5 text-gold" />
        </div>
        <div>
          <h2 className="text-lg font-bold uppercase tracking-wider">Double authentification</h2>
          <p className="text-sm text-gray-400">Obligatoire pour tous les administrateurs, à chaque connexion.</p>
        </div>
        {status?.enabled && <span className="ml-auto rounded-full bg-green-500/10 px-3 py-1 text-xs text-green-400">Activée</span>}
      </div>

      {status && (
        <p className="text-sm text-gray-300">
          Activée le {status.enabledAt ? new Date(status.enabledAt).toLocaleDateString('fr-FR') : '—'} ·{' '}
          <span className={left <= 2 ? 'text-amber-400' : undefined}>
            {left} code{left > 1 ? 's' : ''} de secours restant{left > 1 ? 's' : ''}
          </span>
        </p>
      )}

      {codes ? (
        <div className="max-w-md">
          <RecoveryCodes codes={codes} />
        </div>
      ) : (
        <form onSubmit={regenerate} className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Code de l'application"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </div>
          <Button type="submit" variant="outline" loading={saving} disabled={code.length !== 6}>
            Nouveaux codes de secours
          </Button>
        </form>
      )}
      <p className="text-xs text-gray-500">
        Téléphone perdu et plus de codes de secours ? Le propriétaire du site peut réinitialiser votre double authentification ; vous la configurerez à nouveau à la
        prochaine connexion.
      </p>
    </div>
  )
}
