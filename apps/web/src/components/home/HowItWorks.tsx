import { useSettings } from '../../context/SettingsContext'
import SectionHeading from '../ui/SectionHeading'

export default function HowItWorks() {
  const { settings } = useSettings()
  const steps = [
    { n: '01', title: 'Choisissez', text: 'Parcourez la boutique et ajoutez vos articles au panier, dans votre taille : le stock est à jour en temps réel.' },
    { n: '02', title: 'Commandez', text: 'Payez à la livraison (espèces ou Mobile Money) ou en ligne : Wave, Orange Money, MTN, Moov ou carte.' },
    { n: '03', title: 'On prépare', text: 'Vos articles sont réservés aussitôt. Nous vous appelons, préparons et emballons votre commande en boutique.' },
    { n: '04', title: 'Recevez', text: `Livraison partout en Côte d’Ivoire sous ${settings.delivery_days_min} à ${settings.delivery_days_max} jours, ou retrait gratuit à la boutique d’Angré.` },
  ]
  return (
    <section id="process" className="relative overflow-hidden py-20 md:py-28">
      <div className="container-custom">
        <SectionHeading align="center" eyebrow="Commander, simplement" title="Comment ça marche" />
        <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li key={s.n} className="border border-dark-600 bg-dark-800 p-8">
              <span className="font-display text-5xl">{s.n}</span>
              <h3 className="mt-6 text-2xl">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-400">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
