import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import { MAX_QUANTITY_PER_LINE, computeOrderTotals } from '@trs/shared'
import { readJSON, writeJSON } from '../core/storage'
import { lineKey, type CartItem, type CartLineKey } from '../types/cart'
import { useSettings } from './SettingsContext'

/**
 * Pre-order bag. Totals shown here are indicative: the API recomputes
 * every price and the deposit from the database at checkout.
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

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'add': {
      const key = lineKey(action.item)
      const existing = state.items.find((i) => lineKey(i) === key)
      const items = existing
        ? state.items.map((i) => (lineKey(i) === key ? { ...i, quantity: Math.min(MAX_QUANTITY_PER_LINE, i.quantity + action.quantity) } : i))
        : [...state.items, { ...action.item, quantity: Math.min(MAX_QUANTITY_PER_LINE, action.quantity) }]
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
            : state.items.map((i) =>
                lineKey(i) === lineKey(action.key) ? { ...i, quantity: Math.min(MAX_QUANTITY_PER_LINE, action.quantity) } : i,
              ),
      }
    case 'clear':
      return { ...state, items: [] }
    case 'open':
      return { ...state, isOpen: action.open }
  }
}

interface PreorderContextType {
  items: CartItem[]
  isOpen: boolean
  totalItems: number
  totalPrice: number
  totalDeposit: number
  totalRemaining: number
  depositPercentage: number
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void
  removeItem: (key: CartLineKey) => void
  updateQuantity: (key: CartLineKey, quantity: number) => void
  clearPreorder: () => void
  openPreorder: () => void
  closePreorder: () => void
  togglePreorder: () => void
}

const CART_KEY = 'cart'
const PreorderContext = createContext<PreorderContextType | null>(null)

function isCartItem(value: unknown): value is CartItem {
  const v = value as CartItem
  return !!v && typeof v.id === 'string' && typeof v.price === 'number' && typeof v.size === 'string'
}

export function PreorderProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    items: readJSON<unknown[]>(CART_KEY, []).filter(isCartItem),
    isOpen: false,
  }))
  const { settings } = useSettings()
  const depositPercentage = settings.deposit_percentage // deposit now, balance before delivery (set in the back-office)

  useEffect(() => {
    writeJSON(CART_KEY, state.items)
  }, [state.items])

  const totals = useMemo(
    () => computeOrderTotals(state.items.map((i) => ({ unitPrice: i.price, quantity: i.quantity })), depositPercentage),
    [state.items, depositPercentage],
  )

  const addItem = useCallback((item: Omit<CartItem, 'quantity'>, quantity = 1) => {
    dispatch({ type: 'add', item, quantity })
    toast.success(`${item.name} ajouté à votre sélection`, { icon: '✨' })
  }, [])

  const value = useMemo<PreorderContextType>(
    () => ({
      items: state.items,
      isOpen: state.isOpen,
      totalItems: totals.itemCount,
      totalPrice: totals.total,
      totalDeposit: totals.deposit,
      totalRemaining: totals.remaining,
      depositPercentage,
      addItem,
      removeItem: (key) => dispatch({ type: 'remove', key }),
      updateQuantity: (key, quantity) => dispatch({ type: 'quantity', key, quantity }),
      clearPreorder: () => dispatch({ type: 'clear' }),
      openPreorder: () => dispatch({ type: 'open', open: true }),
      closePreorder: () => dispatch({ type: 'open', open: false }),
      togglePreorder: () => dispatch({ type: 'open', open: !state.isOpen }),
    }),
    [state, totals, depositPercentage, addItem],
  )

  return <PreorderContext.Provider value={value}>{children}</PreorderContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePreorder(): PreorderContextType {
  const context = useContext(PreorderContext)
  if (!context) throw new Error('usePreorder must be used within PreorderProvider')
  return context
}
