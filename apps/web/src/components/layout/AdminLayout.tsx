import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import PageLoader from '../ui/PageLoader'
import clsx from 'clsx'
import { FaInstagram } from 'react-icons/fa'
import {
  HiArrowDownTray,
  HiArrowRightOnRectangle,
  HiArrowTopRightOnSquare,
  HiBars3,
  HiChartPie,
  HiClipboardDocumentList,
  HiCog6Tooth,
  HiCurrencyDollar,
  HiGlobeEuropeAfrica,
  HiEnvelope,
  HiShoppingBag,
  HiTag,
  HiUserGroup,
  HiUsers,
  HiXMark, HiEnvelopeOpen, HiSparkles } from 'react-icons/hi2'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { useAdminApp } from '../../pwa/adminApp'
import { excludeDeviceByDefault } from '../../analytics/pageViews'
import { engagementService } from '../../services/engagementService'
import { ordersService } from '../../services/ordersService'
import Logo from '../ui/Logo'

type Counters = { orders: number; messages: number }

const sections = [
  {
    title: 'Pilotage',
    links: [
      { name: 'Tableau de bord', path: '/admin', icon: HiChartPie, end: true },
      { name: 'Audience', path: '/admin/audience', icon: HiGlobeEuropeAfrica },
      { name: 'Utilisateurs', path: '/admin/users', icon: HiUsers },
    ],
  },
  {
    title: 'Ventes',
    links: [
      { name: 'Commandes', path: '/admin/orders', icon: HiClipboardDocumentList, counter: 'orders' as const },
      { name: 'Paiements', path: '/admin/payments', icon: HiCurrencyDollar },
      { name: 'Clients', path: '/admin/customers', icon: HiUserGroup },
      { name: 'Messages', path: '/admin/messages', icon: HiEnvelope, counter: 'messages' as const },
    ],
  },
  {
    title: 'Catalogue',
    links: [
      { name: 'Produits', path: '/admin/products', icon: HiShoppingBag },
      { name: 'Marques & collections', path: '/admin/catalog', icon: HiTag },
    ],
  },
  {
    title: 'Boutique',
    links: [
      { name: 'Marketing', path: '/admin/marketing', icon: HiSparkles },
      { name: 'Looks clients', path: '/admin/instagram', icon: FaInstagram },
      { name: 'Newsletter', path: '/admin/newsletter', icon: HiEnvelopeOpen },
      { name: 'Paramètres', path: '/admin/settings', icon: HiCog6Tooth },
    ],
  },
]

// Safari has no install prompt: its users add the app from the menu instead.
const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|chromium|android|edg).)*safari/i.test(navigator.userAgent)

export default function AdminLayout() {
  const [open, setOpen] = useState(false)
  const [counters, setCounters] = useState<Counters>({ orders: 0, messages: 0 })
  const { user, logout } = useAuth()
  const app = useAdminApp()
  const location = useLocation()
  const navigate = useNavigate()
  const { refreshSettings } = useSettings()

  // The back-office edits the settings: start from the saved values, not the copy the CDN keeps for the shop.
  useEffect(() => {
    void refreshSettings()
  }, [refreshSettings])

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  // The owner's own browsing of the shop is not audience (Audience → "Mes visites").
  useEffect(() => excludeDeviceByDefault(), [])

  // Refresh the sidebar counters on navigation.
  useEffect(() => {
    ordersService
      .getPage({ status: 'pending', limit: 1 })
      .then((p) => setCounters((c) => ({ ...c, orders: p.total })))
      .catch(() => undefined)
    engagementService
      .messages('new')
      .then((m) => setCounters((c) => ({ ...c, messages: m.length })))
      .catch(() => undefined)
  }, [location.pathname])

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 py-6">
        <Logo to="/admin" size="sm" />
        <button onClick={() => setOpen(false)} className="p-1 text-gray-400 lg:hidden" aria-label="Fermer le menu">
          <HiXMark className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-4 pb-6" aria-label="Administration">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-600">{section.title}</p>
            <ul className="space-y-1">
              {section.links.map((link) => {
                const count = 'counter' in link && link.counter ? counters[link.counter] : 0
                return (
                  <li key={link.path}>
                    <NavLink
                      to={link.path}
                      end={'end' in link && link.end}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                          isActive ? 'bg-gold/10 text-gold' : 'text-gray-400 hover:bg-white/5 hover:text-white',
                        )
                      }
                    >
                      <link.icon className="h-5 w-5" />
                      <span className="flex-1">{link.name}</span>
                      {count > 0 && <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-primary-black">{count}</span>}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="space-y-1 border-t border-white/5 p-4">
        <div className="mb-3 flex items-center gap-3 px-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-gradient text-xs font-bold text-primary-black">
            {`${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`.toUpperCase() || 'A'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="truncate text-xs text-gray-500">{user?.email}</p>
          </div>
        </div>
        {app.canInstall && (
          <button
            onClick={() => void app.install()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-gold hover:bg-gold/10"
            title="Ouvrir le back-office comme une application, depuis le bureau ou la barre des tâches"
          >
            <HiArrowDownTray className="h-4 w-4" /> Installer l&apos;application
          </button>
        )}
        {!app.canInstall && !app.installed && isSafari && (
          <p className="px-3 py-2 text-xs text-gray-500">Safari : Fichier › Ajouter au Dock pour l&apos;installer comme une application.</p>
        )}
        <Link to="/" target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-400 hover:bg-white/5 hover:text-white">
          <HiArrowTopRightOnSquare className="h-4 w-4" /> Voir la boutique
        </Link>
        <button
          onClick={() => {
            logout()
            navigate('/admin/login')
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-400 hover:bg-red-500/10 hover:text-red-400"
        >
          <HiArrowRightOnRectangle className="h-4 w-4" /> Déconnexion
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-primary-black">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/5 bg-dark-900 lg:block">{sidebar}</aside>

      {open && <div className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={clsx('fixed inset-y-0 left-0 z-50 w-72 border-r border-gold/20 bg-dark-900 transition-transform lg:hidden', open ? 'translate-x-0' : '-translate-x-full')}>
        {sidebar}
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-white/5 bg-primary-black/90 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="p-1" aria-label="Ouvrir le menu">
            <HiBars3 className="h-6 w-6" />
          </button>
          <Logo to="/admin" size="sm" />
        </header>
        <main className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
          <PageLoader>
            <Outlet />
          </PageLoader>
        </main>
      </div>
    </div>
  )
}
