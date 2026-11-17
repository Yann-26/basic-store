import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'
import { HiEnvelope, HiLockClosed, HiEye, HiEyeSlash, HiExclamationCircle, HiShieldCheck, HiDevicePhoneMobile, HiArrowLeft } from 'react-icons/hi2'
import type { AdminLoginResult } from '@trs/shared'
import { useAuth } from '../../context/AuthContext'
import { ApiError, errorMessage } from '../../core/http'
import { useRecaptchaPreload } from '../../hooks/useRecaptchaPreload'
import { useAdminApp } from '../../pwa/adminApp'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import Logo from '../../components/ui/Logo'
import RecaptchaNotice from '../../components/ui/RecaptchaNotice'
import RecoveryCodes from '../../components/admin/RecoveryCodes'

type Step = { kind: 'credentials' } | { kind: 'verify'; challenge: string } | { kind: 'setup'; challenge: string; secret: string; otpauthUrl: string } | { kind: 'codes'; codes: string[] }

const toStep = (r: AdminLoginResult): Step =>
  r.status === 'mfa_setup' ? { kind: 'setup', challenge: r.challenge, secret: r.secret, otpauthUrl: r.otpauthUrl } : { kind: 'verify', challenge: r.challenge }

/** "ABCDEFGH…" → "ABCD EFGH …" for manual entry. */
const groupSecret = (s: string) => s.replace(/(.{4})/g, '$1 ').trim()

/** 6-digit authenticator code field. */
function CodeInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus
      disabled={disabled}
      placeholder="000000"
      aria-label="Code à 6 chiffres"
      className="field text-center font-mono text-3xl tracking-[0.5em] placeholder:text-gray-700"
    />
  )
}

/**
 * Back-office sign-in with mandatory two-factor authentication:
 * password → (first time: scan the QR code) → 6-digit code from the app.
 */
export default function AdminLogin() {
  const [step, setStep] = useState<Step>({ kind: 'credentials' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [code, setCode] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)
  const [qr, setQr] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { adminLogin, completeAdminTwoFactor, isAdmin } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/admin'
  useRecaptchaPreload()
  // The installed app opens here when signed out: keep its manifest attached
  useAdminApp()

  const otpauthUrl = step.kind === 'setup' ? step.otpauthUrl : null
  useEffect(() => {
    if (!otpauthUrl) return
    QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220, color: { dark: '#0A0A0A', light: '#FFFFFF' } })
      .then(setQr)
      .catch(() => setQr(null))
  }, [otpauthUrl])

  // Stay on the recovery-codes screen even though the session is already open.
  if (isAdmin && step.kind !== 'codes') return <Navigate to="/admin" replace />

  const restart = (message?: string) => {
    setStep({ kind: 'credentials' })
    setCode('')
    setUseRecovery(false)
    setPassword('')
    setError(message ?? null)
  }

  const submitCredentials = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      setStep(toStep(await adminLogin(email.trim(), password)))
      setCode('')
    } catch (err) {
      setError(errorMessage(err, 'Connexion impossible'))
    } finally {
      setLoading(false)
    }
  }

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (step.kind !== 'verify' && step.kind !== 'setup') return
    if (!useRecovery && code.length !== 6) return setError('Entrez le code à 6 chiffres de votre application')
    setLoading(true)
    setError(null)
    try {
      const res = await completeAdminTwoFactor(step.challenge, code)
      if (res.recoveryCodes) {
        setStep({ kind: 'codes', codes: res.recoveryCodes })
        return
      }
      if (res.recoveryCodesLeft !== undefined) {
        toast(`Code de secours utilisé. Il vous en reste ${res.recoveryCodesLeft}.`, { icon: '🔑' })
      }
      toast.success(`Bienvenue ${res.user.first_name}`)
      navigate(from, { replace: true })
    } catch (err) {
      // Expired challenge or too many attempts: back to the password.
      if (err instanceof ApiError && (err.status === 401 || err.status === 429)) restart(errorMessage(err))
      else setError(errorMessage(err, 'Code incorrect'))
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-primary-black p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.15),transparent_60%)]" />
      <motion.div key={step.kind} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md">
        <div className="mb-10 text-center">
          <Logo size="lg" className="justify-center" />
          <p className="eyebrow mt-6">Espace administration</p>
        </div>

        {error && (
          <div role="alert" className="mb-6 flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
            <HiExclamationCircle className="h-5 w-5 flex-shrink-0 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {step.kind === 'credentials' && (
          <form onSubmit={submitCredentials} className="space-y-5 rounded-3xl border border-gold/20 bg-dark-800/80 p-8 backdrop-blur">
            <Input label="Email" type="email" icon={HiEnvelope} value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} autoComplete="username" />
            <div className="relative">
              <Input label="Mot de passe" type={show ? 'text' : 'password'} icon={HiLockClosed} value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} autoComplete="current-password" />
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-4 top-[38px] text-gray-500 hover:text-white" aria-label={show ? 'Masquer' : 'Afficher'}>
                {show ? <HiEyeSlash className="h-5 w-5" /> : <HiEye className="h-5 w-5" />}
              </button>
            </div>
            <Button type="submit" size="lg" loading={loading} className="w-full">
              Continuer
            </Button>
            <p className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <HiShieldCheck className="h-4 w-4 text-gold" /> Double authentification obligatoire
            </p>
            <RecaptchaNotice className="text-center" />
          </form>
        )}

        {step.kind === 'verify' && (
          <form onSubmit={submitCode} className="space-y-5 rounded-3xl border border-gold/20 bg-dark-800/80 p-8 backdrop-blur">
            <div className="text-center">
              <HiDevicePhoneMobile className="mx-auto h-10 w-10 text-gold" />
              <h1 className="mt-3 font-display text-2xl">Vérification en deux étapes</h1>
              <p className="mt-2 text-sm text-gray-400">
                {useRecovery ? 'Entrez un de vos codes de secours.' : "Entrez le code à 6 chiffres affiché par votre application d'authentification."}
              </p>
            </div>
            {useRecovery ? (
              <Input label="Code de secours" value={code} onChange={(e) => setCode(e.target.value)} placeholder="xxxx-xxxx" autoComplete="off" autoFocus disabled={loading} />
            ) : (
              <CodeInput value={code} onChange={setCode} disabled={loading} />
            )}
            <Button type="submit" size="lg" loading={loading} className="w-full">
              Vérifier
            </Button>
            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => restart()} className="inline-flex items-center gap-1 text-gray-500 hover:text-white">
                <HiArrowLeft className="h-3 w-3" /> Retour
              </button>
              <button
                type="button"
                onClick={() => {
                  setUseRecovery((v) => !v)
                  setCode('')
                  setError(null)
                }}
                className="text-gold hover:underline"
              >
                {useRecovery ? "Utiliser l'application" : 'Utiliser un code de secours'}
              </button>
            </div>
          </form>
        )}

        {step.kind === 'setup' && (
          <form onSubmit={submitCode} className="space-y-5 rounded-3xl border border-gold/20 bg-dark-800/80 p-8 backdrop-blur">
            <div className="text-center">
              <HiShieldCheck className="mx-auto h-10 w-10 text-gold" />
              <h1 className="mt-3 font-display text-2xl">Activez la double authentification</h1>
              <p className="mt-2 text-sm text-gray-400">Obligatoire pour tous les administrateurs, une seule fois.</p>
            </div>
            <ol className="space-y-2 text-sm text-gray-300">
              <li>
                <span className="text-gold">1.</span> Installez <strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong> ou <strong>Authy</strong> sur votre téléphone.
              </li>
              <li>
                <span className="text-gold">2.</span> Scannez ce QR code avec l'application.
              </li>
            </ol>
            <div className="flex justify-center">
              <div className="rounded-2xl bg-white p-3">
                {qr ? <img src={qr} alt="QR code à scanner avec votre application d'authentification" className="h-[200px] w-[200px]" /> : <div className="h-[200px] w-[200px] animate-pulse bg-gray-200" />}
              </div>
            </div>
            <details className="text-center text-xs text-gray-500">
              <summary className="cursor-pointer hover:text-gray-300">Impossible de scanner ? Saisir la clé à la main</summary>
              <p className="mt-2 select-all break-all font-mono text-sm tracking-wider text-gold">{groupSecret(step.secret)}</p>
            </details>
            <p className="text-sm text-gray-300">
              <span className="text-gold">3.</span> Entrez le code à 6 chiffres affiché :
            </p>
            <CodeInput value={code} onChange={setCode} disabled={loading} />
            <Button type="submit" size="lg" loading={loading} className="w-full">
              Activer et me connecter
            </Button>
            <button type="button" onClick={() => restart()} className="inline-flex w-full items-center justify-center gap-1 text-xs text-gray-500 hover:text-white">
              <HiArrowLeft className="h-3 w-3" /> Retour
            </button>
          </form>
        )}

        {step.kind === 'codes' && (
          <div className="space-y-5 rounded-3xl border border-gold/20 bg-dark-800/80 p-8 backdrop-blur">
            <div className="text-center">
              <HiShieldCheck className="mx-auto h-10 w-10 text-green-400" />
              <h1 className="mt-3 font-display text-2xl">Double authentification activée</h1>
              <p className="mt-2 text-sm text-gray-400">Sauvegardez ces codes de secours maintenant.</p>
            </div>
            <RecoveryCodes codes={step.codes} />
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="h-4 w-4 accent-[#D4AF37]" />
              J'ai sauvegardé mes codes de secours
            </label>
            <Button size="lg" className="w-full" disabled={!saved} onClick={() => navigate(from, { replace: true })}>
              Accéder au tableau de bord
            </Button>
          </div>
        )}

        <p className="mt-6 text-center">
          <Link to="/" className="text-sm text-gray-500 hover:text-gold">
            ← Retour à la boutique
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
