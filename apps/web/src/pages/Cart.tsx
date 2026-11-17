import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { HiMinus, HiPlus, HiOutlineTrash, HiArrowRight } from 'react-icons/hi2'
import { formatCurrency, ONE_SIZE, sizeLabelFor } from '@trs/shared'
import { useCart } from '../context/CartContext'
import { useSettings } from '../context/SettingsContext'
import { lineKey } from '../types/cart'
import Button from '../components/ui/Button'

export default function Cart() {
  const { items, updateQuantity, removeItem, subtotal, totalItems } = useCart()
  const { settings } = useSettings()

  return (
    <>
      <Helmet>
        <title>{`Mon panier | ${settings.store_name}`}</title>
      </Helmet>
      <section className="container-custom max-w-6xl py-12">
        <h1 className="text-4xl md:text-5xl">Mon panier</h1>
        <p className="mt-2 text-gray-400">
          {totalItems} article{totalItems > 1 ? 's' : ''}
        </p>

        {items.length === 0 ? (
          <div className="mt-12 rounded-3xl border border-dashed border-white/10 py-24 text-center">
            <p className="font-display text-3xl">Votre panier est vide</p>
            <Link to="/collection" className="mt-8 inline-block">
              <Button>Découvrir la boutique</Button>
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
            <ul className="divide-y divide-white/5 border-y border-white/5">
              {items.map((i) => (
                <li key={lineKey(i)} className="flex gap-5 py-6">
                  <Link to={`/product/${i.slug}`} className="h-36 w-28 flex-shrink-0 overflow-hidden rounded-2xl bg-dark-700">
                    {i.image && <img src={i.image} alt={i.name} className="h-full w-full object-cover" />}
                  </Link>
                  <div className="flex flex-1 flex-col">
                    <div className="flex justify-between gap-3">
                      <div>
                        <Link to={`/product/${i.slug}`} className="text-lg font-medium hover:text-gold">
                          {i.name}
                        </Link>
                        <p className="mt-1 text-sm text-gray-500">
                          {i.size !== ONE_SIZE ? `${sizeLabelFor(i.category)} ${i.size}` : 'Taille unique'}
                          {i.color ? ` · ${i.color}` : ''}
                        </p>
                      </div>
                      <p className="font-semibold text-gold">{formatCurrency(i.price * i.quantity)}</p>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-4">
                      <div className="flex items-center rounded-full border border-white/10">
                        <button onClick={() => updateQuantity(i, i.quantity - 1)} className="p-3 text-gray-400 hover:text-white" aria-label="Diminuer">
                          <HiMinus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center">{i.quantity}</span>
                        <button onClick={() => updateQuantity(i, i.quantity + 1)} disabled={i.maxQuantity !== undefined && i.quantity >= i.maxQuantity} className="p-3 text-gray-400 hover:text-white disabled:opacity-30" aria-label="Augmenter">
                          <HiPlus className="h-3 w-3" />
                        </button>
                      </div>
                      <button onClick={() => removeItem(i)} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-red-400">
                        <HiOutlineTrash className="h-4 w-4" /> Retirer
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <aside className="h-fit border border-dark-600 bg-dark-800 p-6 lg:sticky lg:top-28">
              <dl className="space-y-3 text-sm">
                <div className="flex items-baseline justify-between">
                  <dt className="text-xs uppercase tracking-[0.2em]">Sous-total</dt>
                  <dd className="font-display text-3xl">{formatCurrency(subtotal)}</dd>
                </div>
                <p className="text-xs leading-relaxed text-gray-500">
                  Livraison à Abidjan {formatCurrency(settings.delivery_fee_abidjan)} · intérieur du pays {formatCurrency(settings.delivery_fee_interior)} · retrait gratuit en boutique.
                </p>
              </dl>
              <Link to="/commande" className="mt-6 block">
                <Button size="lg" className="w-full" icon={HiArrowRight} iconPosition="right">
                  Commander
                </Button>
              </Link>
              <Link to="/collection" className="mt-4 block text-center text-sm text-gray-400 hover:text-gold">
                Continuer mes achats
              </Link>
            </aside>
          </div>
        )}
      </section>
    </>
  )
}
