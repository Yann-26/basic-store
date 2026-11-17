import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import clsx from 'clsx'
import { HiEnvelope, HiLockClosed, HiPhone, HiUser } from 'react-icons/hi2'
import { checkPasswordStrength, isValidEmail, isValidPhone } from '@trs/shared'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useRecaptchaPreload } from '../hooks/useRecaptchaPreload'
import AuthShell from '../components/auth/AuthShell'
import SocialButtons from '../components/auth/SocialButtons'
import { safeRedirect } from '../components/auth/RequireAuth'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import RecaptchaNotice from '../components/ui/RecaptchaNotice'

function strength(pw: string): number {
  let s = 0
  if (pw.length >= 8) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return s
}

export default function Register() {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', confirm: '' })
  const [optIn, setOptIn] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const { settings } = useSettings()
  const navigate = useNavigate()
  const state = useLocation().state as { from?: string; reason?: string } | null
  useRecaptchaPreload()

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const score = strength(form.password)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (form.firstName.trim().length < 2) errs.firstName = 'Prénom trop court'
    if (form.lastName.trim().length < 2) errs.lastName = 'Nom trop court'
    if (!isValidEmail(form.email.trim())) errs.email = 'Email invalide'
    if (form.phone && !isValidPhone(form.phone)) errs.phone = 'Téléphone invalide'
    const pw = checkPasswordStrength(form.password)
    if (!pw.ok) errs.password = pw.message!
    if (form.password !== form.confirm) errs.confirm = 'Les mots de passe ne correspondent pas'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setLoading(true)
    const user = await register({ firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim(), phone: form.phone || undefined, password: form.password, marketingOptIn: optIn })
    setLoading(false)
    if (user) navigate(safeRedirect(state?.from), { replace: true })
  }

  return (
    <>
      <Helmet>
        <title>{`Créer un compte | ${settings.store_name}`}</title>
      </Helmet>
      <AuthShell title="Rejoindre le Cercle" subtitle="Créez votre compte en quelques secondes.">
        <SocialButtons next={safeRedirect(state?.from)} />
        <form onSubmit={submit} noValidate className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Input label="Prénom" icon={HiUser} value={form.firstName} onChange={set('firstName')} error={errors.firstName} required autoComplete="given-name" />
            <Input label="Nom" value={form.lastName} onChange={set('lastName')} error={errors.lastName} required autoComplete="family-name" />
          </div>
          <Input label="Email" type="email" icon={HiEnvelope} value={form.email} onChange={set('email')} error={errors.email} required autoComplete="email" />
          <Input label="Téléphone" type="tel" icon={HiPhone} value={form.phone} onChange={set('phone')} error={errors.phone} hint="Optionnel — pour le suivi de livraison" autoComplete="tel" />
          <div>
            <Input label="Mot de passe" type="password" icon={HiLockClosed} value={form.password} onChange={set('password')} error={errors.password} required autoComplete="new-password" />
            <div className="mt-2 flex gap-1" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={clsx('h-1 flex-1 rounded-full', i < score ? (score >= 3 ? 'bg-gold' : 'bg-amber-600') : 'bg-white/10')} />
              ))}
            </div>
          </div>
          <Input label="Confirmer le mot de passe" type="password" icon={HiLockClosed} value={form.confirm} onChange={set('confirm')} error={errors.confirm} required autoComplete="new-password" />
          <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-300">
            <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-gold)]" />
            <span>
              Je souhaite recevoir les nouveautés, les promos et des recommandations personnalisées par email.{' '}
              <span className="text-gray-500">Désinscription en un clic à tout moment.</span>
            </span>
          </label>
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Créer mon compte
          </Button>
          <RecaptchaNotice />
          <p className="text-center text-sm text-gray-400">
            Déjà membre ?{' '}
            <Link to="/login" state={state} className="text-gold hover:underline">
              Se connecter
            </Link>
          </p>
        </form>
      </AuthShell>
    </>
  )
}
