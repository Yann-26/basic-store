import { useSettings } from '../../context/SettingsContext'
import SectionHeading from '../ui/SectionHeading'

export default function HowItWorks() {
  const { settings } = useSettings()
  const deposit = settings.deposit_percentage
  const steps = [
    { n: '01', title: 'Choisissez', text: 'Parcourez la série du moment et ajoutez vos pièces à votre sélection, dans votre taille.' },
    { n: '02', title: 'Réglez', text: `Payez en ligne, en toute sécurité : Wave, Orange Money, MTN, Moov ou carte. ${deposit < 100 ? `Un acompte de ${deposit} % à la précommande, le solde avant la livraison.` : 'Le montant total est réglé à la commande.'}` },
    { n: '03', title: 'Suivez', text: 'Suivez chaque étape — fabrication, contrôle qualité, expédition — avec votre numéro de commande.' },
    { n: '04', title: 'Portez', text: `Recevez votre commande sous ${settings.delivery_days_min} à ${settings.delivery_days_max} jours, partout en Côte d’Ivoire.` },
  ]
  return (
    <section id="process" className="relative overflow-hidden py-20 md:py-28">
      <div className="container-custom">
        <SectionHeading align="center" eyebrow="Le drop, simplement" title="Comment ça marche" />
        <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li key={s.n} className="rounded-3xl border border-white/5 bg-dark-800 p-8">
              <span className="font-display text-5xl text-gold-gradient">{s.n}</span>
              <h3 className="mt-6 text-2xl">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-400">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
