import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { HiXMark } from 'react-icons/hi2'
import { useAuth } from '../../context/AuthContext'
import { useWishlist } from '../../context/WishlistContext'
import { useRecentlyViewed } from '../../hooks/useRecentlyViewed'
import { readJSON, writeJSON } from '../../core/storage'
import { StarMark } from '../ui/Logo'

const SHOWN_THIS_VISIT = 'welcomed' // sessionStorage: once per visit
const LAST_VISIT = 'last_visit' // localStorage: date only, nothing personal
const AUTO_HIDE_MS = 8000

function greeting(hour: number) {
  return hour < 5 || hour >= 18 ? 'Bonsoir' : 'Bonjour'
}

/**
 * Greets returning visitors once per visit: by name when signed in, with the
 * piece they last looked at and their favourites.
 */
export default function WelcomeBack() {
  const { user, loading } = useAuth()
  const { items: wishlist } = useWishlist()
  const { items: recent } = useRecentlyViewed()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (loading) return
    if (readJSON<boolean>(SHOWN_THIS_VISIT, false, 'session')) return
    const lastVisit = readJSON<string | null>(LAST_VISIT, null)
    writeJSON(LAST_VISIT, new Date().toISOString())
    writeJSON(SHOWN_THIS_VISIT, true, 'session')
    // Signed-in customers every visit; anonymous visitors only when they've been here before.
    if (user || lastVisit) setOpen(true)
  }, [loading, user])

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => setOpen(false), AUTO_HIDE_MS)
    return () => window.clearTimeout(t)
  }, [open])

  const last = recent[0]
  const title = user ? `${greeting(new Date().getHours())} ${user.first_name}, bon retour ✨` : 'Heureux de vous revoir ✨'

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.35 }}
          className="fixed bottom-4 left-4 right-20 z-50 max-w-sm overflow-hidden rounded-3xl border border-gold/40 bg-dark-800/95 p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur sm:right-auto sm:w-96"
        >
          <StarMark className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 opacity-10" />
          <button onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-full p-1 text-gray-500 hover:text-white" aria-label="Fermer">
            <HiXMark className="h-5 w-5" />
          </button>
          <p className="pr-6 font-display text-xl">{title}</p>
          <p className="mt-1 text-sm text-gray-400">{user ? 'Votre sélection vous attend.' : 'Nos nouveautés n’attendent que vous.'}</p>

          {last && (
            <Link to={`/product/${last.slug}`} onClick={() => setOpen(false)} className="mt-4 flex items-center gap-3 rounded-2xl bg-white/5 p-2 pr-4 transition-colors hover:bg-white/10">
              {last.image ? <img src={last.image} alt="" className="h-12 w-10 rounded-lg object-cover" /> : <span className="h-12 w-10 rounded-lg bg-dark-600" />}
              <span className="min-w-0 text-sm">
                <span className="block text-[11px] uppercase tracking-[0.2em] text-gold">Reprendre</span>
                <span className="block truncate">{last.name}</span>
              </span>
            </Link>
          )}

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {user ? (
              <Link to="/compte" onClick={() => setOpen(false)} className="rounded-full border border-white/15 px-3 py-1.5 hover:border-gold hover:text-gold">
                Mes commandes
              </Link>
            ) : (
              <Link to="/login" onClick={() => setOpen(false)} className="rounded-full border border-white/15 px-3 py-1.5 hover:border-gold hover:text-gold">
                Se connecter
              </Link>
            )}
            {wishlist.length > 0 && (
              <Link to="/wishlist" onClick={() => setOpen(false)} className="rounded-full border border-white/15 px-3 py-1.5 hover:border-gold hover:text-gold">
                Mes favoris ({wishlist.length})
              </Link>
            )}
            <Link to="/collection" onClick={() => setOpen(false)} className="rounded-full bg-gold px-3 py-1.5 font-semibold text-primary-black hover:brightness-110">
              Nouveautés
            </Link>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
