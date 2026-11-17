import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { BRAND, DEFAULT_DELIVERY, DEFAULT_REFERRAL } from '@trs/shared'
import { settingsService, type AppSettings } from '../services/settingsService'
import { DEFAULT_LOOKBOOK, DEFAULT_MOTION_REEL, DEFAULT_THANK_YOU, DEFAULT_WELCOME_CARD, DEFAULT_RACK } from '../services/marketing'

interface SettingsContextType {
  settings: AppSettings
  loading: boolean
  error: string | null
  refreshSettings: () => Promise<void>
  updateSetting: (key: string, value: unknown) => Promise<void>
}

const SettingsContext = createContext<SettingsContextType | null>(null)

// Default settings (fallback if DB not connected)
export const defaultSettings: AppSettings = {
  store_name: BRAND.name,
  store_description: BRAND.description,
  store_tagline: BRAND.tagline,
  store_email: BRAND.email,
  store_phone: BRAND.phone,
  store_whatsapp: BRAND.phone,
  store_address: 'Angré Nouveau CHU, Djorogobité 1',
  store_city: 'Abidjan',
  store_country: "Côte d'Ivoire",
  store_logo: '',
  store_favicon: '',
  primary_color: BRAND.colors.gold,
  secondary_color: BRAND.colors.black,
  accent_color: BRAND.colors.white,
  delivery_fee_abidjan: DEFAULT_DELIVERY.abidjan,
  delivery_fee_interior: DEFAULT_DELIVERY.interior,
  free_delivery_from: DEFAULT_DELIVERY.freeFrom,
  cash_on_delivery_enabled: true,
  online_payment_enabled: true,
  delivery_days_min: 1,
  delivery_days_max: 5,
  max_items_per_order: 10,
  auto_confirm_orders: false,
  currency: 'XOF',
  language: 'fr',
  orange_money_enabled: true,
  mtn_money_enabled: true,
  wave_enabled: true,
  card_enabled: true,
  orange_money_number: '',
  mtn_money_number: '',
  wave_number: '',
  social_instagram: 'basicstoreci',
  social_facebook: '',
  social_tiktok: '',
  social_snapchat: '',
  email_notifications: true,
  whatsapp_notifications: true,
  admin_order_notification: true,
  customer_order_confirmation: true,
  delivery_reminder: true,
  two_factor_auth: false,
  session_timeout: 30,
  seo_title: `${BRAND.name} | ${BRAND.tagline}`,
  seo_description: BRAND.description,
  seo_keywords: "Basic Store, boutique, vêtements, chaussures, mode homme, mode femme, Angré, Abidjan, Côte d'Ivoire, livraison",
  hero_title: 'La qualité.\nÀ bon prix.',
  hero_subtitle: 'Vêtements, chaussures et accessoires sélectionnés pour vous. Commandez en ligne, on livre partout en Côte d’Ivoire.',
  hero_cta_primary: 'Découvrir la boutique',
  hero_cta_secondary: 'Comment ça marche',
  hero_background_mobile: '',
  hero_background_desktop: '',
  announcement_text: 'Livraison partout en Côte d’Ivoire · Paiement sécurisé en ligne · Pièces en séries limitées',
  hero_ad_enabled: false,
  hero_ad_desktop: '',
  hero_ad_mobile: '',
  hero_ad_link: '',
  hero_ad_alt: '',
  hero_ad_position: 'above',
  showcase_product_ids: [],
  founder_name: '',
  founder_role: 'Fondateur',
  founder_photo: '',
  founder_message: '',
  storefront_theme: 'light',
  spotlight_enabled: false,
  spotlight_layout: 'maison',
  spotlight_product_slug: '',
  spotlight_eyebrow: 'Coup de cœur',
  spotlight_title: '',
  spotlight_text: '',
  spotlight_cta_label: 'Découvrir la pièce',
  spotlight_launch_at: '',
  spotlight_photo: '',
  spotlight_frames: [],
  lookbook: DEFAULT_LOOKBOOK,
  rack: DEFAULT_RACK,
  motion_reel: DEFAULT_MOTION_REEL,
  referral: DEFAULT_REFERRAL,
  welcome_card: DEFAULT_WELCOME_CARD,
  thank_you: DEFAULT_THANK_YOU,
}

function withDefaults(data: AppSettings): AppSettings {
  const filled = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== '' && v !== null && v !== undefined))
  return { ...defaultSettings, ...filled } as AppSettings
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Start with defaults so the UI never renders empty brand values.
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (fresh: boolean) => {
    try {
      setLoading(true)
      settingsService.clearCache()
      setSettings(withDefaults(await settingsService.getAll({ fresh })))
      setError(null)
    } catch (err) {
      console.error('Failed to load settings:', err)
      setError('Using default settings')
    } finally {
      setLoading(false)
    }
  }, [])

  // Called by the back-office after a save: it must see the new values right away.
  const refreshSettings = useCallback(() => load(true), [load])

  const updateSetting = useCallback(
    async (key: string, value: unknown) => {
      await settingsService.update(key, value)
      await refreshSettings()
    },
    [refreshSettings],
  )

  useEffect(() => {
    void load(false)
  }, [load])

  return (
    <SettingsContext.Provider value={{ settings, loading, error, refreshSettings, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings must be used within SettingsProvider')
  return context
}
