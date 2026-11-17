import { Link } from 'react-router-dom'
import { useSettings } from '../../context/SettingsContext'
import { socialUrl, whatsappLink } from '../../utils/constants'
import Logo from '../ui/Logo'
import NewsletterForm from './NewsletterForm'

const HELP = [
  { name: 'Contactez-nous', path: '/contact' },
  { name: 'FAQ', path: '/faq' },
  { name: 'Suivre ma commande', path: '/track' },
  { name: 'Guide des tailles', path: '/faq#tailles' },
]

const HOUSE = [
  { name: 'La boutique', path: '/about' },
  { name: 'Nouveautés', path: '/collection?sort=newest' },
  { name: 'Femme', path: '/collection?gender=women' },
  { name: 'Homme', path: '/collection?gender=men' },
  { name: 'Les looks clients', path: '/looks' },
]

const heading = 'mb-5 font-sans text-xs font-semibold'
const link = 'text-xs uppercase tracking-[0.04em] text-gray-300 underline-offset-4 hover:underline'

/** Plain footer: small link columns, the newsletter, the name and the legal line. */
export default function Footer() {
  const { settings } = useSettings()
  const year = new Date().getFullYear()
  const socials = [
    { href: socialUrl('instagram', settings.social_instagram), label: 'Instagram' },
    { href: socialUrl('tiktok', settings.social_tiktok), label: 'TikTok' },
    { href: socialUrl('facebook', settings.social_facebook), label: 'Facebook' },
    { href: socialUrl('snapchat', settings.social_snapchat), label: 'Snapchat' },
    { href: whatsappLink(settings.store_whatsapp), label: 'WhatsApp' },
  ].filter((s) => s.href)

  return (
    <footer className="border-t border-white/10 bg-primary-black">
      <div className="container-custom grid gap-12 pb-16 pt-20 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <h2 className={heading}>Pouvons-nous vous aider ?</h2>
          <ul className="space-y-3">
            {HELP.map((l) => (
              <li key={l.path}>
                <Link to={l.path} className={link}>
                  {l.name}
                </Link>
              </li>
            ))}
            <li>
              <a href={whatsappLink(settings.store_whatsapp)} target="_blank" rel="noopener noreferrer" className={link}>
                WhatsApp
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className={heading}>Basic Store</h2>
          <ul className="space-y-3">
            {HOUSE.map((l) => (
              <li key={l.path}>
                <Link to={l.path} className={link}>
                  {l.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className={heading}>Suivez-nous</h2>
          <ul className="space-y-3">
            {socials.map((s) => (
              <li key={s.label}>
                <a href={s.href} target="_blank" rel="noopener noreferrer" className={link}>
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div id="newsletter" className="scroll-mt-28">
          <h2 className={heading}>Recevoir les nouveautés</h2>
          <p className="mb-5 text-xs leading-relaxed text-gray-400">
            Les nouveaux arrivages et les promos, en avant-première, par email. Désinscription en un clic.
          </p>
          <NewsletterForm tone="line" />
        </div>
      </div>

      <div className="container-custom flex flex-col gap-6 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <Logo size="lg" />
        <address className="text-xs not-italic leading-relaxed text-gray-400 sm:text-right">
          Boutique : {settings.store_address || 'Angré Nouveau CHU, Djorogobité 1'}, {settings.store_city || 'Abidjan'}
          <br />
          <a href="https://maps.app.goo.gl/WxVjzGNrFPwsw9nd9" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
            Voir sur la carte
          </a>{' '}
          · {settings.store_phone}
        </address>
      </div>
      <div className="container-custom flex flex-col gap-3 pb-10 text-[11px] text-gray-500 sm:flex-row sm:justify-between">
        <p>
          © {year} {settings.store_name} · {settings.store_city}
        </p>
        <p>Paiement à la livraison ou en ligne · Livraison partout en Côte d'Ivoire</p>
      </div>

    </footer>
  )
}
