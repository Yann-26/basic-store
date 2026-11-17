import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { HiCheckCircle, HiEnvelope } from 'react-icons/hi2'
import { newsletterService } from '../services/newsletterService'
import { errorMessage } from '../core/http'
import AuthShell from '../components/auth/AuthShell'
import Button from '../components/ui/Button'

/** Target of the "Se désinscrire" link of campaigns: one confirmation click (mail scanners only GET, so nothing happens by itself). */
export default function Unsubscribe() {
  const [params] = useSearchParams()
  const email = params.get('e') ?? ''
  const token = params.get('t') ?? ''
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  const confirm = async () => {
    setState('busy')
    try {
      await newsletterService.unsubscribe(email, token)
      setState('done')
    } catch (e) {
      setError(errorMessage(e))
      setState('error')
    }
  }

  return (
    <>
      <Helmet>
        <title>Désinscription</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <AuthShell title={state === 'done' ? 'C’est fait' : 'Se désinscrire'} subtitle={state === 'done' ? 'Vous ne recevrez plus nos emails promotionnels.' : 'Ne plus recevoir nos nouveautés par email.'}>
        {state === 'done' ? (
          <div className="space-y-6">
            <p className="flex gap-3 rounded-2xl bg-green-500/10 p-4 text-sm text-green-200">
              <HiCheckCircle className="h-5 w-5 flex-shrink-0" />
              <span>
                <strong>{email}</strong> a été retiré de nos envois. Les emails liés à vos commandes continueront d’arriver.
              </span>
            </p>
            <p className="text-sm text-gray-400">Changé d’avis ? Réabonnez-vous depuis le bas de n’importe quelle page, ou dans Mon compte.</p>
            <Link to="/" className="block">
              <Button className="w-full">Retour à la boutique</Button>
            </Link>
          </div>
        ) : !email || !token ? (
          <p className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-200">Ce lien de désinscription est incomplet. Utilisez le lien présent en bas de nos emails.</p>
        ) : (
          <div className="space-y-6">
            <p className="flex items-center gap-3 rounded-2xl border border-white/10 bg-dark-800 p-4 text-sm">
              <HiEnvelope className="h-5 w-5 text-gold" /> {email}
            </p>
            {state === 'error' && <p className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
            <Button size="lg" className="w-full" onClick={confirm} loading={state === 'busy'}>
              Confirmer la désinscription
            </Button>
          </div>
        )}
      </AuthShell>
    </>
  )
}
