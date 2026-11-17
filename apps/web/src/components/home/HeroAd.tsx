import { Link } from 'react-router-dom'
import type { AppSettings } from '../../services/settingsService'
import { safeAdLink } from '../../utils/links'

/**
 * Advertising visual of the hero (Vitrine → Publicité du hero), shown only when switched on.
 * It fills the screen under the header, on a computer and on a phone (with its own upright
 * version), the picture covering the whole area.
 */
export default function HeroAd({ settings }: { settings: AppSettings }) {
  const desktop = settings.hero_ad_desktop
  const mobile = settings.hero_ad_mobile || desktop
  if (!settings.hero_ad_enabled || (!desktop && !mobile)) return null
  const link = safeAdLink(settings.hero_ad_link)
  const alt = settings.hero_ad_alt || `Offre ${settings.store_name}`

  const visual = (
    <picture className="block h-full w-full">
      <source media="(max-width: 767px)" srcSet={mobile} />
      <img src={desktop || mobile} alt={alt} className="h-full w-full object-cover object-center" fetchPriority="high" />
    </picture>
  )

  return (
    <section aria-label="Publicité" className="relative h-[calc(100svh-6.5rem)] min-h-[24rem] w-full overflow-hidden bg-dark-800">
      {link?.internal ? (
        <Link to={link.href} className="block h-full w-full">
          {visual}
        </Link>
      ) : link ? (
        <a href={link.href} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
          {visual}
        </a>
      ) : (
        visual
      )}
    </section>
  )
}
