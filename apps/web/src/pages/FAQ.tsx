import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import clsx from 'clsx'
import { HiChevronDown } from 'react-icons/hi2'
import { useSettings } from '../context/SettingsContext'
import SizeGuide from '../components/products/SizeGuide'
import Button from '../components/ui/Button'

export default function FAQ() {
  const { settings } = useSettings()
  const [open, setOpen] = useState<string | null>('0-0')
  const [guide, setGuide] = useState(false)
  const deposit = settings.deposit_percentage
  const pay = deposit < 100 ? `un acompte de ${deposit} % en ligne (le solde avant la livraison)` : 'le montant total en ligne'

  const sections = [
    {
      id: 'precommande',
      title: 'Commande & drops',
      items: [
        {
          q: 'Comment fonctionne la précommande ?',
          a: `Nos pièces sortent par séries limitées (« drops »). Vous choisissez vos pièces, réglez ${pay}, nous les fabriquons à Abidjan, les contrôlons puis vous les livrons.`,
        },
        { q: 'Quels sont les délais ?', a: `Comptez ${settings.delivery_days_min} à ${settings.delivery_days_max} jours après confirmation de votre paiement.` },
        { q: 'Puis-je annuler ma précommande ?', a: "Oui, tant que la fabrication de votre pièce n'a pas commencé. Contactez-nous avec votre numéro de précommande." },
      ],
    },
    {
      id: 'paiement',
      title: 'Paiement',
      items: [
        ...(deposit < 100
          ? [{ q: 'Comment fonctionne l’acompte ?', a: `Vous réglez ${deposit} % du prix à la précommande : il lance la fabrication de votre pièce. Le solde (${100 - deposit} %) se règle en ligne avant la livraison ; nous vous envoyons un lien de paiement dès que votre pièce est prête.` }]
          : []),
        { q: 'Quels moyens de paiement acceptez-vous ?', a: "Le paiement se fait en ligne, en toute sécurité, avec Paystack : Wave, Orange Money, MTN, Moov ou carte bancaire. Votre commande est confirmée dès que le premier paiement est reçu, et vous recevez un email." },
        { q: 'Mon paiement est-il remboursable ?', a: "Oui, il est intégralement remboursé si vous annulez avant le lancement de la fabrication, ou si nous ne parvenons pas à vous livrer votre pièce." },
      ],
    },
    {
      id: 'tailles',
      title: 'Produits & tailles',
      items: [
        { q: 'Où et comment sont fabriquées vos pièces ?', a: 'À Abidjan, dans un atelier partenaire, en coton épais. Chaque pièce est vérifiée (coutures, marquage, taille) avant l\'envoi.' },
        { q: 'Comment choisir ma taille ?', a: 'Chaque fiche produit indique les tailles disponibles et un guide (vêtements, chaussures, enfants). En cas de doute, écrivez-nous sur WhatsApp.' },
        { q: 'Que vendez-vous ?', a: 'Des vêtements simples et bien coupés : T-shirts oversize et à manches longues, en tailles S à XL, pour femme et homme. Polos, chemises, puis sur-mesure et tenues de cérémonie suivront.' },
      ],
    },
    {
      id: 'livraison',
      title: 'Livraison & suivi',
      items: [
        { q: "Livrez-vous partout en Côte d'Ivoire ?", a: "Oui, dans toutes les communes d'Abidjan et les principales villes du pays." },
        { q: 'Puis-je suivre ma commande ?', a: 'Oui, depuis la page Suivi avec votre numéro SC-XXXXXXXX. Vous recevez aussi un email à chaque étape clé.' },
      ],
    },
  ]

  return (
    <>
      <Helmet>
        <title>{`FAQ | ${settings.store_name}`}</title>
      </Helmet>
      <section className="container-custom max-w-4xl py-14 md:py-20">
        <p className="eyebrow mb-3">Aide</p>
        <h1 className="text-4xl font-semibold md:text-6xl">Questions fréquentes</h1>
        <div className="mt-12 space-y-12">
          {sections.map((s, si) => (
            <div key={s.id} id={s.id} className="scroll-mt-28">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl text-gold">{s.title}</h2>
                {s.id === 'tailles' && (
                  <button onClick={() => setGuide(true)} className="text-xs uppercase tracking-widest text-gray-400 underline hover:text-gold">
                    Guide des tailles
                  </button>
                )}
              </div>
              <div className="divide-y divide-white/5 rounded-3xl border border-white/5 bg-dark-800">
                {s.items.map((item, qi) => {
                  const key = `${si}-${qi}`
                  const isOpen = open === key
                  return (
                    <div key={key}>
                      <button onClick={() => setOpen(isOpen ? null : key)} className="flex w-full items-center justify-between gap-4 p-6 text-left" aria-expanded={isOpen}>
                        <span className="font-medium">{item.q}</span>
                        <HiChevronDown className={clsx('h-5 w-5 flex-shrink-0 text-gold transition-transform', isOpen && 'rotate-180')} />
                      </button>
                      {isOpen && <p className="px-6 pb-6 text-sm leading-relaxed text-gray-400">{item.a}</p>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-16 rounded-3xl bg-ivory p-10 text-center text-primary-black">
          <h2 className="text-3xl">Une autre question ?</h2>
          <p className="mt-2 text-neutral-600">Notre équipe vous répond avec plaisir.</p>
          <Link to="/contact" className="mt-6 inline-block">
            <Button variant="dark">Nous contacter</Button>
          </Link>
        </div>
      </section>
      <SizeGuide open={guide} onClose={() => setGuide(false)} />
    </>
  )
}
