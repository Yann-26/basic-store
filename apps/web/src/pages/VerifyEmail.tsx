import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { HiCheckCircle, HiExclamationTriangle } from 'react-icons/hi2'
import { authService } from '../services/authService'
import { errorMessage } from '../core/http'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import AuthShell from '../components/auth/AuthShell'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'

/** Landing page of the confirmation link sent by email. */
export default function VerifyEmail() {
  const { settings } = useSettings()
  const { refreshUser, isAuthenticated } = useAuth()
  const token = useSearchParams()[0].get('token') ?? ''
  const [state, setState] = useState<'loading' | 'done' | 'error'>(token ? 'loading' : 'error')
  const [message, setMessage] = useState('Ce lien est incomplet.')
  const ran = useRef(false)

  useEffect(() => {
    // The link is single-use: never call twice (StrictMode runs effects twice in dev).
    if (!token || ran.current) return
    ran.current = true
    authService
      .verifyEmail(token)
      .then(async () => {
        setState('done')
        if (isAuthenticated) await refreshUser()
      })
      .catch((err) => {
        setMessage(errorMessage(err, 'Ce lien est invalide ou a expiré.'))
        setState('error')
      })
  }, [token, isAuthenticated, refreshUser])

  return (
    <>
      <Helmet>
        <title>{`Confirmation de l'email | ${settings.store_name}`}</title>
      </Helmet>
      <AuthShell title="Confirmation de l'email" subtitle="Dernière étape avant votre première précommande.">
        <div className="space-y-6 text-center">
          {state === 'loading' && <Spinner size="lg" />}
          {state === 'done' && (
            <>
              <HiCheckCircle className="mx-auto h-14 w-14 text-gold" />
              <p className="text-lg">Votre adresse email est confirmée.</p>
              <Link to="/collection">
                <Button size="lg">Découvrir la boutique</Button>
              </Link>
            </>
          )}
          {state === 'error' && (
            <>
              <HiExclamationTriangle className="mx-auto h-14 w-14 text-amber-400" />
              <p className="text-gray-300">{message}</p>
              <p className="text-sm text-gray-500">
                {isAuthenticated ? (
                  <>
                    Renvoyez un lien depuis{' '}
                    <Link to="/compte" className="text-gold hover:underline">
                      Mon compte
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    <Link to="/login" className="text-gold hover:underline">
                      Connectez-vous
                    </Link>{' '}
                    pour recevoir un nouveau lien.
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </AuthShell>
    </>
  )
}
