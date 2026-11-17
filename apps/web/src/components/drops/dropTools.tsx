import { useEffect, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { HiCalendarDays, HiBellAlert } from 'react-icons/hi2'
import { dropIcs, isValidEmail, type Drop } from '@trs/shared'
import { dropsService } from '../../services/reviewsService'
import { errorMessage } from '../../core/http'
import { useSettings } from '../../context/SettingsContext'

/** Days, hours, minutes and seconds left before `to`, ticking every second. */
export function Countdown({ to, className = '' }: { to: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const left = Math.max(0, new Date(to).getTime() - now)
  const parts = [
    { v: Math.floor(left / 86_400_000), l: 'jours' },
    { v: Math.floor(left / 3_600_000) % 24, l: 'heures' },
    { v: Math.floor(left / 60_000) % 60, l: 'min' },
    { v: Math.floor(left / 1000) % 60, l: 'sec' },
  ]
  return (
    <div className={`flex gap-5 ${className}`} role="timer" aria-label={`Ouverture dans ${parts[0]!.v} jours et ${parts[1]!.v} heures`}>
      {parts.map((p) => (
        <div key={p.l} className="text-center">
          <span className="block font-display text-4xl tabular-nums text-white md:text-5xl">{String(p.v).padStart(2, '0')}</span>
          <span className="text-[10px] uppercase tracking-[0.3em] text-gray-400">{p.l}</span>
        </div>
      ))}
    </div>
  )
}

/** "Prévenez-moi": an email when the drop opens, and its early access when signed up before it. */
export function RemindForm({ drop }: { drop: Pick<Drop, 'id'> }) {
  const { settings } = useSettings()
  const early = settings.drop_early_access_hours
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!isValidEmail(email.trim())) return toast.error('Adresse email invalide')
    setState('sending')
    try {
      const r = await dropsService.remind(drop.id, email.trim())
      setState('done')
      toast.success(r.already ? 'Vous êtes déjà sur la liste' : early > 0 ? `C’est noté : accès anticipé ${early} h avant l’ouverture` : 'C’est noté : nous vous écrirons à l’ouverture')
    } catch (err) {
      setState('idle')
      toast.error(errorMessage(err))
    }
  }

  if (state === 'done') {
    return (
      <p className="flex items-center gap-2 text-sm text-gold">
        <HiBellAlert className="h-4 w-4" /> {early > 0 ? `Vous êtes sur la liste : accès anticipé ${early} h avant tout le monde.` : 'Vous serez prévenu·e à l’ouverture.'}
      </p>
    )
  }
  return (
    <form onSubmit={submit} className="flex max-w-md items-center gap-3 border-b border-white/30 focus-within:border-gold">
      <label htmlFor={`remind-${drop.id}`} className="sr-only">
        Votre email
      </label>
      <input
        id={`remind-${drop.id}`}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={early > 0 ? `Votre email · accès ${early} h avant tout le monde` : 'Votre email pour être prévenu·e'}
        autoComplete="email"
        className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-gray-500"
      />
      <button type="submit" disabled={state === 'sending'} className="whitespace-nowrap py-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-gold disabled:opacity-50">
        Prévenez-moi
      </button>
    </form>
  )
}

/** Downloads an .ics so the visitor adds the drop to their own calendar. */
export function AddToCalendar({ drop, shopName, className = '' }: { drop: Drop; shopName: string; className?: string }) {
  const download = () => {
    const ics = dropIcs(drop, { shopName, url: `${window.location.origin}/drops` })
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${drop.title.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase() || 'drop'}.ics`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <button type="button" onClick={download} className={`inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-gray-300 transition-colors hover:text-gold ${className}`}>
      <HiCalendarDays className="h-4 w-4" /> Ajouter à mon agenda
    </button>
  )
}
