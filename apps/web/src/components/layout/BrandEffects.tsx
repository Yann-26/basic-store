import { useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { useSettings } from '../../context/SettingsContext'
import { themeVariables } from '../../utils/theme'

/**
 * Applies the identity chosen in the dashboard to the whole document: tab title
 * and icon, social previews, and the colours every component draws from.
 */
export default function BrandEffects() {
  const { settings } = useSettings()
  const title = settings.seo_title || `${settings.store_name} | ${settings.store_tagline}`
  const description = settings.seo_description || settings.store_description

  useEffect(() => {
    const root = document.documentElement
    const vars = themeVariables(settings.primary_color, settings.secondary_color)
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
    return () => {
      for (const k of Object.keys(vars)) root.style.removeProperty(k)
    }
  }, [settings.primary_color, settings.secondary_color])

  return (
    <Helmet defaultTitle={title}>
      <meta name="description" content={description} />
      <meta name="theme-color" content={settings.secondary_color} />
      <meta property="og:site_name" content={settings.store_name} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      {settings.store_favicon && <link rel="icon" href={settings.store_favicon} />}
      {settings.store_logo && <meta property="og:image" content={settings.store_logo} />}
    </Helmet>
  )
}
