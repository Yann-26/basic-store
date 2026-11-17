import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import {
  HiXMark,
  HiOutlineUser,
  HiOutlineHeart,
  HiMagnifyingGlass,
  HiOutlineTruck,
  HiOutlineClipboardDocumentList,
  HiArrowRightOnRectangle,
  HiSquares2X2,
  HiBars3,
} from 'react-icons/hi2'
import { PRODUCT_CATEGORIES } from '@trs/shared'
import { useAuth } from '../../context/AuthContext'
import { useWishlist } from '../../context/WishlistContext'
import { useSettings } from '../../context/SettingsContext'
import Logo from '../ui/Logo'
import CartIcon from './CartIcon'
import SearchOverlay from './SearchOverlay'
import AnnouncementBar from './AnnouncementBar'

/** The sections shown in the header on a computer, and first in the menu. */
const SECTIONS = [
  { name: 'Nouveautés', path: '/collection?sort=newest' },
  { name: 'Femme', path: '/collection?gender=women' },
  { name: 'Homme', path: '/collection?gender=men' },
  { name: 'Chaussures', path: '/collection?category=shoes' },
  { name: 'Accessoires', path: '/collection?category=accessories' },
  { name: 'Tout voir', path: '/collection' },
]

const SERVICES = [
  { name: 'La boutique', path: '/about' },
  { name: 'Suivre ma commande', path: '/track' },
  { name: 'Contact', path: '/contact' },
  { name: 'FAQ', path: '/faq' },
]

const sectionLink = 'text-[13px] uppercase tracking-[0.06em] transition-opacity hover:opacity-60'
const iconButton = 'rounded-full p-2 text-white transition-opacity hover:opacity-60'

/**
 * Header: the name and the sections on the left, search, account, favourites
 * and bag on the right. On a phone the sections move into a plain panel
 * opened from the left.
 */
export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { isAuthenticated, user, isAdmin, logout } = useAuth()
  const { count: wishCount } = useWishlist()
  const { settings } = useSettings()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    setMenuOpen(false)
    setUserOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const initials = user ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() : ''
  const isCurrent = (path: string) => `${location.pathname}${location.search}` === path

  return (
    <>
      {settings.announcement_text && <AnnouncementBar text={settings.announcement_text} />}

      <header className="sticky top-0 z-40 border-b border-dark-600 bg-primary-black">
        <nav className="flex h-[4.5rem] items-center gap-6 px-4 sm:px-6 lg:px-8" aria-label="Navigation principale">
          <button onClick={() => setMenuOpen(true)} className="-ml-2 p-2 lg:hidden" aria-label="Ouvrir le menu" aria-expanded={menuOpen}>
            <HiBars3 className="h-6 w-6" />
          </button>

          <Logo size="md" />

          <ul className="mx-auto hidden items-center gap-8 lg:flex">
            {SECTIONS.map((s) => (
              <li key={s.path}>
                <NavLink to={s.path} className={clsx(sectionLink, isCurrent(s.path) ? 'font-semibold' : 'text-gray-300')}>
                  {s.name}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1 lg:ml-0">
            <button onClick={() => setSearchOpen(true)} className={iconButton} aria-label="Rechercher">
              <HiMagnifyingGlass className="h-5 w-5" />
            </button>

            <div className="relative hidden sm:block">
              {isAuthenticated ? (
                <button onClick={() => setUserOpen((v) => !v)} className="mx-1 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-[10px] font-semibold text-white" aria-label="Mon compte" aria-expanded={userOpen}>
                  {initials || <HiOutlineUser />}
                </button>
              ) : (
                <Link to="/login" className={clsx(iconButton, 'block')} aria-label="Se connecter">
                  <HiOutlineUser className="h-5 w-5" />
                </Link>
              )}
              {userOpen && user && (
                <div className="absolute right-0 top-full mt-4 w-64 overflow-hidden border border-white/10 bg-primary-black shadow-xl">
                  <div className="border-b border-white/10 p-4">
                    <p className="truncate text-sm font-medium">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="truncate text-xs text-gray-500">{user.email}</p>
                  </div>
                  <div className="py-2 text-sm">
                    {isAdmin && (
                      <Link to="/admin" className="flex items-center gap-3 px-4 py-2.5 hover:bg-dark-700">
                        <HiSquares2X2 className="h-4 w-4" /> Tableau de bord
                      </Link>
                    )}
                    <Link to="/compte" className="flex items-center gap-3 px-4 py-2.5 text-gray-300 hover:bg-dark-700">
                      <HiOutlineUser className="h-4 w-4" /> Mon compte
                    </Link>
                    <Link to="/compte?tab=orders" className="flex items-center gap-3 px-4 py-2.5 text-gray-300 hover:bg-dark-700">
                      <HiOutlineClipboardDocumentList className="h-4 w-4" /> Mes commandes
                    </Link>
                    <Link to="/track" className="flex items-center gap-3 px-4 py-2.5 text-gray-300 hover:bg-dark-700">
                      <HiOutlineTruck className="h-4 w-4" /> Suivre une commande
                    </Link>
                    <button
                      onClick={() => {
                        logout()
                        navigate('/')
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-gray-300 hover:bg-dark-700 hover:text-red-500"
                    >
                      <HiArrowRightOnRectangle className="h-4 w-4" /> Déconnexion
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Link to="/wishlist" className={clsx(iconButton, 'relative hidden sm:block')} aria-label={`Favoris (${wishCount})`}>
              <HiOutlineHeart className="h-5 w-5" />
              {wishCount > 0 && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-gold" />}
            </Link>
            <CartIcon />
          </div>
        </nav>
      </header>

      {/* Menu panel (phones and tablets) */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setMenuOpen(false)} />
          <aside role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-y-0 left-0 z-50 flex w-full max-w-sm flex-col overflow-y-auto bg-primary-black">
            <div className="flex h-[4.5rem] flex-none items-center justify-between px-4 sm:px-6">
              <Logo size="md" />
              <button onClick={() => setMenuOpen(false)} className="-mr-2 p-2 transition-opacity hover:opacity-60" aria-label="Fermer le menu">
                <HiXMark className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 px-4 pb-10 pt-4 sm:px-6">
              <ul className="space-y-4">
                {SECTIONS.map((s) => (
                  <li key={s.path}>
                    <Link to={s.path} className="text-sm uppercase tracking-[0.06em] transition-opacity hover:opacity-60">
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>

              <ul className="mt-10 space-y-3 text-sm">
                {PRODUCT_CATEGORIES.map((c) => (
                  <li key={c.id}>
                    <Link to={`/collection?category=${c.id}`} className="text-gray-300 transition-opacity hover:opacity-60">
                      {c.label}
                    </Link>
                  </li>
                ))}
              </ul>

              <ul className="mt-10 space-y-3 text-sm">
                {SERVICES.map((s) => (
                  <li key={s.path}>
                    <Link to={s.path} className="text-gray-300 transition-opacity hover:opacity-60">
                      {s.name}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link to="/wishlist" className="text-gray-300 transition-opacity hover:opacity-60">
                    Favoris ({wishCount})
                  </Link>
                </li>
              </ul>
            </div>

            <div className="flex-none space-y-3 border-t border-white/10 p-4 sm:p-6">
              {isAuthenticated ? (
                <>
                  {isAdmin && (
                    <Link to="/admin" className="block bg-white py-3 text-center text-xs font-semibold uppercase tracking-[0.15em] text-primary-black">
                      Tableau de bord
                    </Link>
                  )}
                  <Link to="/compte" className="block border border-white/20 py-3 text-center text-xs uppercase tracking-[0.15em]">
                    Mon compte
                  </Link>
                  <button onClick={() => logout()} className="w-full py-2 text-xs uppercase tracking-[0.15em] text-gray-500 hover:text-red-500">
                    Déconnexion
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="block bg-white py-3 text-center text-xs font-semibold uppercase tracking-[0.15em] text-primary-black">
                    Connexion
                  </Link>
                  <Link to="/register" className="block border border-white/20 py-3 text-center text-xs uppercase tracking-[0.15em]">
                    Créer un compte
                  </Link>
                </>
              )}
            </div>
          </aside>
        </>
      )}

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
