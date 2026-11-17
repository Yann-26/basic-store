import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  HiCheckCircle, 
  HiExclamationCircle,
  HiBuildingStorefront,
  HiTruck,
  HiCreditCard,
  HiBell,
  HiShieldCheck,
  HiGlobeAlt,
  HiDevicePhoneMobile,
  HiPhoto,
  HiEnvelope,
} from 'react-icons/hi2'
import { FaWhatsapp, FaInstagram, FaFacebook, FaTiktok } from 'react-icons/fa'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { useSettings } from '../../context/SettingsContext'
import { settingsService } from '../../services/settingsService'
import toast from 'react-hot-toast'
import { HiSparkles } from 'react-icons/hi2'
import StorefrontSettings from './StorefrontSettings'
import AccountSecurity from './AccountSecurity'
import EmailTest from './EmailTest'
import ImageUpload from './ImageUpload'

interface StoreSettings {
  storeName: string
  storeTagline: string
  storeLogo: string
  storeFavicon: string
  storeDescription: string
  email: string
  phone: string
  whatsapp: string
  address: string
  city: string
  country: string
  primaryColor: string
  secondaryColor: string
  deliveryFeeAbidjan: number
  deliveryFeeInterior: number
  freeDeliveryFrom: number
  cashOnDelivery: boolean
  onlinePayment: boolean
  deliveryDaysMin: number
  deliveryDaysMax: number
  autoConfirmOrders: boolean
  maxItemsPerOrder: number
  currency: string
  language: string
  orangeMoney: boolean
  mtnMoney: boolean
  wave: boolean
  card: boolean
  orangeMoneyNumber: string
  mtnMoneyNumber: string
  waveNumber: string
  instagram: string
  facebook: string
  tiktok: string
  snapchat: string
  emailNotifications: boolean
  whatsappNotifications: boolean
  adminOrderNotification: boolean
  customerOrderConfirmation: boolean
  deliveryReminder: boolean
  twoFactorAuth: boolean
  sessionTimeout: number
}

const tabs = [
  { id: 'general', label: 'Général', icon: HiBuildingStorefront },
  { id: 'storefront', label: 'Vitrine', icon: HiSparkles },
  { id: 'preorder', label: 'Livraison & commandes', icon: HiTruck },
  { id: 'payment', label: 'Paiement', icon: HiCreditCard },
  { id: 'social', label: 'Réseaux sociaux', icon: HiGlobeAlt },
  { id: 'notifications', label: 'Notifications', icon: HiBell },
  { id: 'security', label: 'Sécurité', icon: HiShieldCheck },
]

export default function AdminSettings() {
  const { settings: contextSettings, refreshSettings } = useSettings()
  const [settings, setSettings] = useState<StoreSettings | null>(null)
  const [activeTab, setActiveTab] = useState('general')
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load settings from backend on mount
  useEffect(() => {
    if (contextSettings) {
      setSettings({
        storeName: contextSettings.store_name || '',
        storeTagline: contextSettings.store_tagline || '',
        storeLogo: contextSettings.store_logo || '',
        storeFavicon: contextSettings.store_favicon || '',
        storeDescription: contextSettings.store_description || '',
        email: contextSettings.store_email || '',
        phone: contextSettings.store_phone || '',
        whatsapp: contextSettings.store_whatsapp || '',
        address: contextSettings.store_address || '',
        city: contextSettings.store_city || '',
        country: contextSettings.store_country || '',
        primaryColor: contextSettings.primary_color || '#0A0A0A',
        secondaryColor: contextSettings.secondary_color || '#0A0A0A',
        deliveryFeeAbidjan: contextSettings.delivery_fee_abidjan,
        deliveryFeeInterior: contextSettings.delivery_fee_interior,
        freeDeliveryFrom: contextSettings.free_delivery_from,
        cashOnDelivery: contextSettings.cash_on_delivery_enabled,
        onlinePayment: contextSettings.online_payment_enabled,
        deliveryDaysMin: contextSettings.delivery_days_min || 1,
        deliveryDaysMax: contextSettings.delivery_days_max || 5,
        autoConfirmOrders: contextSettings.auto_confirm_orders || false,
        maxItemsPerOrder: contextSettings.max_items_per_order || 10,
        currency: contextSettings.currency || 'XOF',
        language: contextSettings.language || 'fr',
        orangeMoney: contextSettings.orange_money_enabled || false,
        mtnMoney: contextSettings.mtn_money_enabled || false,
        wave: contextSettings.wave_enabled || false,
        card: contextSettings.card_enabled || false,
        orangeMoneyNumber: contextSettings.orange_money_number || '',
        mtnMoneyNumber: contextSettings.mtn_money_number || '',
        waveNumber: contextSettings.wave_number || '',
        instagram: contextSettings.social_instagram || '',
        facebook: contextSettings.social_facebook || '',
        tiktok: contextSettings.social_tiktok || '',
        snapchat: contextSettings.social_snapchat || '',
        emailNotifications: contextSettings.email_notifications || false,
        whatsappNotifications: contextSettings.whatsapp_notifications || false,
        adminOrderNotification: contextSettings.admin_order_notification || false,
        customerOrderConfirmation: contextSettings.customer_order_confirmation || false,
        deliveryReminder: contextSettings.delivery_reminder || false,
        twoFactorAuth: contextSettings.two_factor_auth || false,
        sessionTimeout: contextSettings.session_timeout || 30,
      })
      setLoading(false)
    }
  }, [contextSettings])

  const updateSetting = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => {
    setSettings(prev => prev ? { ...prev, [key]: value } : prev)
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (!settings) return
    
    setSaving(true)
    
    try {
      // Map form settings to API format
      const apiSettings = {
        store_name: settings.storeName,
        store_tagline: settings.storeTagline,
        store_logo: settings.storeLogo,
        store_favicon: settings.storeFavicon,
        store_description: settings.storeDescription,
        store_email: settings.email,
        store_phone: settings.phone,
        store_whatsapp: settings.whatsapp,
        store_address: settings.address,
        store_city: settings.city,
        store_country: settings.country,
        primary_color: settings.primaryColor,
        secondary_color: settings.secondaryColor,
        delivery_fee_abidjan: settings.deliveryFeeAbidjan,
        delivery_fee_interior: settings.deliveryFeeInterior,
        free_delivery_from: settings.freeDeliveryFrom,
        cash_on_delivery_enabled: settings.cashOnDelivery,
        online_payment_enabled: settings.onlinePayment,
        delivery_days_min: settings.deliveryDaysMin,
        delivery_days_max: settings.deliveryDaysMax,
        auto_confirm_orders: settings.autoConfirmOrders,
        max_items_per_order: settings.maxItemsPerOrder,
        currency: settings.currency,
        language: settings.language,
        orange_money_enabled: settings.orangeMoney,
        mtn_money_enabled: settings.mtnMoney,
        wave_enabled: settings.wave,
        card_enabled: settings.card,
        orange_money_number: settings.orangeMoneyNumber,
        mtn_money_number: settings.mtnMoneyNumber,
        wave_number: settings.waveNumber,
        social_instagram: settings.instagram,
        social_facebook: settings.facebook,
        social_tiktok: settings.tiktok,
        social_snapchat: settings.snapchat,
        email_notifications: settings.emailNotifications,
        whatsapp_notifications: settings.whatsappNotifications,
        admin_order_notification: settings.adminOrderNotification,
        customer_order_confirmation: settings.customerOrderConfirmation,
        delivery_reminder: settings.deliveryReminder,
        two_factor_auth: settings.twoFactorAuth,
        session_timeout: settings.sessionTimeout,
      }

      await settingsService.updateMany(apiSettings)
      await refreshSettings()
      
      setHasChanges(false)
      toast.success('Paramètres sauvegardés avec succès')
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (confirm('Réinitialiser tous les paramètres ?')) {
      refreshSettings()
      setHasChanges(false)
    }
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Paramètres</h1>
          <p className="text-gray-400 mt-1">Configurez votre boutique {contextSettings.store_name}.</p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-yellow-500 text-sm flex items-center gap-1">
              <HiExclamationCircle className="w-4 h-4" />
              Modifications non sauvegardées
            </span>
          )}
          <Button variant="ghost" onClick={handleReset}>
            Réinitialiser
          </Button>
          <Button 
            variant="primary" 
            icon={HiCheckCircle} 
            onClick={handleSave}
            loading={saving}
          >
            Sauvegarder
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-gold text-primary-black'
                : 'bg-dark-800 text-gray-400 hover:text-white border border-dark-600 hover:border-gray-500'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Settings Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {/* General Settings */}
          {activeTab === 'storefront' && <StorefrontSettings />}

          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Store Info */}
              <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
                    <HiBuildingStorefront className="w-5 h-5 text-gold" />
                  </div>
                  <h2 className="text-lg font-bold uppercase tracking-wider">Informations de la boutique</h2>
                </div>
                
                <Input
                  label="Nom de la boutique"
                  value={settings.storeName}
                  onChange={(e) => updateSetting('storeName', e.target.value)}
                  hint="Change partout : en-tête, pied de page, onglet du navigateur, emails, tickets et WhatsApp."
                />

                <Input
                  label="Signature"
                  value={settings.storeTagline}
                  onChange={(e) => updateSetting('storeTagline', e.target.value)}
                  hint="Phrase courte sous le nom (emails, pied de page)."
                />

                <div className="grid sm:grid-cols-2 gap-6">
                  <ImageUpload label="Logo" value={settings.storeLogo} onChange={(url) => updateSetting('storeLogo', url)} hint="PNG transparent recadré au ras du logo (ex. 2000 × 244 px), sans marge vide autour : les marges le rendent minuscule dans l'en-tête. Sans logo, le nom s'affiche en lettres." />
                  <ImageUpload label="Icône de l'onglet" value={settings.storeFavicon} onChange={(url) => updateSetting('storeFavicon', url)} hint="Image carrée." square />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={settings.storeDescription}
                    onChange={(e) => updateSetting('storeDescription', e.target.value)}
                    className="w-full bg-dark-700 border border-dark-500 rounded px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all resize-none"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <Input
                    label="Email"
                    type="email"
                    icon={HiEnvelope}
                    value={settings.email}
                    onChange={(e) => updateSetting('email', e.target.value)}
                  />
                  <Input
                    label="Téléphone"
                    icon={HiDevicePhoneMobile}
                    value={settings.phone}
                    onChange={(e) => updateSetting('phone', e.target.value)}
                  />
                </div>

                <Input
                  label="WhatsApp"
                  value={settings.whatsapp}
                  onChange={(e) => updateSetting('whatsapp', e.target.value)}
                />

                <Input
                  label="Adresse"
                  value={settings.address}
                  onChange={(e) => updateSetting('address', e.target.value)}
                />

                <div className="grid sm:grid-cols-2 gap-6">
                  <Input
                    label="Ville"
                    value={settings.city}
                    onChange={(e) => updateSetting('city', e.target.value)}
                  />
                  <Input
                    label="Pays"
                    value={settings.country}
                    onChange={(e) => updateSetting('country', e.target.value)}
                  />
                </div>
              </div>

              {/* Branding */}
              <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
                    <HiPhoto className="w-5 h-5 text-gold" />
                  </div>
                  <h2 className="text-lg font-bold uppercase tracking-wider">Apparence</h2>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 uppercase tracking-wider mb-1">
                      Couleur primaire
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="color"
                        value={settings.primaryColor}
                        onChange={(e) => updateSetting('primaryColor', e.target.value)}
                        className="w-12 h-12 rounded-lg cursor-pointer border-2 border-dark-500 bg-transparent"
                      />
                      <Input
                        value={settings.primaryColor}
                        onChange={(e) => updateSetting('primaryColor', e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 uppercase tracking-wider mb-1">
                      Couleur secondaire
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="color"
                        value={settings.secondaryColor}
                        onChange={(e) => updateSetting('secondaryColor', e.target.value)}
                        className="w-12 h-12 rounded-lg cursor-pointer border-2 border-dark-500 bg-transparent"
                      />
                      <Input
                        value={settings.secondaryColor}
                        onChange={(e) => updateSetting('secondaryColor', e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Preorder Settings */}
          {activeTab === 'preorder' && (
            <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
                  <HiTruck className="w-5 h-5 text-gold" />
                </div>
                <h2 className="text-lg font-bold uppercase tracking-wider">Livraison & commandes</h2>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <Input
                  label="Articles max par commande"
                  type="number"
                  min={1}
                  max={50}
                  value={settings.maxItemsPerOrder.toString()}
                  onChange={(e) => updateSetting('maxItemsPerOrder', Number(e.target.value))}
                />
              </div>

              <div className="grid sm:grid-cols-3 gap-6">
                <Input
                  label="Livraison Abidjan (FCFA)"
                  type="number"
                  min={0}
                  value={settings.deliveryFeeAbidjan.toString()}
                  onChange={(e) => updateSetting('deliveryFeeAbidjan', Number(e.target.value))}
                />
                <Input
                  label="Livraison intérieur (FCFA)"
                  type="number"
                  min={0}
                  value={settings.deliveryFeeInterior.toString()}
                  onChange={(e) => updateSetting('deliveryFeeInterior', Number(e.target.value))}
                />
                <Input
                  label="Livraison offerte dès (FCFA)"
                  type="number"
                  min={0}
                  value={settings.freeDeliveryFrom.toString()}
                  onChange={(e) => updateSetting('freeDeliveryFrom', Number(e.target.value))}
                  hint="0 = jamais offerte"
                />
              </div>
              <label className="flex items-center justify-between p-4 bg-dark-700 rounded-xl cursor-pointer">
                <div>
                  <p className="font-medium">Paiement à la livraison</p>
                  <p className="text-sm text-gray-400">Le client paie le livreur (espèces ou Mobile Money) ou au retrait en boutique</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateSetting('cashOnDelivery', !settings.cashOnDelivery)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${settings.cashOnDelivery ? 'bg-gold' : 'bg-dark-500'}`}
                >
                  <motion.div animate={{ x: settings.cashOnDelivery ? 20 : 2 }} className="absolute top-1 w-5 h-5 bg-white rounded-full" />
                </button>
              </label>
              <label className="flex items-center justify-between p-4 bg-dark-700 rounded-xl cursor-pointer">
                <div>
                  <p className="font-medium">Paiement en ligne</p>
                  <p className="text-sm text-gray-400">Paystack : Wave, Orange Money, MTN, Moov, carte. Non payée en 2 h, la commande est annulée et son stock libéré.</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateSetting('onlinePayment', !settings.onlinePayment)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${settings.onlinePayment ? 'bg-gold' : 'bg-dark-500'}`}
                >
                  <motion.div animate={{ x: settings.onlinePayment ? 20 : 2 }} className="absolute top-1 w-5 h-5 bg-white rounded-full" />
                </button>
              </label>

              <div className="grid sm:grid-cols-2 gap-6">
                <Input
                  label="Délai minimum (jours)"
                  type="number"
                  value={settings.deliveryDaysMin.toString()}
                  onChange={(e) => updateSetting('deliveryDaysMin', Number(e.target.value))}
                />
                <Input
                  label="Délai maximum (jours)"
                  type="number"
                  value={settings.deliveryDaysMax.toString()}
                  onChange={(e) => updateSetting('deliveryDaysMax', Number(e.target.value))}
                />
              </div>

              <div className="p-4 bg-dark-700 rounded-xl">
                <p className="text-sm text-gray-400">
                  Délai de livraison affiché : <span className="text-white font-medium">{settings.deliveryDaysMin}-{settings.deliveryDaysMax} jours</span>
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Retrait en boutique : <span className="text-white font-medium">gratuit</span>
                </p>
              </div>

              <label className="flex items-center justify-between p-4 bg-dark-700 rounded-xl cursor-pointer">
                <div>
                  <p className="font-medium">Confirmation automatique</p>
                  <p className="text-sm text-gray-400">Confirmer automatiquement les commandes après paiement</p>
                </div>
                <button
                  onClick={() => updateSetting('autoConfirmOrders', !settings.autoConfirmOrders)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    settings.autoConfirmOrders ? 'bg-gold' : 'bg-dark-500'
                  }`}
                >
                  <motion.div
                    animate={{ x: settings.autoConfirmOrders ? 20 : 2 }}
                    className="absolute top-1 w-5 h-5 bg-white rounded-full"
                  />
                </button>
              </label>
            </div>
          )}

          {/* Payment Settings */}
          {activeTab === 'payment' && (
            <div className="space-y-6">
              <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
                    <HiCreditCard className="w-5 h-5 text-gold" />
                  </div>
                  <h2 className="text-lg font-bold uppercase tracking-wider">Paiement</h2>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 uppercase tracking-wider mb-1">Devise</label>
                    <select
                      value={settings.currency}
                      onChange={(e) => updateSetting('currency', e.target.value)}
                      className="w-full bg-dark-700 border border-dark-500 rounded px-4 py-3 text-white focus:outline-none focus:border-gold"
                    >
                      <option value="XOF">XOF - Franc CFA</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="USD">USD - Dollar</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 uppercase tracking-wider mb-1">Langue</label>
                    <select
                      value={settings.language}
                      onChange={(e) => updateSetting('language', e.target.value)}
                      className="w-full bg-dark-700 border border-dark-500 rounded px-4 py-3 text-white focus:outline-none focus:border-gold"
                    >
                      <option value="fr">Français</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8 space-y-6">
                <h3 className="font-bold uppercase tracking-wider text-sm text-gray-400">Moyens de paiement</h3>
                
                <div className="space-y-4">
                  {[
                    { key: 'orangeMoney' as const, label: 'Orange Money', icon: '📱', numberKey: 'orangeMoneyNumber' as const, numberLabel: 'Numéro Orange Money' },
                    { key: 'mtnMoney' as const, label: 'MTN Money', icon: '📱', numberKey: 'mtnMoneyNumber' as const, numberLabel: 'Numéro MTN Money' },
                    { key: 'wave' as const, label: 'Wave', icon: '💳', numberKey: 'waveNumber' as const, numberLabel: 'Numéro Wave' },
                    { key: 'card' as const, label: 'Carte bancaire', icon: '🏦', numberKey: null, numberLabel: null },
                  ].map((method) => (
                    <div key={method.key} className="space-y-3">
                      <label className="flex items-center justify-between p-4 bg-dark-700 rounded-xl cursor-pointer">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{method.icon}</span>
                          <span className="font-medium">{method.label}</span>
                        </div>
                        <button
                          onClick={() => updateSetting(method.key, !settings[method.key])}
                          className={`relative w-12 h-7 rounded-full transition-colors ${
                            settings[method.key] ? 'bg-gold' : 'bg-dark-500'
                          }`}
                        >
                          <motion.div
                            animate={{ x: settings[method.key] ? 20 : 2 }}
                            className="absolute top-1 w-5 h-5 bg-white rounded-full"
                          />
                        </button>
                      </label>
                      
                      {settings[method.key] && method.numberKey && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                        >
                          <Input
                            label={method.numberLabel || ''}
                            value={settings[method.numberKey]}
                            onChange={(e) => updateSetting(method.numberKey!, e.target.value)}
                            placeholder="+225 XX XX XX XX XX"
                          />
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Social Settings */}
          {activeTab === 'social' && (
            <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
                  <HiGlobeAlt className="w-5 h-5 text-gold" />
                </div>
                <h2 className="text-lg font-bold uppercase tracking-wider">Réseaux sociaux</h2>
              </div>

              <div className="space-y-4">
                {[
                  { key: 'instagram' as const, icon: FaInstagram, label: 'Instagram', prefix: '@' },
                  { key: 'facebook' as const, icon: FaFacebook, label: 'Facebook', prefix: 'facebook.com/' },
                  { key: 'tiktok' as const, icon: FaTiktok, label: 'TikTok', prefix: '@' },
                  { key: 'snapchat' as const, icon: FaWhatsapp, label: 'Snapchat', prefix: '' },
                ].map((social) => (
                  <Input
                    key={social.key}
                    label={social.label}
                    icon={social.icon}
                    value={settings[social.key]}
                    onChange={(e) => updateSetting(social.key, e.target.value)}
                    placeholder={`${social.prefix}basicstoreci`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Notifications Settings */}
          {activeTab === 'notifications' && (
            <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
                  <HiBell className="w-5 h-5 text-gold" />
                </div>
                <h2 className="text-lg font-bold uppercase tracking-wider">Notifications</h2>
              </div>

              <div className="space-y-4">
                {[
                  { key: 'emailNotifications' as const, label: 'Notifications email', desc: 'Recevoir les notifications par email' },
                  { key: 'whatsappNotifications' as const, label: 'Notifications WhatsApp', desc: 'Recevoir les notifications sur WhatsApp' },
                  { key: 'adminOrderNotification' as const, label: 'Nouvelles commandes', desc: 'Être notifié à chaque nouvelle commande' },
                  { key: 'customerOrderConfirmation' as const, label: 'Confirmation client', desc: 'Envoyer une confirmation automatique au client' },
                  { key: 'deliveryReminder' as const, label: 'Rappel de livraison', desc: 'Rappeler au client la livraison imminente' },
                ].map((notif) => (
                  <label key={notif.key} className="flex items-center justify-between p-4 bg-dark-700 rounded-xl cursor-pointer">
                    <div>
                      <p className="font-medium">{notif.label}</p>
                      <p className="text-sm text-gray-400">{notif.desc}</p>
                    </div>
                    <button
                      onClick={() => updateSetting(notif.key, !settings[notif.key])}
                      className={`relative w-12 h-7 rounded-full transition-colors ${
                        settings[notif.key] ? 'bg-gold' : 'bg-dark-500'
                      }`}
                    >
                      <motion.div
                        animate={{ x: settings[notif.key] ? 20 : 2 }}
                        className="absolute top-1 w-5 h-5 bg-white rounded-full"
                      />
                    </button>
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="mt-6">
              <EmailTest />
            </div>
          )}

          {/* Security: real account controls (password change) */}
          {activeTab === 'security' && <AccountSecurity />}
        </motion.div>
      </AnimatePresence>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          variant="primary" 
          size="lg" 
          icon={HiCheckCircle} 
          onClick={handleSave}
          loading={saving}
          disabled={!hasChanges}
        >
          Sauvegarder tous les paramètres
        </Button>
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}