import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { HiClipboardDocument } from 'react-icons/hi2'
import { formatCurrency } from '@trs/shared'
import { useSettings } from '../../context/SettingsContext'
import { socialUrl } from '../../utils/constants'
import Button from '../ui/Button'

const EASE = [0.22, 1, 0.36, 1] as const

/** Gold flakes bursting from the seal, at stable positions. */
function burst(n: number) {
  let s = 11
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  return Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * Math.PI * 2 + rnd() * 0.4
    const dist = 90 + rnd() * 120
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, size: 3 + rnd() * 5, delay: 0.5 + rnd() * 0.25, rot: rnd() * 360 }
  })
}

/**
 * The thank-you card after a payment: a gold seal draws itself and bursts into
 * gold flakes, the customer is thanked by name, the order number is there to
 * copy, and the next steps are one tap away. Its words come from the
 * back-office (Marketing → Accueil); {prenom} is replaced by the first name.
 */
export default function ThankYouCard({ firstName, amount, preorderNumber }: { firstName?: string | null; amount?: number | null; preorderNumber?: string | null }) {
  const { settings } = useSettings()
  const card = settings.thank_you
  const flakes = useMemo(() => burst(26), [])
  const name = firstName?.trim() || ''
  const title = card.title.replace(/\{prenom\}/gi, name).replace(/\s*,\s*$/, '').replace(/,\s*$/, '').trim() || 'Merci'
  const instagram = socialUrl('instagram', settings.social_instagram)

  const copy = async () => {
    if (!preorderNumber) return
    await navigator.clipboard.writeText(preorderNumber).catch(() => undefined)
    toast.success('Numéro copié')
  }

  return (
    <section className="relative isolate flex min-h-[calc(100svh-4.5rem)] items-center justify-center overflow-hidden bg-dark-800 px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, ease: EASE }}
        className="theme-dark relative w-full max-w-lg rounded-[2.5rem] border border-gold/30 bg-[#111] px-6 pb-10 pt-16 text-center shadow-[0_40px_80px_-40px_rgba(0,0,0,0.35)] sm:px-10"
      >
        {/* The seal */}
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
          <div className="relative h-24 w-24">
            {flakes.map((f, i) => (
              <motion.span
                key={i}
                aria-hidden
                className="absolute left-1/2 top-1/2 block rounded-[1px] bg-gradient-to-br from-[#f7e3a1] to-gold"
                style={{ width: f.size, height: f.size * 1.6 }}
                initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
                animate={{ x: f.x, y: f.y + 40, opacity: [0, 1, 0], rotate: f.rot }}
                transition={{ duration: 1.6, delay: f.delay, ease: 'easeOut' }}
              />
            ))}
            <svg viewBox="0 0 96 96" className="relative h-24 w-24 drop-shadow-[0_0_24px_rgba(212,175,55,0.55)]" aria-hidden>
              <circle cx="48" cy="48" r="46" fill="#0b0b0b" />
              <motion.circle
                cx="48"
                cy="48"
                r="42"
                fill="none"
                stroke="var(--color-gold)"
                strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.9, ease: EASE }}
              />
              <motion.path
                d="M31 49 l11 11 l23 -25"
                fill="none"
                stroke="var(--color-gold)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 0.75, ease: EASE }}
              />
            </svg>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.8, ease: EASE }}>
          <p className="eyebrow">Paiement reçu{amount ? ` · ${formatCurrency(amount)}` : ''}</p>
          <h1 className="mt-4 font-display text-4xl font-medium leading-tight sm:text-5xl">
            {title.split(' ').slice(0, -1).join(' ')} <em className="text-gold">{title.split(' ').slice(-1)}</em>
          </h1>
          <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-gray-300">{card.text}</p>

          {preorderNumber && (
            <button type="button" onClick={copy} className="mt-7 inline-flex items-center gap-3 rounded-full border border-gold/40 px-5 py-2.5 font-mono text-lg text-gold transition-colors hover:bg-gold/10">
              {preorderNumber} <HiClipboardDocument className="h-4 w-4" />
            </button>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {preorderNumber && (
              <Link to={`/track?number=${encodeURIComponent(preorderNumber)}`}>
                <Button className="w-full">Suivre ma commande</Button>
              </Link>
            )}
            <Link to="/collection">
              <Button variant="outline" className="w-full">
                Continuer
              </Button>
            </Link>
          </div>

          {instagram && (
            <a href={instagram} target="_blank" rel="noopener noreferrer" className="mt-6 inline-block text-xs text-gray-400 underline-offset-4 hover:text-gold hover:underline">
              Partagez votre pièce et identifiez-nous sur Instagram
            </a>
          )}

          <div className="mx-auto mt-8 flex items-center justify-center gap-3 text-gold/70" aria-hidden>
            <span className="h-px w-10 bg-gold/40" />
            <span className="text-xs">✦</span>
            <span className="h-px w-10 bg-gold/40" />
          </div>
          <p className="mt-3 font-display text-lg italic text-gray-300">{card.signature || `La Maison ${settings.store_name}`}</p>
        </motion.div>
      </motion.div>
    </section>
  )
}
