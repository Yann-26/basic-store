import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { HiArrowRight, HiXMark } from 'react-icons/hi2'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { readJSON, writeJSON } from '../../core/storage'
import NewsletterForm from './NewsletterForm'

const SEEN = 'welcome_card_seen' // localStorage: shown once per browser
/** Never over the purchase, the account or the back-office. */
const QUIET = /^\/(admin|preorder|payer|payment|compte|login|register|ticket)/

/**
 * The welcome card a first-time visitor sees, once, a moment after arriving.
 * Every word, the picture and the button come from the back-office
 * (Marketing → Accueil); it can offer the newsletter right away.
 */
export default function WelcomeCard() {
  const { settings, loading: settingsLoading } = useSettings()
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const card = settings.welcome_card
  const closeButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (loading || settingsLoading || !card.enabled || user || QUIET.test(pathname)) return
    if (readJSON<boolean>(SEEN, false)) return
    const t = window.setTimeout(() => {
      writeJSON(SEEN, true)
      setOpen(true)
    }, card.delay * 1000)
    return () => window.clearTimeout(t)
  }, [loading, settingsLoading, card.enabled, card.delay, user, pathname])

  useEffect(() => {
    if (!open) return
    closeButton.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const external = /^https:\/\//.test(card.cta_link)
  const cta = card.cta_label && card.cta_link && (
    <span className="inline-flex min-h-12 items-center gap-2 rounded-full bg-gold px-7 text-xs font-semibold uppercase tracking-[0.22em] text-primary-black transition-colors hover:bg-gold-light">
      {card.cta_label} <HiArrowRight className="h-4 w-4" />
    </span>
  )

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="welcome"
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-title"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="relative grid w-full max-w-3xl overflow-hidden bg-primary-black shadow-[0_30px_80px_-30px_rgba(0,0,0,0.45)] sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
          >
            <button
              ref={closeButton}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(255,255,255,0.85)] text-[#111] transition-opacity hover:opacity-60"
            >
              <HiXMark className="h-5 w-5" />
            </button>

            <div className="relative h-44 overflow-hidden bg-dark-700 sm:h-auto">
              {card.image ? (
                <img src={card.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <span className="campaign-title px-6 text-center text-5xl">{settings.store_name}</span>
                </div>
              )}
            </div>

            <div className="p-7 sm:p-10">
              {card.eyebrow && <p className="eyebrow mb-3">{card.eyebrow}</p>}
              <h2 id="welcome-title" className="campaign-title text-4xl sm:text-5xl">
                {card.title}
              </h2>
              {card.text && <p className="mt-4 text-sm leading-relaxed text-gray-300">{card.text}</p>}

              {cta && (
                <div className="mt-7" onClick={() => setOpen(false)}>
                  {external ? (
                    <a href={card.cta_link} target="_blank" rel="noopener noreferrer">
                      {cta}
                    </a>
                  ) : (
                    <Link to={card.cta_link}>{cta}</Link>
                  )}
                </div>
              )}

              {card.newsletter && (
                <div className="mt-8 border-t border-white/10 pt-6">
                  <p className="mb-3 text-[10px] uppercase tracking-[0.3em] text-gray-400">Être prévenu·e des nouveautés</p>
                  <NewsletterForm tone="line" source="welcome_card" />
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
