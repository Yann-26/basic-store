import { useEffect, useState } from 'react'
import { HiCheckCircle, HiEnvelope, HiExclamationTriangle, HiPaperAirplane } from 'react-icons/hi2'
import { http, errorMessage } from '../../core/http'
import Button from '../../components/ui/Button'

type Provider = 'smtp' | 'brevo' | 'none'
interface Status {
  provider: Provider
  from: string | null
}
interface TestResult extends Status {
  sent: boolean
  to: string
  error: string | null
}

const LABEL: Record<Provider, string> = { smtp: 'Gmail (SMTP)', brevo: 'Brevo', none: 'Aucun' }

/** Shows which service sends the emails and sends a test to the signed-in admin. */
export default function EmailTest() {
  const [status, setStatus] = useState<Status | null>(null)
  const [result, setResult] = useState<TestResult | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    http.get<Status>('/admin/email/test').then(setStatus).catch(() => setStatus({ provider: 'none', from: null }))
  }, [])

  const send = async () => {
    setSending(true)
    setResult(null)
    try {
      setResult(await http.post<TestResult>('/admin/email/test'))
    } catch (err) {
      setResult({ sent: false, to: '', provider: status?.provider ?? 'none', from: status?.from ?? null, error: errorMessage(err) })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6 rounded-2xl border border-dark-600 bg-dark-800 p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10">
          <HiEnvelope className="h-5 w-5 text-gold" />
        </div>
        <h2 className="text-lg font-bold uppercase tracking-wider">Envoi des emails</h2>
      </div>

      <div className="rounded-xl bg-dark-700 p-4 text-sm">
        <p className="text-gray-400">
          Service : <strong className="text-white">{status ? LABEL[status.provider] : '…'}</strong>
          {status?.from && (
            <>
              {' '}· expéditeur <strong className="text-white">{status.from}</strong>
            </>
          )}
        </p>
        {status?.provider === 'none' && (
          <p className="mt-2 text-amber-300">
            Aucun email ne part pour l’instant. Ajoutez <code>SMTP_USER</code> (votre Gmail) et <code>SMTP_PASS</code> (un mot de passe d’application Google) dans Vercel, puis redéployez.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button icon={HiPaperAirplane} onClick={send} loading={sending} disabled={!status || status.provider === 'none'}>
          Envoyer un email de test
        </Button>
        <p className="text-xs text-gray-500">Il sera envoyé à votre adresse d’administrateur.</p>
      </div>

      {result &&
        (result.sent ? (
          <p className="flex items-start gap-2 rounded-xl bg-green-500/10 p-4 text-sm text-green-300">
            <HiCheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <span>
              Email envoyé à <strong>{result.to}</strong>. Pensez à regarder dans les spams la première fois.
            </span>
          </p>
        ) : (
          <p className="flex items-start gap-2 rounded-xl bg-red-500/10 p-4 text-sm text-red-300">
            <HiExclamationTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <span>Échec de l’envoi : {result.error}</span>
          </p>
        ))}
    </div>
  )
}
