import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { PRODUCT_CATEGORIES } from '@trs/shared'
import { useSettings } from '../context/SettingsContext'
import HowItWorks from '../components/home/HowItWorks'
import WhyUs from '../components/home/WhyUs'
import FounderWord from '../components/home/FounderWord'
import Button from '../components/ui/Button'

export default function About() {
  const { settings } = useSettings()
  return (
    <>
      <Helmet>
        <title>{`Notre histoire | ${settings.store_name}`}</title>
      </Helmet>
      <section className="py-16 md:py-28">
        <div className="container-custom max-w-4xl">
          <p className="eyebrow mb-4">Notre histoire</p>
          <h1 className="campaign-title text-5xl md:text-8xl">L'élégance, sobrement.</h1>
          <p className="mt-8 text-lg leading-relaxed text-gray-300">
            {settings.store_name} est une marque de vêtements ivoirienne, née à Abidjan. Des pièces simples et bien coupées, des couleurs unies, un logo discret : ce que l'on porte
            au bureau, en sortie, à un rendez-vous ou à un événement. Rendre chaque client présentable, élégant et respecté, c'est notre mission.
          </p>
          <p className="mt-6 text-lg leading-relaxed text-gray-400">
            Nos pièces sortent en séries limitées, annoncées à l'avance : les « drops ». Vous réglez en ligne, nous fabriquons à Abidjan avec soin, nous contrôlons chaque pièce
            puis nous vous la livrons.
          </p>
        </div>
      </section>

      <FounderWord />
      <section className="bg-ivory py-20 text-primary-black">
        <div className="container-custom grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {[
            { t: 'Élégance', d: 'Des coupes nettes, des matières qui tombent bien.' },
            { t: 'Sobriété', d: 'Des couleurs unies, un logo discret, aucun excès.' },
            { t: 'Héritage africain', d: 'Des détails, des finitions et des tissus qui rappellent nos origines, sans folklore.' },
            { t: 'Qualité', d: 'Un coton épais, des coutures solides, des pièces qui durent.' },
          ].map((v, i) => (
            <div key={v.t}>
              <p className="mb-4 text-xs tabular-nums opacity-60">{String(i + 1).padStart(2, '0')}</p>
              <h2 className="campaign-title text-3xl">{v.t}</h2>
              <p className="mt-3 text-neutral-600">{v.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-white/5 py-20">
        <div className="container-custom max-w-3xl text-center">
          <p className="eyebrow mb-4">Bientôt</p>
          <h2 className="text-3xl font-medium md:text-4xl">Du quotidien au jour du mariage</h2>
          <p className="mt-5 leading-relaxed text-gray-400">
            Après le prêt-à-porter, {settings.store_name} habillera vos grandes occasions : costumes et tenues de cérémonie sur mesure, puis l'habillage complet de mariages, d'événements,
            de clips et de films. Un projet en tête ? Parlons-en dès maintenant.
          </p>
          <Link to="/contact" className="mt-8 inline-block text-xs font-semibold uppercase tracking-[0.25em] text-gold underline-offset-8 hover:underline">
            Nous écrire
          </Link>
        </div>
      </section>

      <WhyUs />
      <HowItWorks />

      <section className="border-t border-white/5 py-20 text-center">
        <div className="container-custom">
          <h2 className="text-3xl md:text-5xl">Trouvez la pièce qui vous élève.</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {PRODUCT_CATEGORIES.map((c) => (
              <Link key={c.id} to={`/collection?category=${c.id}`} className="rounded-full border border-white/10 px-5 py-2 text-sm hover:border-gold hover:text-gold">
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
