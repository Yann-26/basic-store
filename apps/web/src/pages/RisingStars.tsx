import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { FaInstagram } from 'react-icons/fa'
import { LookGrid, LookStories } from '../components/community/LookCards'
import { useInstagramProfile } from '../components/community/useInstagramProfile'
import Button from '../components/ui/Button'
import { StarMark } from '../components/ui/Logo'
import { useSettings } from '../context/SettingsContext'
import { engagementService, type CommunityLook } from '../services/engagementService'

/** The full lookbook of our customers' outfits. */
export default function RisingStars() {
  const { settings } = useSettings()
  const { profile, handle } = useInstagramProfile()
  const [looks, setLooks] = useState<CommunityLook[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    engagementService
      .instagramFeed(60)
      .then((all) => setLooks(all.filter((l) => l.image_url)))
      .catch(() => setLooks([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <Helmet>
        <title>{`Les looks — Ils portent la Maison | ${settings.store_name}`}</title>
        <meta name="description" content={`Les plus beaux looks de nos clients, avec les pièces ${settings.store_name} qu'ils portent.`} />
      </Helmet>

      <section className="relative overflow-hidden border-b border-gold/20 bg-[radial-gradient(ellipse_at_top,rgb(var(--glow)/0.08),transparent_65%)] pb-12 pt-16 text-center md:pt-24">
        <StarMark className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 opacity-10" />
        <div className="container-custom relative">
          <p className="eyebrow mb-4 inline-flex items-center gap-2">
            <FaInstagram /> @{handle} · Lookbook
          </p>
          <h1 className="text-5xl font-semibold md:text-7xl">
            Ils portent <span className="text-gold-gradient italic">la Maison</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-gray-400">
            Ils portent {settings.store_name} mieux que personne. Découvrez leurs looks, les pièces qu'ils ont choisies, et retrouvez-les sur Instagram.
          </p>
        </div>
      </section>

      <section className="container-custom py-14">
        {loading ? (
          <div className="grid auto-rows-[230px] grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-3xl bg-dark-700" />
            ))}
          </div>
        ) : looks.length > 0 ? (
          <>
            <LookStories looks={looks} />
            <LookGrid looks={looks} />
          </>
        ) : (
          <p className="py-20 text-center text-gray-400">Les premiers looks arrivent très bientôt.</p>
        )}

        <div className="mx-auto mt-16 max-w-2xl rounded-3xl border border-gold/30 bg-dark-800 p-8 text-center">
          <p className="font-display text-3xl">Montrez-nous votre look</p>
          <p className="mt-3 text-sm text-gray-400">Envoyez-nous votre plus beau look avec vos pièces {settings.store_name}, en message ou en nous identifiant @{handle}.</p>
          <a href={profile} target="_blank" rel="noopener noreferrer" className="mt-6 inline-block">
            <Button icon={FaInstagram}>Écrire sur Instagram</Button>
          </a>
        </div>
      </section>
    </>
  )
}
