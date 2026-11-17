import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { PreorderProvider } from './context/PreorderContext'
import { SettingsProvider } from './context/SettingsContext'
import { WishlistProvider } from './context/WishlistContext'
import { reloadForNewVersion } from './core/lazy'
import { captureInstallPrompt, enableAdminApp } from './pwa/adminApp'
import './styles/globals.css'

// A preloaded chunk from a previous deployment is gone: reload once to get the new build
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewVersion()) event.preventDefault()
})

// Back-office as an installable app: attach its manifest before the lazy admin pages load
captureInstallPrompt()
if (window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')) enableAdminApp()

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')

createRoot(rootElement).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <SettingsProvider>
          <AuthProvider>
            <WishlistProvider>
              <PreorderProvider>
                <App />
                <Toaster
                  position="top-center"
                  toastOptions={{
                    style: {
                      background: '#111111',
                      color: '#FFFFFF',
                      border: '1px solid rgba(212, 175, 55, 0.4)',
                      borderRadius: '999px',
                      fontSize: '14px',
                    },
                    success: { iconTheme: { primary: '#D4AF37', secondary: '#0A0A0A' } },
                  }}
                />
              </PreorderProvider>
            </WishlistProvider>
          </AuthProvider>
        </SettingsProvider>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>,
)
