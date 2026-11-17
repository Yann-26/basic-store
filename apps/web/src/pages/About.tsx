import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { FaWhatsapp, FaInstagram } from 'react-icons/fa'
import { HiOutlineMapPin, HiOutlinePhone } from 'react-icons/hi2'
import { PRODUCT_CATEGORIES } from '@trs/shared'
import { useSettings } from '../context/SettingsContext'
import { socialUrl, whatsappLink } from '../utils/constants'
import HowItWorks from '../components/home/HowItWorks'
import Button from '../components/ui/Button'

const MAPS_URL = 'https://maps.app.goo.gl/WxVjzGNrFPwsw9nd9'

/** "La boutique": who we are, where to find the shop, how ordering works. */
export default function About() {
  const { settings } = useSettings()
  const address = settings.store_address || 'Angré Nouveau CHU, Djorogobité 1'
  const instagram = socialUrl('instagram', settings.social_instagram)
  return (
    <>
      <Helmet>
        <title>{`La boutique | ${settings.store_name}`}</title>
      </Helmet>
      <section className="py-16 md:py-24">
        <div className="container-custom grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          <div className="max-w-2xl">
            <p className="eyebrow mb-4">La boutique</p>
            <h1 className="text-5xl leading-tight md:text-7xl">La qualité, à bon prix.</h1>
            <p className="mt-8 text-lg leading-relaxed text-gray-300">
              {settings.store_name}, c’est une boutique de mode à Abidjan : vêtements, chaussures et accessoires pour femme et homme, choisis pour leur qualité et vendus à un prix
              juste. Passez nous voir à Angré, ou commandez en ligne : on livre partout en Côte d’Ivoire.
            </p>
            <p className="mt-6 text-lg leading-relaxed text-gray-400">
              Le stock affiché sur le site est celui de la boutique, taille par taille. Quand vous commandez, vos articles sont réservés pour vous ; vous payez à la livraison ou en
              ligne, comme vous préférez.
            </p>
          </div>
          <aside className="border border-dark-600 bg-dark-800 p-8">
            <h2 className="text-2xl">Venir en boutique</h2>
            <ul className="mt-6 space-y-4 text-sm">
              <li className="flex gap-3">
                <HiOutlineMapPin className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" />
                <span>
                  {address}, {settings.store_city || 'Abidjan'}
                  <br />
                  <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                    Itinéraire Google Maps
                  </a>
                </span>
              </li>
              {settings.store_phone && (
                <li className="flex gap-3">
                  <HiOutlinePhone className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" />
                  <a href={`tel:${settings.store_phone.replace(/\s/g, '')}`}>{settings.store_phone}</a>
                </li>
              )}
              <li className="flex gap-3">
                <FaWhatsapp className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" />
                <a href={whatsappLink(settings.store_whatsapp, 'Bonjour Basic Store !')} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                  Écrire sur WhatsApp
                </a>
              </li>
              {instagram && (
                <li className="flex gap-3">
                  <FaInstagram className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" />
                  <a href={instagram} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                    @{settings.social_instagram.replace(/^@/, '')}
                  </a>
                </li>
              )}
            </ul>
          </aside>
        </div>
      </section>

      <section className="bg-dark-700 py-20">
        <div className="container-custom grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {[
            { t: 'La qualité', d: 'Des matières et des finitions que l’on vérifie avant de les mettre en rayon.' },
            { t: 'Le bon prix', d: 'Des prix justes, et des promos régulières pour nos clients fidèles.' },
            { t: 'La livraison', d: 'Partout en Côte d’Ivoire, en 24 à 48 h à Abidjan.' },
            { t: 'Le conseil', d: 'Une question de taille ou de style ? On vous répond sur WhatsApp.' },
          ].map((v, i) => (
            <div key={v.t}>
              <p className="mb-4 text-xs tabular-nums text-gray-500">{String(i + 1).padStart(2, '0')}</p>
              <h2 className="text-3xl">{v.t}</h2>
              <p className="mt-3 text-gray-500">{v.d}</p>
            </div>
          ))}
        </div>
      </section>

      <HowItWorks />

      <section className="border-t border-dark-600 py-20 text-center">
        <div className="container-custom">
          <h2 className="text-3xl md:text-5xl">Trouvez votre style.</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {PRODUCT_CATEGORIES.map((c) => (
              <Link key={c.id} to={`/collection?category=${c.id}`} className="border border-dark-500 px-5 py-2 text-sm hover:border-gold">
                {c.label}
              </Link>
            ))}
          </div>
          <Link to="/collection" className="mt-10 inline-block">
            <Button size="lg">Découvrir la boutique</Button>
          </Link>
        </div>
      </section>
    </>
  )
}
