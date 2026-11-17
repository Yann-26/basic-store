import { HiShieldCheck, HiSparkles, HiTruck, HiChatBubbleLeftRight } from 'react-icons/hi2'
import { useSettings } from '../../context/SettingsContext'

export default function WhyUs() {
  const { settings } = useSettings()
  const items = [
    { icon: HiShieldCheck, title: 'Qualité contrôlée', text: "Coton épais, coutures solides : chaque pièce est vérifiée (coutures, marquage, taille) avant de vous être remise." },
    { icon: HiSparkles, title: 'Séries limitées', text: 'Des pièces fabriquées à Abidjan, en petites séries annoncées à l\'avance. Simples, bien coupées, faites pour durer.' },
    { icon: HiTruck, title: `Livrée en ${settings.delivery_days_min}-${settings.delivery_days_max} jours`, text: "Partout à Abidjan et en Côte d'Ivoire, avec suivi de votre commande." },
    { icon: HiChatBubbleLeftRight, title: 'Conseil personnalisé', text: 'Une question de taille, de style ? Notre équipe vous répond sur WhatsApp.' },
  ]
  return (
    <section className="border-y border-gold/10 bg-dark-800 py-16">
      <div className="container-custom grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.title} className="flex gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-gold/40">
              <it.icon className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h3 className="font-sans text-sm font-semibold uppercase tracking-[0.15em]">{it.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">{it.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
