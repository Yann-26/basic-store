import { BRAND, referralSettings, resolveDeliverySettings, type ReferralSettings } from '@trs/shared'
import { http } from '../core/http'
import { parseLookbook, parseMotionReel, parseRack, parseThankYou, parseWelcomeCard, type Lookbook, type MotionReel, type Rack, type ThankYouCard, type WelcomeCard } from './marketing'

export interface AppSettings {
  store_name: string
  store_description: string
  /** Short line under the name (header of emails, footer). */
  store_tagline: string
  store_email: string
  store_phone: string
  store_whatsapp: string
  store_address: string
  store_city: string
  store_country: string
  store_logo: string
  store_favicon: string
  primary_color: string
  secondary_color: string
  accent_color: string
  /** Delivery fees (FCFA): Abidjan, elsewhere in Côte d'Ivoire; free from a basket amount (0: never). */
  delivery_fee_abidjan: number
  delivery_fee_interior: number
  free_delivery_from: number
  /** Payment modes offered at checkout. */
  cash_on_delivery_enabled: boolean
  online_payment_enabled: boolean
  delivery_days_min: number
  delivery_days_max: number
  max_items_per_order: number
  auto_confirm_orders: boolean
  currency: string
  language: string
  orange_money_enabled: boolean
  mtn_money_enabled: boolean
  wave_enabled: boolean
  card_enabled: boolean
  orange_money_number: string
  mtn_money_number: string
  wave_number: string
  social_instagram: string
  social_facebook: string
  social_tiktok: string
  social_snapchat: string
  email_notifications: boolean
  whatsapp_notifications: boolean
  admin_order_notification: boolean
  customer_order_confirmation: boolean
  delivery_reminder: boolean
  two_factor_auth: boolean
  session_timeout: number
  seo_title: string
  seo_description: string
  seo_keywords: string
  hero_title: string
  hero_subtitle: string
  hero_cta_primary: string
  hero_cta_secondary: string
  hero_background_mobile: string
  hero_background_desktop: string
  announcement_text: string
  /** Hero advertising visual (optional), shown above the hero or instead of it. */
  /** The advertising visual is shown only when this is on (Vitrine → Publicité du hero). */
  hero_ad_enabled: boolean
  hero_ad_desktop: string
  hero_ad_mobile: string
  hero_ad_link: string
  hero_ad_alt: string
  hero_ad_position: 'above' | 'replace'
  /** Products of the home page's 3D ring, in order. */
  showcase_product_ids: string[]
  /** "Mot du fondateur" section (hidden while the message is empty). */
  founder_name: string
  founder_role: string
  founder_photo: string
  founder_message: string
  /** Storefront palette: light (black on white, editorial) or dark (black and gold). */
  storefront_theme: 'light' | 'dark'
  /** "Pièce à l'honneur": the exclusive piece shown full screen at the top of the home page. */
  spotlight_enabled: boolean
  spotlight_layout: 'maison' | 'launch'
  spotlight_product_slug: string
  spotlight_eyebrow: string
  spotlight_title: string
  spotlight_text: string
  spotlight_cta_label: string
  spotlight_launch_at: string
  spotlight_photo: string
  /** Photos taken around the piece on a turntable, in order — dragging steps through them. */
  spotlight_frames: string[]
  /** Back-office → Marketing: outfits from the shootings, shown on the home page. */
  lookbook: Lookbook
  /** "Le portant" of the home page (Marketing → Le portant). */
  rack: Rack
  /** Back-office → Marketing: pieces shown one at a time in motion on the home page. */
  motion_reel: MotionReel
  /** Back-office → Marketing → Parrainage. */
  referral: ReferralSettings
  /** Back-office → Marketing → Accueil: the card a first-time visitor sees. */
  welcome_card: WelcomeCard
  /** Back-office → Marketing → Accueil: the message after a payment. */
  thank_you: ThankYouCard
}

function stringList(value: unknown): string[] {
  let list = value
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list)
    } catch {
      return []
    }
  }
  return Array.isArray(list) ? list.filter((v): v is string => typeof v === 'string') : []
}

let cachedSettings: AppSettings | null = null
let lastFetch = 0
const CACHE_DURATION = 60 * 1000 // 1 minute

export const settingsService = {
  /**
   * `fresh` (back-office, after a save) reads the admin endpoint, which is never
   * cached: the public /settings is kept by the CDN for a few seconds and would
   * bring the old values back.
   */
  async getAll({ fresh = false }: { fresh?: boolean } = {}): Promise<AppSettings> {
    if (!fresh && cachedSettings && Date.now() - lastFetch < CACHE_DURATION) {
      return cachedSettings
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loosely typed key/value store, normalised below
    const data = await http.get<Record<string, any>>(fresh ? '/admin/settings' : '/settings')
    
    // Map API response to AppSettings format
    const settings: AppSettings = {
      store_name: data.store_name || BRAND.name,
      store_description: data.store_description || '',
      store_tagline: data.store_tagline || '',
      store_email: data.store_email || '',
      store_phone: data.store_phone || '',
      store_whatsapp: data.store_whatsapp || '',
      store_address: data.store_address || '',
      store_city: data.store_city || '',
      store_country: data.store_country || '',
      store_logo: data.store_logo || '',
      store_favicon: data.store_favicon || '',
      primary_color: data.primary_color || BRAND.colors.gold,
      secondary_color: data.secondary_color || '#0A0A0A',
      accent_color: data.accent_color || '#FFFFFF',
      ...(() => {
        const d = resolveDeliverySettings(data)
        return { delivery_fee_abidjan: d.abidjan, delivery_fee_interior: d.interior, free_delivery_from: d.freeFrom }
      })(),
      cash_on_delivery_enabled: data.cash_on_delivery_enabled !== false && data.cash_on_delivery_enabled !== 'false',
      online_payment_enabled: data.online_payment_enabled !== false && data.online_payment_enabled !== 'false',
      delivery_days_min: Number(data.delivery_days_min) || 1,
      delivery_days_max: Number(data.delivery_days_max) || 3,
      max_items_per_order: Number(data.max_items_per_order) || 10,
      auto_confirm_orders: data.auto_confirm_orders === true || data.auto_confirm_orders === 'true',
      currency: data.currency || 'XOF',
      language: data.language || 'fr',
      orange_money_enabled: data.orange_money_enabled === true || data.orange_money_enabled === 'true',
      mtn_money_enabled: data.mtn_money_enabled === true || data.mtn_money_enabled === 'true',
      wave_enabled: data.wave_enabled === true || data.wave_enabled === 'true',
      card_enabled: data.card_enabled === true || data.card_enabled === 'true',
      orange_money_number: data.orange_money_number || '',
      mtn_money_number: data.mtn_money_number || '',
      wave_number: data.wave_number || '',
      social_instagram: data.social_instagram || '',
      social_facebook: data.social_facebook || '',
      social_tiktok: data.social_tiktok || '',
      social_snapchat: data.social_snapchat || '',
      email_notifications: data.email_notifications === true || data.email_notifications === 'true',
      whatsapp_notifications: data.whatsapp_notifications === true || data.whatsapp_notifications === 'true',
      admin_order_notification: data.admin_order_notification === true || data.admin_order_notification === 'true',
      customer_order_confirmation: data.customer_order_confirmation === true || data.customer_order_confirmation === 'true',
      delivery_reminder: data.delivery_reminder === true || data.delivery_reminder === 'true',
      two_factor_auth: data.two_factor_auth === true || data.two_factor_auth === 'true',
      session_timeout: Number(data.session_timeout) || 30,
      seo_title: data.seo_title || '',
      seo_description: data.seo_description || '',
      seo_keywords: data.seo_keywords || '',
      hero_title: data.hero_title || '',
      hero_subtitle: data.hero_subtitle || '',
      hero_cta_primary: data.hero_cta_primary || '',
      hero_cta_secondary: data.hero_cta_secondary || '',
      hero_background_mobile: data.hero_background_mobile || '',
      hero_background_desktop: data.hero_background_desktop || '',
      announcement_text: data.announcement_text || '',
      hero_ad_enabled: data.hero_ad_enabled === true || data.hero_ad_enabled === 'true',
      hero_ad_desktop: data.hero_ad_desktop || '',
      hero_ad_mobile: data.hero_ad_mobile || '',
      hero_ad_link: data.hero_ad_link || '',
      hero_ad_alt: data.hero_ad_alt || '',
      hero_ad_position: data.hero_ad_position === 'replace' ? 'replace' : 'above',
      showcase_product_ids: stringList(data.showcase_product_ids),
      founder_name: data.founder_name || '',
      founder_role: data.founder_role || '',
      founder_photo: data.founder_photo || '',
      founder_message: data.founder_message || '',
      storefront_theme: data.storefront_theme === 'dark' ? 'dark' : 'light',
      spotlight_enabled: data.spotlight_enabled === true || data.spotlight_enabled === 'true',
      spotlight_layout: data.spotlight_layout === 'launch' ? 'launch' : 'maison',
      spotlight_product_slug: data.spotlight_product_slug || '',
      spotlight_eyebrow: data.spotlight_eyebrow || '',
      spotlight_title: data.spotlight_title || '',
      spotlight_text: data.spotlight_text || '',
      spotlight_cta_label: data.spotlight_cta_label || '',
      spotlight_launch_at: data.spotlight_launch_at || '',
      spotlight_photo: data.spotlight_photo || '',
      spotlight_frames: stringList(data.spotlight_frames),
      lookbook: parseLookbook(data.lookbook),
      rack: parseRack(data.rack),
      motion_reel: parseMotionReel(data.motion_reel),
      referral: referralSettings(data),
      welcome_card: parseWelcomeCard(data.welcome_card),
      thank_you: parseThankYou(data.thank_you),
    }

    cachedSettings = settings
    lastFetch = Date.now()
    return settings
  },

  async update(key: string, value: unknown): Promise<void> {
    await http.put('/admin/settings', [{ key, value }])
    cachedSettings = null // Invalidate cache
  },

  async updateMany(settings: Record<string, unknown>): Promise<void> {
    const updates = Object.entries(settings).map(([key, value]) => ({ key, value }))
    await http.put('/admin/settings', updates)
    cachedSettings = null
  },

  clearCache(): void {
    cachedSettings = null
    lastFetch = 0
  }
}