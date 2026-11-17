import { motion } from 'framer-motion'
import { HiOutlineShoppingBag } from 'react-icons/hi2'
import { usePreorder } from '../../context/PreorderContext'

export default function CartIcon() {
  const { totalItems, togglePreorder } = usePreorder()
  return (
    <button
      onClick={togglePreorder}
      className="relative rounded-full p-2 text-white transition-opacity hover:opacity-60"
      aria-label={`Ma sélection (${totalItems} article${totalItems > 1 ? 's' : ''})`}
    >
      <HiOutlineShoppingBag className="h-5 w-5" />
      {totalItems > 0 && (
        <motion.span
          key={totalItems}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-primary-black"
        >
          {totalItems > 99 ? '99+' : totalItems}
        </motion.span>
      )}
    </button>
  )
}
