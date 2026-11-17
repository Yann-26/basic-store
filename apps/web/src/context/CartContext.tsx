import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import { MAX_QUANTITY_PER_LINE, computeOrderTotals } from '@trs/shared'
import { readJSON, writeJSON } from '../core/storage'
import { lineKey, type CartItem, type CartLineKey } from '../types/cart'

/**
 * Shopping cart. Totals shown here are indicative: the API recomputes every
 * price, the delivery fee and the stock from the database at checkout.
 */
interface State {
  items: CartItem[]
  isOpen: boolean
}

type Action =
  | { type: 'add'; item: Omit<CartItem, 'quantity'>; quantity: number }
  | { type: 'remove'; key: CartLineKey }
  | { type: 'quantity'; key: CartLineKey; quantity: number }
  | { type: 'clear' }
  | { type: 'open'; open: boolean }

/** At most what the shop has of that size (when known) and the per-line limit. */
const cap = (item: Pick<CartItem, 'maxQuantity'>, quantity: number) => Math.min(MAX_QUANTITY_PER_LINE, item.maxQuantity ?? MAX_QUANTITY_PER_LINE, quantity)

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'add': {
      const key = lineKey(action.item)
      const existing = state.items.find((i) => lineKey(i) === key)
      const items = existing
        ? state.items.map((i) => (lineKey(i) === key ? { ...i, ...action.item, quantity: cap(action.item, i.quantity + action.quantity) } : i))
        : [...state.items, { ...action.item, quantity: cap(action.item, action.quantity) }]
      return { items, isOpen: true }
    }
    case 'remove':
      return { ...state, items: state.items.filter((i) => lineKey(i) !== lineKey(action.key)) }
    case 'quantity':
      return {
        ...state,
        items:
          action.quantity <= 0
            ? state.items.filter((i) => lineKey(i) !== lineKey(action.key))
            : state.items.map((i) => (lineKey(i) === lineKey(action.key) ? { ...i, quantity: cap(i, action.quantity) } : i)),
      }
    case 'clear':
      return { ...state, items: [] }
    case 'open':
      return { ...state, isOpen: action.open }
  }
}

interface CartContextType {
  items: CartItem[]
  isOpen: boolean
  totalItems: number
  /** Sum of the lines, before delivery. */
  subtotal: number
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void
  removeItem: (key: CartLineKey) => void
  updateQuantity: (key: CartLineKey, quantity: number) => void
  clearCart: () => void
  openCart: () => void
  closeCart: () => void
  toggleCart: () => void
}

const CART_KEY = 'cart'
const CartContext = createContext<CartContextType | null>(null)

function isCartItem(value: unknown): value is CartItem {
  const v = value as CartItem
  return !!v && typeof v.id === 'string' && typeof v.price === 'number' && typeof v.size === 'string'
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    items: readJSON<unknown[]>(CART_KEY, []).filter(isCartItem),
    isOpen: false,
  }))

  useEffect(() => {
    writeJSON(CART_KEY, state.items)
  }, [state.items])

  const totals = useMemo(() => computeOrderTotals(state.items.map((i) => ({ unitPrice: i.price, quantity: i.quantity }))), [state.items])

  const addItem = useCallback((item: Omit<CartItem, 'quantity'>, quantity = 1) => {
    dispatch({ type: 'add', item, quantity })
    toast.success(`${item.name} ajouté au panier`)
  }, [])

  const value = useMemo<CartContextType>(
    () => ({
      items: state.items,
      isOpen: state.isOpen,
      totalItems: totals.itemCount,
      subtotal: totals.subtotal,
      addItem,
      removeItem: (key) => dispatch({ type: 'remove', key }),
      updateQuantity: (key, quantity) => dispatch({ type: 'quantity', key, quantity }),
      clearCart: () => dispatch({ type: 'clear' }),
      openCart: () => dispatch({ type: 'open', open: true }),
      closeCart: () => dispatch({ type: 'open', open: false }),
      toggleCart: () => dispatch({ type: 'open', open: !state.isOpen }),
    }),
    [state, totals, addItem],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart(): CartContextType {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used within CartProvider')
  return context
}
