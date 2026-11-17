import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import clsx from 'clsx'
import { HiChevronDown } from 'react-icons/hi2'
import { formatCurrency } from '@trs/shared'
import { useSettings } from '../context/SettingsContext'
import SizeGuide from '../components/products/SizeGuide'
import Button from '../components/ui/Button'

export default function FAQ() {
  const { settings } = useSettings()
  const [open, setOpen] = useState<string | null>('0-0')
  const [guide, setGuide] = useState(false)
  const fee = (n: number) => (n > 0 ? formatCurrency(n) : 'gratuite')

  const sections = [
    {
      id: 'commande',
      title: 'Commande',
      items: [
        {
          q: 'Comment commander ?',
          a: 'Choisissez vos articles, votre taille, ajoutez-les au panier puis validez votre commande. Vos articles sont aussitôt réservés pour vous. Nous vous appelons pour confirmer la livraison.',
        },
        { q: 'Les articles affichés sont-ils en stock ?', a: 'Oui : le site affiche le stock de la boutique en temps réel, taille par taille. Si une taille n’apparaît plus, elle est épuisée — écrivez-nous sur WhatsApp, un réassort arrive souvent vite.' },
        { q: 'Puis-je annuler ma commande ?', a: 'Oui, tant qu’elle n’est pas partie en livraison. Contactez-nous sur WhatsApp avec votre numéro de commande (BS-…).' },
      ],
    },
    {
      id: 'paiement',
      title: 'Paiement',
      items: [
        { q: 'Quels moyens de paiement acceptez-vous ?', a: 'Deux possibilités : payer à la livraison (espèces ou Mobile Money au livreur, ou au retrait en boutique), ou payer en ligne à la commande avec Wave, Orange Money, MTN, Moov ou carte bancaire (page sécurisée Paystack).' },
        { q: 'Que se passe-t-il si je ne paie pas en ligne ?', a: 'Une commande « paiement en ligne » non réglée est annulée automatiquement après 2 heures, et ses articles sont remis en vente. Vous pouvez repasser commande avec le paiement à la livraison.' },
        { q: 'Comment suis-je remboursé(e) ?', a: 'Si un article payé en ligne ne peut pas vous être livré, ou en cas de retour accepté, nous vous remboursons par le même moyen de paiement.' },
      ],
    },
    {
      id: 'tailles',
      title: 'Produits & tailles',
      items: [
        { q: 'Comment choisir ma taille ?', a: 'Chaque fiche produit indique les tailles disponibles et un guide (vêtements, chaussures, enfants). En cas de doute, écrivez-nous sur WhatsApp : on vous conseille.' },
        { q: 'Puis-je essayer en boutique ?', a: `Bien sûr ! La boutique ${settings.store_name} vous accueille à ${settings.store_address || 'Angré Nouveau CHU, Djorogobité 1'}. Vous pouvez aussi commander en ligne et choisir le retrait en boutique (gratuit).` },
      ],
    },
    {
      id: 'livraison',
      title: 'Livraison & retours',
      items: [
        { q: "Livrez-vous partout en Côte d'Ivoire ?", a: `Oui. À Abidjan, livraison ${fee(settings.delivery_fee_abidjan)} en 24 à 48 h ; à l’intérieur du pays, ${fee(settings.delivery_fee_interior)}, en 2 à 5 jours. Le retrait en boutique est gratuit.${settings.free_delivery_from > 0 ? ` Livraison offerte dès ${formatCurrency(settings.free_delivery_from)} d’achat.` : ''}` },
        { q: 'Puis-je suivre ma commande ?', a: 'Oui, depuis la page Suivi avec votre numéro BS-XXXX-XXXXXXXX. Vous recevez aussi un email à chaque étape.' },
        { q: 'Puis-je échanger ou retourner un article ?', a: 'Oui, sous 48 h après réception, si l’article n’a pas été porté et a toutes ses étiquettes. Contactez-nous sur WhatsApp pour organiser l’échange ou le retour.' },
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
        <h1 className="text-4xl md:text-6xl">Questions fréquentes</h1>
        <div className="mt-12 space-y-12">
          {sections.map((s, si) => (
            <div key={s.id} id={s.id} className="scroll-mt-28">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl">{s.title}</h2>
                {s.id === 'tailles' && (
                  <button onClick={() => setGuide(true)} className="text-xs uppercase tracking-widest text-gray-400 underline hover:text-gold">
                    Guide des tailles
                  </button>
                )}
              </div>
              <div className="divide-y divide-dark-600 border border-dark-600 bg-dark-800">
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
        <div className="mt-16 bg-dark-700 p-10 text-center">
          <h2 className="text-3xl">Une autre question ?</h2>
          <p className="mt-2 text-gray-500">Notre équipe vous répond avec plaisir.</p>
          <Link to="/contact" className="mt-6 inline-block">
            <Button>Nous contacter</Button>
          </Link>
        </div>
      </section>
      <SizeGuide open={guide} onClose={() => setGuide(false)} />
    </>
  )
}
