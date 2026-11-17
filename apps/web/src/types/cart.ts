export interface CartItem {
  id: string
  slug: string
  name: string
  price: number
  image: string
  size: string
  color?: string
  category?: string
  quantity: number
}

export type CartLineKey = Pick<CartItem, 'id' | 'size' | 'color'>

export function lineKey(item: CartLineKey): string {
  return `${item.id}::${item.size}::${item.color ?? ''}`
}

export interface CheckoutCustomer {
  firstName: string
  lastName: string
  phone: string
  whatsapp: string
  email: string
  city: string
  address: string
  notes: string
}
