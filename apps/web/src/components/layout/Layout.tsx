import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import PageLoader from '../ui/PageLoader'
import Navbar from './Navbar'
import Footer from './Footer'
import WhatsAppFloat from './WhatsAppFloat'
import VerifyEmailBanner from '../auth/VerifyEmailBanner'
import WelcomeBack from './WelcomeBack'
import WelcomeCard from './WelcomeCard'
import { trackPageView } from '../../analytics/pageViews'
import { useSettings } from '../../context/SettingsContext'
import { referralMemory } from '../../services/promoService'

export default function Layout() {
  const { pathname, search } = useLocation()

  // A friend's shared link (?ref=CODE): the code waits for the checkout.
  useEffect(() => {
    const ref = new URLSearchParams(search).get('ref')
    if (ref) referralMemory.remember(ref)
  }, [search])
  useEffect(() => {
    // Block body on purpose: modern browsers return a Promise from scrollTo, and
    // React would call any returned value as the effect's cleanup.
    window.scrollTo({ top: 0 })
  }, [pathname])

  // Audience: one page view per page (Back-office → Audience)
  const lastTracked = useRef<string | null>(null)
  useEffect(() => {
    if (lastTracked.current === pathname) return
    lastTracked.current = pathname
    trackPageView(pathname)
  }, [pathname])

  // The storefront palette chosen in the back-office (on <body>, so drawers and dialogs follow it).
  const { settings } = useSettings()
  useEffect(() => {
    const theme = settings.storefront_theme === 'dark' ? 'theme-dark' : 'theme-light'
    document.body.classList.add(theme)
    return () => document.body.classList.remove(theme)
  }, [settings.storefront_theme])

  return (
    <div className="flex min-h-screen flex-col bg-primary-black">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-gold focus:px-4 focus:py-2 focus:text-primary-black">
        Aller au contenu
      </a>
      <Navbar />
      <VerifyEmailBanner />
      <main id="main" className="flex-grow">
        <PageLoader>
          <Outlet />
        </PageLoader>
      </main>
      <Footer />
      <WhatsAppFloat />
      <WelcomeBack />
      <WelcomeCard />
    </div>
  )
}
