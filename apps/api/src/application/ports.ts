/**
 * Ports: the contracts the application layer depends on.
 * Infrastructure adapters (Supabase, Paystack, Brevo, Google…) implement them,
 * which keeps use-cases framework-agnostic and unit-testable with fakes.
 */
import type {
  AudienceStats,
  Brand,
  Collection,
  AdminUser,
  AdminUserQuery,
  AdminUserStats,
  Customer,
  Order,
  OrderItem,
  OrderStatus,
  OrderTrackingEntry,
  Payment,
  PaymentKind,
  PaymentMethod,
  PaymentStatus,
  Product,
  ProductListQuery,
  ProductMedia,
  SessionUser,
  SocialProvider,
  NewsletterAudience,
  NewsletterCampaign,
  NewsletterStatus,
  PromoCode,
  StockMovement,
  ManualStockReason,
  ProductReview,
  ReviewStatus,
} from '@trs/shared'

// ----------------------------------------------------------------- catalogue

export type ProductWrite = Omit<
  Product,
  'id' | 'brand' | 'collection' | 'product_media' | 'created_at' | 'updated_at'
>

export interface ProductRepository {
  list(query: ProductListQuery & { includeInactive?: boolean }): Promise<{ items: Product[]; total: number }>
  findByIdOrSlug(idOrSlug: string, opts?: { includeInactive?: boolean }): Promise<Product | null>
  findManyByIds(ids: string[]): Promise<Product[]>
  slugExists(slug: string, exceptId?: string): Promise<boolean>
  create(data: ProductWrite): Promise<Product>
  update(id: string, data: Partial<ProductWrite>): Promise<Product>
  delete(id: string): Promise<void>
  hasOrders(id: string): Promise<boolean>
  countByBrand(brandId: string): Promise<number>
  countByCollection(collectionId: string): Promise<number>
  findMedia(mediaId: string): Promise<ProductMedia | null>
  listMedia(productId: string): Promise<ProductMedia[]>
  addMedia(media: Omit<ProductMedia, 'id'> & { product_id: string; file_size?: number; mime_type?: string }): Promise<ProductMedia>
  deleteMedia(mediaId: string): Promise<void>
  setMainMedia(productId: string, mediaId: string): Promise<void>
  setMediaColor(mediaId: string, color: string | null): Promise<void>
}

export interface BrandRepository {
  list(opts?: { activeOnly?: boolean }): Promise<Brand[]>
  findById(id: string): Promise<Brand | null>
  findBySlug(slug: string): Promise<Brand | null>
  create(data: Omit<Brand, 'id' | 'created_at'>): Promise<Brand>
  update(id: string, data: Partial<Omit<Brand, 'id' | 'created_at'>>): Promise<Brand>
  delete(id: string): Promise<void>
}

export interface CollectionRepository {
  list(opts?: { activeOnly?: boolean; brandId?: string }): Promise<Collection[]>
  findById(id: string): Promise<Collection | null>
  findBySlug(slug: string): Promise<Collection | null>
  countByBrand(brandId: string): Promise<number>
  create(data: Omit<Collection, 'id' | 'created_at' | 'brand'>): Promise<Collection>
  update(id: string, data: Partial<Omit<Collection, 'id' | 'created_at' | 'brand'>>): Promise<Collection>
  delete(id: string): Promise<void>
}

// ------------------------------------------------------------------ commerce

export type CustomerWrite = Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'total_orders' | 'total_spent'>

export interface CustomerRepository {
  list(opts: { search?: string }): Promise<Customer[]>
  findById(id: string): Promise<Customer | null>
  findByPhone(phone: string): Promise<Customer | null>
  findByEmail(email: string): Promise<Customer | null>
  create(data: CustomerWrite): Promise<Customer>
  update(id: string, data: Partial<CustomerWrite>): Promise<Customer>
  count(opts?: { from?: string; to?: string }): Promise<number>
}

export interface NewOrder {
  preorder_number: string
  customer_id: string
  status: OrderStatus
  total_price: number
  deposit_amount: number
  deposit_percentage: number
  remaining_amount: number
  payment_method: string
  payment_status: string
  delivery_address: string
  delivery_city: string
  customer_notes: string
  estimated_delivery: string
  /** Account that placed the order. */
  user_id?: string | null
  /** Basket before discount and delivery; total_price is what is paid. */
  subtotal_price?: number
  delivery_zone?: string
  delivery_fee?: number
  discount_amount?: number
  promo_code?: string | null
  /** Account whose referral code was used. */
  referred_by_user_id?: string | null
}

export interface OrderListQuery {
  status?: OrderStatus
  search?: string
  customerId?: string
  page: number
  limit: number
}

export interface OrderRepository {
  create(order: NewOrder, items: Omit<OrderItem, 'id' | 'order_id'>[]): Promise<Order>
  /** Orders of an account: placed while signed in, or earlier with the same (verified) email. */
  listForAccount(userId: string, verifiedEmail: string | null): Promise<Order[]>
  numberExists(preorderNumber: string): Promise<boolean>
  findById(id: string): Promise<Order | null>
  findByNumber(preorderNumber: string): Promise<Order | null>
  list(query: OrderListQuery): Promise<{ items: Order[]; total: number }>
  update(id: string, patch: Partial<Order>): Promise<Order>
  delete(id: string): Promise<void>
  addTracking(entry: { order_id: string; status: OrderStatus; notes?: string | null; location?: string | null }): Promise<void>
  history(orderId: string): Promise<OrderTrackingEntry[]>
  /** Lightweight projection used for analytics (orders + items since a date). */
  listForAnalytics(from?: string): Promise<Order[]>
  /**
   * Adds money received (negative: refunded) to the order in one atomic step;
   * the payment status follows from the new amount paid.
   */
  applyPayment(orderId: string, amount: number): Promise<{ amount_paid: number; total_price: number; payment_status: string } | null>
  /**
   * Takes the stock of a freshly written order, all lines or none (atomic, once per order).
   * Throws OutOfStockError when a line cannot be served.
   */
  reserveStock(orderId: string): Promise<void>
  /** Online-payment orders still pending and unpaid, placed before `before`. */
  listUnpaidOnline(before: string, limit: number): Promise<Order[]>
  /** Puts an order's stock back (cancelled or returned); false when it was already given back. */
  releaseStock(orderId: string, reason: 'cancel' | 'return'): Promise<boolean>
}

// --------------------------------------------------------------------- stock

export interface StockRepository {
  /** Moves one size of a product by hand; returns the new quantity of that size. Throws OutOfStockError below 0. */
  adjust(input: { productId: string; size: string | null; delta: number; reason: ManualStockReason; note?: string | null; adminId: string }): Promise<number>
  movements(opts: { productId?: string; page: number; limit: number }): Promise<{ items: StockMovement[]; total: number }>
  /** Active products, lowest stock first (stock page, low-stock alerts). */
  overview(opts: { search?: string; lowOnly?: boolean; page: number; limit: number }): Promise<{ items: Product[]; total: number }>
}

export interface PaymentRepository {
  create(payment: {
    order_id: string | null
    reference: string
    amount: number
    customer_email: string
    customer_id: string | null
    metadata: Record<string, unknown>
    kind: PaymentKind
    /** Created pending (an online Paystack payment) unless `received`. */
    method?: PaymentMethod
    /** Money already received by hand: recorded directly as successful. */
    received?: { channel: string; paid_at: string; note: string | null; recorded_by: string }
  }): Promise<void>
  findByReference(reference: string): Promise<Payment | null>
  /** Latest pending payment of an order created after `since` (checkout reuse). */
  findOpenForOrder(orderId: string, since: string): Promise<(Payment & { metadata?: Record<string, unknown> | null }) | null>
  update(reference: string, patch: Partial<Payment> & { error_message?: string; metadata?: Record<string, unknown> }): Promise<void>
  /**
   * State-machine step: applies `patch` only while the status is one of `from`
   * (a conditional UPDATE). Returns true for the single caller that won.
   */
  transition(
    reference: string,
    from: PaymentStatus[],
    patch: Partial<Payment> & { status: PaymentStatus; error_message?: string; recorded_by?: string },
  ): Promise<boolean>
  list(opts: { status?: PaymentStatus; orderId?: string; page: number; limit: number }): Promise<{ items: Payment[]; total: number }>
  listAll(from?: string): Promise<Payment[]>
}

export type PromoCodeWrite = Omit<PromoCode, 'id' | 'uses' | 'created_at'> & { source_order_id?: string | null }

export interface ReferralStats {
  referrer: { id: string; email: string; first_name: string; last_name: string }
  code: string | null
  orders: number
  delivered: number
  rewards: number
}

export interface PromoRepository {
  list(opts: { source?: PromoCode['source']; search?: string }): Promise<PromoCode[]>
  findById(id: string): Promise<PromoCode | null>
  findByCode(code: string): Promise<PromoCode | null>
  codeExists(code: string, exceptId?: string): Promise<boolean>
  create(data: PromoCodeWrite): Promise<PromoCode>
  update(id: string, data: Partial<PromoCodeWrite>): Promise<PromoCode>
  delete(id: string): Promise<void>
  /** Uses of the code by an account (cancelled orders excluded). */
  usesByUser(codeId: string, userId: string): Promise<number>
  /** Atomically records the use (false when the code can no longer be used). */
  redeem(p: { codeId: string; orderId: string; userId: string | null; amount: number }): Promise<boolean>
  /** Gives the use back (order cancelled). */
  release(orderId: string): Promise<void>
  referralCodeOf(userId: string): Promise<PromoCode | null>
  /** The reward codes an account received. */
  rewardsOf(userId: string): Promise<PromoCode[]>
  /** Whether a reward was already given for this order. */
  rewardExistsForOrder(orderId: string): Promise<boolean>
  /** Orders placed with an account's referral code (count, delivered). */
  referredOrders(userId: string): Promise<{ orders: number; delivered: number }>
  referralStats(): Promise<ReferralStats[]>
}

export type ReviewWrite = Pick<ProductReview, 'product_id' | 'user_id' | 'order_id' | 'author_name' | 'rating' | 'title' | 'body' | 'photo_url' | 'status'>

export interface ReviewRepository {
  /** Approved reviews of a piece, newest first. */
  listApproved(productId: string, limit: number): Promise<ProductReview[]>
  /** Ratings of every approved review of a piece (for the summary). */
  approvedRatings(productId: string): Promise<number[]>
  list(opts: { status?: ReviewStatus; page: number; limit: number }): Promise<{ items: ProductReview[]; total: number }>
  findById(id: string): Promise<ProductReview | null>
  findByUserAndProduct(userId: string, productId: string): Promise<ProductReview | null>
  create(data: ReviewWrite): Promise<ProductReview>
  update(id: string, patch: Partial<Pick<ProductReview, 'status' | 'admin_reply' | 'rating' | 'title' | 'body' | 'photo_url'>>): Promise<ProductReview>
  delete(id: string): Promise<void>
  countPending(): Promise<number>
}

// ------------------------------------------------------------------- others

export interface SettingsRepository {
  getAll(): Promise<Record<string, unknown>>
  upsertMany(entries: { key: string; value: unknown }[]): Promise<void>
}

export interface AccountState {
  role: 'customer' | 'admin'
  isActive: boolean
  /** Session tokens issued before this instant (ISO date) are no longer accepted. */
  tokensValidAfter: string
  emailVerified: boolean
}

export interface UserRepository {
  authenticate(email: string, password: string): Promise<{ user: SessionUser | null; message?: string }>
  emailExists(email: string): Promise<boolean>
  create(data: { email: string; password: string; firstName: string; lastName: string; phone: string | null }): Promise<SessionUser>
  getAccountState(userId: string): Promise<AccountState | null>
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; message?: string }>
  getSessionUser(userId: string): Promise<SessionUser | null>
  /** Active account with this email (case-insensitive). */
  findActiveByEmail(email: string): Promise<SessionUser | null>
  markEmailVerified(userId: string): Promise<void>
  /** Sets a new password after a reset link and revokes every session. */
  resetPassword(userId: string, newPassword: string): Promise<{ success: boolean; message?: string }>
  updateProfile(userId: string, patch: { first_name: string; last_name: string; phone: string | null }): Promise<SessionUser>
  getTwoFactor(userId: string): Promise<TwoFactorState | null>
  savePendingTotp(userId: string, sealedSecret: string): Promise<void>
  /** Activates the pending secret with fresh recovery codes. */
  enableTotp(userId: string, sealedSecret: string, recoveryHashes: string[]): Promise<void>
  /** Records the last used time step; false if an equal or later one was already used (replay). */
  advanceTotpCounter(userId: string, counter: number): Promise<boolean>
  /** Removes a recovery code; false if it was not (or no longer) valid. */
  consumeRecoveryCode(userId: string, hash: string): Promise<boolean>
  setRecoveryCodes(userId: string, hashes: string[]): Promise<void>
  /** Account created by a social login: random unusable password, `password_set` false. */
  createSocial(data: { email: string; firstName: string; lastName: string; emailVerified: boolean }): Promise<SessionUser>
  /** False while a social-only account has not chosen a password. */
  hasPassword(userId: string): Promise<boolean>
}

/** What a social provider tells us about the person who signed in. */
export interface OAuthProfile {
  /** Stable id at the provider (Google `sub`, Facebook id, TikTok `open_id`). */
  providerUserId: string
  /** TikTok never shares one; Facebook only with the email permission. */
  email: string | null
  /** The provider vouches that the person owns this address. */
  emailVerified: boolean
  firstName: string
  lastName: string
}

/** One OAuth 2.0 provider (authorization code flow). */
export interface OAuthProvider {
  id: SocialProvider
  authorizeUrl(p: { state: string; codeChallenge: string; redirectUri: string }): string
  /** Exchanges the code and reads the profile; throws if the provider refuses. */
  fetchProfile(p: { code: string; codeVerifier: string; redirectUri: string }): Promise<OAuthProfile>
}

export interface LinkedIdentity {
  provider: SocialProvider
  email: string | null
  displayName: string | null
  createdAt: string
}

/** Social accounts linked to users. */
export interface IdentityRepository {
  findUserId(provider: SocialProvider, providerUserId: string): Promise<string | null>
  listForUser(userId: string): Promise<LinkedIdentity[]>
  /** False if that social account (or this provider for the user) is already linked. */
  link(data: { userId: string; provider: SocialProvider; providerUserId: string; email: string | null; displayName: string | null }): Promise<boolean>
  touch(provider: SocialProvider, providerUserId: string): Promise<void>
  unlink(userId: string, provider: SocialProvider): Promise<boolean>
}

/** Account management for the back-office. */
export interface UserAdminRepository {
  list(query: AdminUserQuery): Promise<{ items: AdminUser[]; total: number }>
  stats(): Promise<AdminUserStats>
  findById(id: string): Promise<AdminUser | null>
  countActiveAdmins(): Promise<number>
  /** Also revokes the user's open sessions. */
  update(id: string, patch: { role?: 'customer' | 'admin'; is_active?: boolean }): Promise<AdminUser>
  /** Clears the 2FA secret and recovery codes; the admin enrols again at next sign-in. */
  resetTwoFactor(id: string): Promise<void>
}

export type AuthTokenPurpose = 'verify_email' | 'reset_password' | 'oauth_login' | 'oauth_link'

/** One-time links (email verification, password reset); only token hashes are stored. */
export interface AuthTokenRepository {
  create(data: { userId: string; purpose: AuthTokenPurpose; tokenHash: string; expiresAt: Date }): Promise<void>
  /** Marks the token used and returns its user, or null if unknown, used or expired (atomic). */
  consume(tokenHash: string, purpose: AuthTokenPurpose): Promise<string | null>
  /** Invalidates the user's unused tokens of that kind. */
  revokeAll(userId: string, purpose: AuthTokenPurpose): Promise<void>
}

/** Random one-time tokens for email links. */
export interface OneTimeTokens {
  issue(): { token: string; hash: string }
  hash(token: string): string
}

export interface TwoFactorState {
  /** Sealed (encrypted) secrets — see TwoFactorCrypto. */
  secret: string | null
  pendingSecret: string | null
  enabledAt: string | null
  lastCounter: number
  recoveryHashes: string[]
}

/** TOTP maths, secret encryption and recovery codes. */
export interface TwoFactorCrypto {
  newSecret(): string
  otpauthUrl(account: string, secret: string): string
  /** Matching time step, or null (wrong, expired or replayed code). */
  verify(secret: string, code: string, lastCounter: number): number | null
  seal(secret: string): string
  open(sealed: string): string
  newRecoveryCodes(count?: number): string[]
  hashRecoveryCode(code: string): string
}

export interface ContactMessage {
  id: string
  name: string
  email: string
  phone?: string | null
  subject: string
  message: string
  status: 'new' | 'read' | 'archived'
  created_at: string
}

export interface ContactRepository {
  saveMessage(msg: Omit<ContactMessage, 'id' | 'status' | 'created_at'>): Promise<void>
  listMessages(opts: { status?: ContactMessage['status'] }): Promise<ContactMessage[]>
  updateMessageStatus(id: string, status: ContactMessage['status']): Promise<void>
  subscribe(email: string, source: string): Promise<'created' | 'exists'>
}

export interface InstagramPost {
  id: string
  image_url?: string | null
  caption?: string | null
  embed_code?: string | null
  post_url?: string | null
  permalink?: string | null
  post_id?: string | null
  media_type?: string | null
  likes?: number | null
  comments?: number | null
  is_published: boolean
  posted_at: string
  /** Community look: the loyal customer wearing our pieces. */
  customer_name?: string | null
  /** Their Instagram handle, without "@". */
  customer_handle?: string | null
  customer_city?: string | null
  quote?: string | null
  /** Pieces worn in the look. */
  product_ids?: string[]
  sort_order?: number
}

/** A published look, with the worn pieces resolved for the storefront. */
export interface CommunityLook extends InstagramPost {
  products: { id: string; name: string; slug: string; image: string | null }[]
}

export interface InstagramRepository {
  list(opts: { publishedOnly: boolean; limit?: number }): Promise<InstagramPost[]>
  create(post: Omit<InstagramPost, 'id'>): Promise<InstagramPost>
  update(id: string, patch: Partial<Omit<InstagramPost, 'id'>>): Promise<void>
  delete(id: string): Promise<void>
}

export interface FileStorage {
  /** Stores the bytes and returns the public URL. */
  upload(bucket: string, path: string, bytes: Uint8Array, contentType: string): Promise<string>
  /** Deletes objects given their public URLs (URLs outside the bucket are ignored). */
  removeByUrls(bucket: string, publicUrls: string[]): Promise<void>
  /** A one-time URL the browser uploads a file to directly (too big to go through the API). */
  createUploadUrl(bucket: string, path: string): Promise<{ uploadUrl: string; publicUrl: string }>
}

// ------------------------------------------------------------ gateways/svcs

export interface PaymentGateway {
  initialize(params: {
    email: string
    amount: number
    reference: string
    callbackUrl: string
    metadata?: Record<string, unknown>
  }): Promise<{ authorizationUrl: string; reference: string }>
  verify(reference: string): Promise<{ status: string; amount: number; currency: string | null; channel: string | null; paidAt: string | null }>
  isValidWebhookSignature(rawBody: string, signature: string | null): boolean
}

export interface Mailer {
  /** `headers`: extra mail headers (e.g. List-Unsubscribe for campaigns). */
  send(message: { to: string; subject: string; html: string; replyTo?: string; headers?: Record<string, string> }): Promise<boolean>
  /** Which service sends, from which address, and why the last email failed (for the admin test). */
  status(): { provider: 'smtp' | 'brevo' | 'none'; from: string | null; lastError: string | null }
}

export interface CaptchaVerifier {
  /** Throws `CaptchaError` when the token is missing, invalid or low-score. */
  verify(token: string | null | undefined, action: string, remoteIp?: string): Promise<void>
}

/** Claims of a valid token; `issuedAt` is in seconds since the epoch. */
/** `mfa`: the session passed two-factor authentication (required for admin rights). */
export type TokenClaims = SessionUser & { issuedAt: number; mfa: boolean }

export type ChallengePurpose = 'setup' | 'verify'

export interface TokenService {
  sign(user: SessionUser, opts?: { mfa?: boolean }): Promise<{ token: string; expiresAt: string }>
  verify(token: string): Promise<TokenClaims | null>
  /** Short-lived token proving the password step passed; only usable for the 2FA step. */
  signChallenge(userId: string, purpose: ChallengePurpose): Promise<string>
  verifyChallenge(token: string): Promise<{ userId: string; purpose: ChallengePurpose } | null>
  /** Signed, short-lived data (OAuth state, pending sign-up); never accepted as a session. */
  signTicket(kind: TicketKind, data: Record<string, unknown>, ttlSeconds: number): Promise<string>
  verifyTicket<T extends Record<string, unknown>>(kind: TicketKind, token: string): Promise<T | null>
}

export type TicketKind = 'oauth-state' | 'oauth-signup'

// --------------------------------------------------------------- newsletter

export interface NewsletterRecipient {
  email: string
  firstName: string | null
  userId: string | null
}

export type NewsletterCampaignWrite = Pick<NewsletterCampaign, 'title' | 'subject' | 'preheader' | 'blocks' | 'audience'>

export interface NewsletterDelivery {
  id: string
  campaignId: string
  email: string
  firstName: string | null
  userId: string | null
}

export interface NewsletterSubscriberRow {
  id: string
  email: string
  source: string | null
  created_at: string
  unsubscribed_at: string | null
}

export interface NewsletterRepository {
  list(): Promise<NewsletterCampaign[]>
  get(id: string): Promise<NewsletterCampaign | null>
  create(data: NewsletterCampaignWrite & { created_by: string | null }): Promise<NewsletterCampaign>
  update(id: string, patch: Partial<NewsletterCampaignWrite>): Promise<NewsletterCampaign>
  delete(id: string): Promise<void>
  /**
   * Moves a campaign between statuses only if it is currently in one of `from`
   * (atomic: two workers can't both start the same campaign). Null if it wasn't.
   */
  transition(
    id: string,
    from: NewsletterStatus[],
    to: NewsletterStatus,
    extra?: Partial<Pick<NewsletterCampaign, 'scheduled_at' | 'started_at' | 'finished_at' | 'recipients_count' | 'sent_count' | 'failed_count'>>,
  ): Promise<NewsletterCampaign | null>
  /** Scheduled campaigns whose time has come, and campaigns being sent. */
  due(now: Date): Promise<NewsletterCampaign[]>
  /** Consenting, not-unsubscribed addresses (deduplicated, lowercase). */
  audience(audience: NewsletterAudience): Promise<NewsletterRecipient[]>
  countAudience(): Promise<Record<NewsletterAudience, number>>
  /** Inserts deliveries; existing (campaign, email) pairs are left untouched. Returns the total queued for the campaign. */
  enqueue(campaignId: string, recipients: NewsletterRecipient[]): Promise<number>
  claim(campaignId: string, limit: number): Promise<NewsletterDelivery[]>
  markDelivery(id: string, result: { status: 'sent' | 'failed' | 'skipped'; error?: string | null }): Promise<void>
  /** Remaining work and outcome of a campaign's deliveries. */
  deliveryCounts(campaignId: string): Promise<{ pending: number; sending: number; sent: number; failed: number; skipped: number }>
  skipPending(campaignId: string): Promise<void>
  isSuppressed(email: string): Promise<boolean>
  /** Unsubscribes an address everywhere (subscriber list, customer consent) and blocks future sends. */
  suppress(email: string, reason: string): Promise<void>
  /** Explicit (re-)subscription: lifts a previous unsubscribe. */
  resubscribe(email: string): Promise<void>
  listSubscribers(): Promise<NewsletterSubscriberRow[]>
  deleteSubscriber(id: string): Promise<void>
  setMarketingOptIn(userId: string, optIn: boolean): Promise<void>
  getMarketingOptIn(userId: string): Promise<boolean>
  /** The scheduler's secret, kept in Supabase Vault (never leaves the database). */
  verifyCronSecret(secret: string): Promise<boolean>
}

/** What a customer bought (for "Pour vous" recommendations). */
export interface PurchaseHistoryRepository {
  purchasedProductIds(recipient: { email: string; userId: string | null }): Promise<string[]>
}

/** Signed one-click unsubscribe links. */
export interface UnsubscribeTokens {
  sign(email: string): string
  verify(email: string, token: string): boolean
}

/** One back-office mutation (never the request body: it may hold personal data). */
export interface AdminAuditEntry {
  actor_id: string
  actor_email: string
  action: string
  method: string
  path: string
  resource_id: string | null
  status: number
  ip: string
  request_id: string
  user_agent: string | null
}

export interface AuditLogRepository {
  record(entry: AdminAuditEntry): Promise<void>
}

/** One storefront page view (no IP, no account id). */
export interface SiteVisit {
  session_id: string
  visitor_hash: string
  is_landing: boolean
  path: string
  source: string
  referrer_host: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  country: string | null
  region: string | null
  city: string | null
  device: 'mobile' | 'tablet' | 'desktop'
  browser: string
}

export interface VisitRepository {
  record(visit: SiteVisit): Promise<void>
  stats(from: Date, to: Date, hourly: boolean): Promise<Omit<AudienceStats, 'range' | 'from' | 'to' | 'hourly'>>
}

/** Daily-rotating pseudonymous visitor id (the IP itself is never stored). */
export type VisitorHasher = (ip: string, userAgent: string, day: string) => string
