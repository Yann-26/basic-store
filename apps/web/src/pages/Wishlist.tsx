import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { HiHeart, HiXMark } from 'react-icons/hi2'
import { formatCurrency } from '@trs/shared'
import { useWishlist } from '../context/WishlistContext'
import { useSettings } from '../context/SettingsContext'
import Button from '../components/ui/Button'

export default function Wishlist() {
  const { items, remove } = useWishlist()
  const { settings } = useSettings()
  return (
    <>
      <Helmet>
        <title>{`Mes favoris | ${settings.store_name}`}</title>
      </Helmet>
      <section className="container-custom py-12">
        <p className="eyebrow mb-3">Favoris</p>
        <h1 className="text-4xl font-semibold md:text-5xl">Vos coups de cœur</h1>
        {items.length === 0 ? (
          <div className="mt-12 rounded-3xl border border-dashed border-white/10 py-24 text-center">
            <HiHeart className="mx-auto h-12 w-12 text-gold/40" />
            <p className="mt-6 font-display text-2xl">Aucun favori pour l'instant</p>
            <p className="mt-2 text-sm text-gray-500">Touchez le cœur d'une pièce pour la retrouver ici.</p>
            <Link to="/collection" className="mt-8 inline-block">
              <Button>Explorer la boutique</Button>
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {items.map((i) => (
              <div key={i.id} className="group relative">
                <Link to={`/product/${i.slug}`} className="block aspect-[3/4] overflow-hidden rounded-2xl bg-dark-700">
                  {i.image && <img src={i.image} alt={i.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />}
                </Link>
                <button onClick={() => remove(i.id)} className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white hover:bg-white hover:text-primary-black" aria-label={`Retirer ${i.name}`}>
                  <HiXMark className="h-4 w-4" />
                </button>
                <Link to={`/product/${i.slug}`} className="mt-3 block">
                  <p className="line-clamp-1 font-medium group-hover:text-gold">{i.name}</p>
                  <p className="text-gold">{formatCurrency(i.price)}</p>
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
