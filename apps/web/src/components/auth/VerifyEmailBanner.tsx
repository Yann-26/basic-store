import { useState } from 'react'
import toast from 'react-hot-toast'
import { HiEnvelope } from 'react-icons/hi2'
import { useAuth } from '../../context/AuthContext'
import { authService } from '../../services/authService'
import { errorMessage } from '../../core/http'

/** Reminder for signed-in customers whose email isn't confirmed yet (needed to order). */
export default function VerifyEmailBanner({ className = '' }: { className?: string }) {
  const { user, refreshUser } = useAuth()
  const [sending, setSending] = useState(false)
  if (!user || user.email_verified !== false) return null

  const resend = async () => {
    setSending(true)
    try {
      const res = await authService.resendVerification()
      if (res.alreadyVerified) {
        await refreshUser()
        toast.success('Votre email est déjà confirmé')
      } else toast.success(`Lien envoyé à ${user.email}`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <div role="status" className={`border-b border-gold/30 bg-gold/10 ${className}`}>
      <div className="container-custom flex flex-col items-center justify-center gap-2 py-3 text-center text-sm sm:flex-row sm:gap-4">
        <span className="flex items-center gap-2 text-gray-200">
          <HiEnvelope className="h-4 w-4 flex-shrink-0 text-gold" />
          <span>
            Confirmez votre email (<strong className="text-white">{user.email}</strong>) pour pouvoir passer commande.
          </span>
        </span>
        <button onClick={resend} disabled={sending} className="font-semibold text-gold underline-offset-4 hover:underline disabled:opacity-50">
          {sending ? 'Envoi…' : 'Renvoyer le lien'}
        </button>
      </div>
    </div>
  )
}
