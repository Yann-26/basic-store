import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { HiXMark, HiMinus, HiPlus, HiOutlineTrash, HiOutlineShoppingBag, HiShieldCheck } from 'react-icons/hi2'
import { formatCurrency, ONE_SIZE, sizeLabelFor } from '@trs/shared'
import { usePreorder } from '../../context/PreorderContext'
import { lineKey } from '../../types/cart'
import Button from '../ui/Button'

export default function PreorderSidebar() {
  const { items, isOpen, closePreorder, removeItem, updateQuantity, totalPrice, totalItems, totalDeposit, totalRemaining, depositPercentage, clearPreorder } =
    usePreorder()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closePreorder()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, closePreorder])

  const go = (path: string) => {
    closePreorder()
    navigate(path)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closePreorder} className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Ma sélection"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-gold/20 bg-dark-900"
          >
            <div className="flex items-center justify-between border-b border-white/5 p-6">
              <div>
                <h2 className="font-display text-2xl">Ma sélection</h2>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                  {totalItems} article{totalItems > 1 ? 's' : ''} · précommande
                </p>
              </div>
              <button onClick={closePreorder} className="rounded-full p-2 hover:bg-white/5" aria-label="Fermer">
                <HiXMark className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-gold/30">
                    <HiOutlineShoppingBag className="h-9 w-9 text-gold" />
                  </div>
                  <p className="font-display text-2xl">Votre sélection est vide</p>
                  <p className="mb-8 mt-2 text-sm text-gray-500">Vêtements, chaussures, sacs, bijoux… trouvez la pièce qui vous élève.</p>
                  <Button onClick={() => go('/collection')}>Découvrir la boutique</Button>
                </div>
              ) : (
                <ul className="space-y-5">
                  <AnimatePresence initial={false}>
                    {items.map((item) => (
                      <motion.li key={lineKey(item)} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex gap-4">
                        <Link to={`/product/${item.slug}`} onClick={closePreorder} className="h-28 w-22 flex-shrink-0 overflow-hidden rounded-xl bg-dark-700">
                          {item.image && <img src={item.image} alt={item.name} className="h-full w-full object-cover" />}
                        </Link>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-start justify-between gap-2">
                            <Link to={`/product/${item.slug}`} onClick={closePreorder} className="line-clamp-2 text-sm font-medium hover:text-gold">
                              {item.name}
                            </Link>
                            <button onClick={() => removeItem(item)} className="p-1 text-gray-500 hover:text-red-400" aria-label={`Retirer ${item.name}`}>
                              <HiOutlineTrash className="h-4 w-4" />
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            {item.size !== ONE_SIZE ? `${sizeLabelFor(item.category)} ${item.size}` : 'Taille unique'}
                            {item.color ? ` · ${item.color}` : ''}
                          </p>
                          <div className="mt-auto flex items-center justify-between pt-2">
                            <div className="flex items-center rounded-full border border-white/10">
                              <button onClick={() => updateQuantity(item, item.quantity - 1)} className="p-2 text-gray-400 hover:text-white" aria-label="Diminuer">
                                <HiMinus className="h-3 w-3" />
                              </button>
                              <span className="w-6 text-center text-sm">{item.quantity}</span>
                              <button onClick={() => updateQuantity(item, item.quantity + 1)} className="p-2 text-gray-400 hover:text-white" aria-label="Augmenter">
                                <HiPlus className="h-3 w-3" />
                              </button>
                            </div>
                            <span className="text-sm font-semibold text-gold">{formatCurrency(item.price * item.quantity)}</span>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {items.length > 0 && (
              <div className="space-y-4 border-t border-white/5 p-6">
                <dl className="space-y-2 text-sm">
                  {totalRemaining > 0 ? (
                    <>
                      <div className="flex justify-between text-gray-400">
                        <dt>Total</dt>
                        <dd className="text-white">{formatCurrency(totalPrice)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-400">Acompte à régler ({depositPercentage} %)</dt>
                        <dd className="font-display text-xl text-gold">{formatCurrency(totalDeposit)}</dd>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <dt>Solde avant la livraison</dt>
                        <dd>{formatCurrency(totalRemaining)}</dd>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <dt className="text-gray-400">Total à régler</dt>
                      <dd className="font-display text-xl text-gold">{formatCurrency(totalPrice)}</dd>
                    </div>
                  )}
                </dl>
                <Button className="w-full" size="lg" onClick={() => go('/preorder/checkout')}>
                  Finaliser la précommande
                </Button>
                <div className="flex items-center justify-between text-xs">
                  <button onClick={() => go('/preorder')} className="text-gray-400 underline-offset-4 hover:text-white hover:underline">
                    Voir le détail
                  </button>
                  <button onClick={clearPreorder} className="text-gray-500 hover:text-red-400">
                    Vider
                  </button>
                </div>
                <p className="flex items-center justify-center gap-2 text-[11px] text-gray-500">
                  <HiShieldCheck className="h-4 w-4 text-gold" /> Paiement sécurisé · Mobile Money & carte
                </p>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
