import type { Gender, ProductCategoryId } from './catalog'
import type { OrderStatus, PaymentKind, PaymentMethod, PaymentStatus } from './orders'

export type ProductStatus = 'available' | 'unavailable' | 'limited'
export type BadgeVariant = 'new' | 'bestseller' | 'limited' | 'lowstock' | 'soldout' | 'sale'

export interface Brand {
  id: string
  name: string
  slug: string
  description?: string | null
  logo_url?: string | null
  banner_url?: string | null
  is_active: boolean
  sort_order: number
  created_at?: string
}

export interface Collection {
  id: string
  name: string
  slug: string
  description?: string | null
  brand_id: string | null
  image_url?: string | null
  banner_url?: string | null
  is_active: boolean
  sort_order: number
  created_at?: string
  brand?: Pick<Brand, 'id' | 'name' | 'slug'> | null
}

export interface ProductMedia {
  id: string
  product_id?: string
  file_path: string
  file_name?: string
  media_type: 'image' | 'video'
  is_main: boolean
  thumbnail_url?: string | null
  alt_text?: string | null
  sort_order?: number | null
  /** The colour this photo shows (one of the product's colours); null = every colour. */
  color?: string | null
}

export interface Product {
  id: string
  name: string
  slug: string
  description?: string | null
  price: number
  compare_at_price?: number | null
  category: ProductCategoryId
  subcategory?: string | null
  gender?: Gender | null
  status: ProductStatus
  stock: number
  sizes: string[]
  colors: string[]
  materials?: string | null
  features: string[]
  tags?: string[]
  is_featured?: boolean
  is_active: boolean
  release_date?: string | null
  brand_id?: string | null
  collection_id?: string | null
  brand?: Pick<Brand, 'id' | 'name' | 'slug'> | null
  collection?: Pick<Collection, 'id' | 'name' | 'slug'> | null
  product_media?: ProductMedia[]
  /** Stock per size (e.g. { "M": 4, "L": 0 }); a product without sizes uses `stock`. */
  size_stock?: Record<string, number>
  /** Alert threshold: the back-office flags the product when its stock falls to it or below. */
  low_stock_threshold?: number
  created_at?: string
  updated_at?: string
}

export interface ProductListQuery {
  category?: string
  subcategory?: string
  gender?: string
  brand?: string
  collection?: string
  search?: string
  minPrice?: number
  maxPrice?: number
  size?: string
  featured?: boolean
  sort?: string
  /** Seed of the `shuffle` sort: keep it for every page of the same listing. */
  seed?: number
  limit?: number
  offset?: number
}

export interface Customer {
  id: string
  first_name: string
  last_name: string
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  city?: string | null
  address?: string | null
  notes?: string | null
  total_orders?: number
  total_spent?: number
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

export interface OrderItem {
  id?: string
  order_id?: string
  product_id: string | null
  product_name: string
  product_price: number
  size: string | null
  color?: string | null
  quantity: number
}

export interface OrderTrackingEntry {
  id: string
  order_id?: string
  status: OrderStatus
  notes?: string | null
  location?: string | null
  created_at: string
}

export interface Order {
  id: string
  preorder_number: string
  customer_id: string
  /** Account that placed the order (null for orders placed before accounts were required). */
  user_id?: string | null
  status: OrderStatus
  total_price: number
  deposit_amount: number
  deposit_percentage: number
  remaining_amount: number
  /** Basket before discount (null on orders placed before promo codes). */
  subtotal_price?: number | null
  /** Taken off by a promo or referral code. */
  discount_amount?: number
  promo_code?: string | null
  referred_by_user_id?: string | null
  /** Money really received (online deposit + online or hand-recorded balance). */
  amount_paid?: number
  fully_paid_at?: string | null
  payment_method: string
  payment_status: string
  customer_notes?: string | null
  admin_notes?: string | null
  delivery_address?: string | null
  delivery_city?: string | null
  /** abidjan | interior | pickup */
  delivery_zone?: string | null
  delivery_fee?: number
  /** True while the order holds its units (given back when cancelled or returned). */
  stock_reserved?: boolean
  estimated_delivery?: string | null
  returned_at?: string | null
  created_at: string
  updated_at?: string
  customers?: Partial<Customer> | null
  order_items?: OrderItem[]
  order_tracking?: OrderTrackingEntry[]
  /** Successful and pending payments of the order (detail views only). */
  payments?: OrderPayment[]
}

/** A payment as an order's detail shows it. */
export interface OrderPayment {
  id: string
  reference: string
  amount: number
  status: PaymentStatus
  kind: PaymentKind
  method: PaymentMethod
  channel?: string | null
  note?: string | null
  /** Wave: when the customer said it was paid, and the Wave number they used. */
  metadata?: { declared_at?: string; payer_phone?: string | null; [key: string]: unknown } | null
  paid_at?: string | null
  created_at: string
}

/** A Wave payment the customer says is done, waiting for the shop to confirm it. */
export const isWaveAwaitingCheck = (p: { status: PaymentStatus; method?: PaymentMethod; metadata?: OrderPayment['metadata'] }) =>
  p.status === 'pending' && p.method === 'wave' && typeof p.metadata?.declared_at === 'string'

export interface Payment {
  id: string
  order_id: string | null
  reference: string
  amount: number
  currency?: string
  status: PaymentStatus
  kind?: PaymentKind
  method?: PaymentMethod
  note?: string | null
  channel?: string | null
  /** Wave: when the customer said it was paid, and the Wave number they used. */
  metadata?: { declared_at?: string; payer_phone?: string | null; [key: string]: unknown } | null
  customer_email: string
  paid_at?: string | null
  created_at: string
  orders?: {
    id: string
    preorder_number: string
    total_price: number
    customers?: { first_name: string; last_name: string } | null
  } | null
}

export interface SessionUser {
  id: string
  email: string
  first_name: string
  last_name: string
  phone?: string | null
  role: 'customer' | 'admin'
  /** Confirmed through the link sent by email (needed to place an order). */
  email_verified?: boolean
}

/** A new session as the API use-cases produce it. */
export interface AuthResponse {
  user: SessionUser
  token: string
  expiresAt: string
}

/**
 * What the browser receives: the token itself only travels in the HttpOnly
 * session cookie, never in script-readable JSON.
 */
export type ClientSession<T extends AuthResponse = AuthResponse> = Omit<T, 'token'>

/**
 * Admin sign-in is two steps: the password gives a short-lived `challenge`,
 * then a code from the authenticator app gives the session. On first sign-in
 * the admin sets 2FA up (`mfa_setup`: secret + otpauth URL for the QR code).
 */
export type AdminLoginResult =
  | { status: 'mfa_required'; challenge: string }
  | { status: 'mfa_setup'; challenge: string; secret: string; otpauthUrl: string }

export interface TwoFactorVerifyResult extends AuthResponse {
  /** Only right after setup or regeneration: shown once, never stored in clear. */
  recoveryCodes?: string[]
  /** After signing in with a recovery code. */
  recoveryCodesLeft?: number
}

/** A user account as the back-office sees it (never the password or 2FA secrets). */
export interface AdminUser {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  role: 'customer' | 'admin'
  is_active: boolean
  two_factor_enabled: boolean
  last_login: string | null
  created_at: string
  /** From the matching customer record (same email), when the user has ordered. */
  total_orders: number
  total_spent: number
}

export interface AdminUserQuery {
  search?: string
  role?: 'customer' | 'admin'
  status?: 'active' | 'suspended'
  page?: number
  limit?: number
}

export interface AdminUserStats {
  total: number
  admins: number
  suspended: number
}

export interface TwoFactorStatus {
  enabled: boolean
  enabledAt: string | null
  recoveryCodesLeft: number
}

// ---------------------------------------------------------------------------
// Admin analytics
// ---------------------------------------------------------------------------

export interface KpiValue {
  value: number
  previous: number
  /** Percent change vs previous period, clamped to [-100, 999]. */
  trend: number
}

export interface DashboardAnalytics {
  range: { from: string; to: string; days: number }
  kpis: {
    /** Money really received in the period (deposits + balances, online or by hand), by payment date. */
    revenue: KpiValue
    /** Value of the orders placed in the period (what customers committed to, not what they paid). */
    orderedValue: KpiValue
    orders: KpiValue
    customers: KpiValue
    averageOrderValue: KpiValue
    depositsCollected: KpiValue
  }
  totals: {
    orders: number
    customers: number
    products: number
    activeProducts: number
    pendingOrders: number
    inProgressOrders: number
    deliveredOrders: number
    cancelledOrders: number
    /** All money really received. */
    lifetimeRevenue: number
    /** Value of all non-cancelled orders. */
    lifetimeOrdered: number
    /** Still to be received on non-cancelled orders (delivered ones included). */
    outstandingBalance: number
    /** Delivered orders whose balance has not been received. */
    unpaidDelivered: { count: number; amount: number }
    /** Wave payments the customer says are done, waiting for the shop to confirm them. */
    wavePaymentsToCheck: { count: number; amount: number }
  }
  salesSeries: { date: string; revenue: number; orders: number }[]
  ordersByStatus: { status: OrderStatus; count: number }[]
  salesByCategory: { category: string; revenue: number; units: number }[]
  topProducts: { product_id: string | null; name: string; units: number; revenue: number }[]
  lowStock: { id: string; name: string; slug: string; stock: number; category: string }[]
  recentOrders: {
    id: string
    preorder_number: string
    customer_name: string
    product_name: string
    total_price: number
    deposit_amount: number
    amount_paid: number
    status: OrderStatus
    payment_status: string
    created_at: string
  }[]
  paymentMix: { channel: string; count: number; amount: number }[]
}

/** Sign-in with a social account ("Continuer avec Google", …). */
export const SOCIAL_PROVIDERS = ['google', 'facebook', 'tiktok'] as const
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number]

export const SOCIAL_PROVIDER_LABELS: Record<SocialProvider, string> = {
  google: 'Google',
  facebook: 'Facebook',
  tiktok: 'TikTok',
}

/** Social accounts linked to the signed-in user ("Mon compte" → Sécurité). */
export interface LinkedAccounts {
  /** False for accounts created with a social login that never set a password. */
  passwordSet: boolean
  providers: {
    provider: SocialProvider
    /** Configured on the server (keys present). */
    enabled: boolean
    linked: boolean
    email: string | null
    name: string | null
    linkedAt: string | null
  }[]
}
