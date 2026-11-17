import { useState } from 'react'
import toast from 'react-hot-toast'
import { HiArrowRight } from 'react-icons/hi2'
import clsx from 'clsx'
import { isValidEmail } from '@trs/shared'
import { engagementService } from '../../services/engagementService'
import { errorMessage } from '../../core/http'
import { preloadRecaptcha } from '../../core/recaptcha'

export default function NewsletterForm({ tone = 'dark', source = 'footer' }: { tone?: 'dark' | 'light' | 'line'; source?: string }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidEmail(email.trim())) {
      toast.error('Adresse email invalide')
      return
    }
    setLoading(true)
    try {
      const res = await engagementService.subscribe(email.trim(), source)
      setDone(true)
      toast.success(res.alreadySubscribed ? 'Vous êtes déjà inscrit(e) ✨' : 'Bienvenue dans le cercle ✨')
      setEmail('')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="w-full" onFocus={preloadRecaptcha}>
      <label htmlFor={`newsletter-${source}`} className="sr-only">
        Adresse email
      </label>
      <div
        className={clsx(
          'flex items-center transition-colors focus-within:border-gold',
          tone === 'line' ? 'border-b border-white/30 pb-2' : 'rounded-full border p-1.5',
          tone === 'dark' && 'border-white/15 bg-white/5',
          tone === 'light' && 'border-primary-black/15 bg-white',
        )}
      >
        <input
          id={`newsletter-${source}`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={done ? 'Merci ! À très vite ✨' : 'Votre adresse email'}
          className={clsx('min-w-0 flex-1 bg-transparent text-sm focus:outline-none', tone === 'line' ? 'px-0' : 'px-4', tone === 'light' ? 'text-primary-black placeholder:text-neutral-400' : 'text-white placeholder:text-gray-500')}
          autoComplete="email"
        />
        <button
          type="submit"
          disabled={loading}
          className={clsx(
            'flex items-center gap-2 text-xs font-semibold uppercase tracking-widest disabled:opacity-60',
            tone === 'line' ? 'h-8 text-white hover:opacity-70' : 'h-10 rounded-full bg-gold-gradient px-5 text-primary-black',
          )}
        >
          {loading ? '…' : "S'inscrire"} <HiArrowRight className="hidden sm:block" />
        </button>
      </div>
    </form>
  )
}
