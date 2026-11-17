import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import type { Product } from '@trs/shared'
import { productsService } from '../../services/productsService'
import LookbookEditor from './marketing/LookbookEditor'
import RackEditor from './marketing/RackEditor'
import AnnouncementEditor from './marketing/AnnouncementEditor'
import CampaignLinks from './marketing/CampaignLinks'
import PromoCodesEditor from './marketing/PromoCodesEditor'
import ReferralEditor from './marketing/ReferralEditor'
import ReviewsModeration from './marketing/ReviewsModeration'
import WelcomeEditor from './marketing/WelcomeEditor'
import SpotlightEditor from './SpotlightEditor'

const TABS = [
  { id: 'accueil', label: 'Accueil & merci' },
  { id: 'lookbook', label: 'Lookbook' },
  { id: 'portant', label: 'Le portant' },
  { id: 'drop', label: "Pièce à l'honneur" },
  { id: 'avis', label: 'Avis clients' },
  { id: 'bandeau', label: 'Bandeau' },
  { id: 'codes', label: 'Codes promo' },
  { id: 'parrainage', label: 'Parrainage' },
  { id: 'liens', label: 'Liens & QR codes' },
] as const
type TabId = (typeof TABS)[number]['id']

/** Everything that makes the shop's pieces seen and sold: shootings, announcements, promo codes, referral, tracked links. */
export default function Marketing() {
  const [params, setParams] = useSearchParams()
  const tab: TabId = TABS.find((t) => t.id === params.get('tab'))?.id ?? 'accueil'
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    productsService
      .getAll()
      .then((all) => setProducts(all.filter((p) => p.is_active)))
      .catch(() => setProducts([]))
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Marketing</h1>
        <p className="mt-1 text-gray-400">Mettez vos pièces en scène sur l'accueil et suivez ce qui attire vos visiteurs.</p>
      </div>

      <div role="tablist" aria-label="Marketing" className="no-scrollbar flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams({ tab: t.id }, { replace: true })}
            className={clsx(
              'whitespace-nowrap rounded-xl px-5 py-3 text-sm font-medium transition-all',
              tab === t.id ? 'bg-gold text-primary-black' : 'border border-dark-600 bg-dark-800 text-gray-400 hover:text-white',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'accueil' && <WelcomeEditor />}
      {tab === 'lookbook' && <LookbookEditor products={products} />}
      {tab === 'portant' && <RackEditor products={products} />}
      {tab === 'drop' && <SpotlightEditor />}
      {tab === 'avis' && <ReviewsModeration />}
      {tab === 'bandeau' && <AnnouncementEditor />}
      {tab === 'codes' && <PromoCodesEditor />}
      {tab === 'parrainage' && <ReferralEditor />}
      {tab === 'liens' && <CampaignLinks products={products} />}
    </div>
  )
}
