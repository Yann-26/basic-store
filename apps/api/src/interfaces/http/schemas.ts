/**
 * Request DTO schemas (zod). They validate and normalise untrusted input
 * at the edge, before anything reaches the application layer.
 */
import { z } from 'zod'
import { AUDIENCE_RANGES, CATEGORY_IDS, MANUAL_PAYMENT_METHODS, ORDER_STATUSES, PAYMENT_STATUSES, isValidPhone, normalizePhone } from '@trs/shared'

const text = (max: number) => z.string().trim().max(max)
const optionalText = (max: number) => text(max).optional().nullable()
const email = z.string().trim().toLowerCase().email('Email invalide').max(254)
const phone = z
  .string()
  .trim()
  .transform(normalizePhone)
  .refine(isValidPhone, 'Téléphone invalide (format : +225 XX XX XX XX XX)')
const url = z.union([z.string().trim().url('URL invalide').max(2048), z.literal('')])
const money = z.coerce.number().min(0).max(100_000_000)

export const uuidParam = z.object({ id: z.string().uuid('Identifiant invalide') })

// -------------------------------------------------------------------- auth
export const loginSchema = z.object({
  email,
  password: z.string().min(6, 'Mot de passe invalide').max(128),
})

export const twoFactorVerifySchema = z.object({
  challenge: z.string().min(20).max(2000),
  // 6-digit authenticator code, or a recovery code ("7kq2-m9xp")
  code: z.string().trim().min(6, 'Code requis').max(20),
})

export const twoFactorCodeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Code à 6 chiffres requis'),
})

export const adminUserQuerySchema = z.object({
  search: text(100).optional(),
  role: z.enum(['customer', 'admin']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const adminUserUpdateSchema = z.object({
  role: z.enum(['customer', 'admin']).optional(),
  is_active: z.boolean().optional(),
})

export const tokenSchema = z.object({ token: z.string().trim().min(20).max(200) })

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(20).max(200),
  password: z.string().min(8).max(128),
})

export const profileSchema = z.object({
  first_name: text(50).min(2, 'Prénom trop court'),
  last_name: text(50).min(2, 'Nom trop court'),
  phone: phone.optional().nullable().or(z.literal('').transform(() => null)),
})

export const registerSchema = z.object({
  email,
  password: z.string().min(8).max(128),
  firstName: text(50).min(2, 'Prénom trop court'),
  lastName: text(50).min(2, 'Nom trop court'),
  phone: phone.optional().nullable().or(z.literal('').transform(() => null)),
  /** "Je souhaite recevoir les nouveautés" — unchecked by default. */
  marketingOptIn: z.boolean().optional(),
})

export const mediaColorSchema = z.object({ color: z.string().trim().max(40).nullable().transform((c) => c || null) })

export const oauthExchangeSchema = z.object({ code: z.string().trim().min(20).max(200) })

export const oauthSignupSchema = z.object({
  ticket: z.string().trim().min(20).max(2000),
  email,
  firstName: text(50).min(2, 'Prénom trop court'),
  lastName: text(50).min(2, 'Nom trop court'),
})

// ----------------------------------------------------------------- catalog
export const productQuerySchema = z.object({
  category: z.enum(CATEGORY_IDS as [string, ...string[]]).optional(),
  subcategory: text(80).optional(),
  gender: z.enum(['men', 'women', 'unisex', 'kids']).optional(),
  brand: text(100).optional(),
  collection: text(100).optional(),
  exclusive: text(100).optional(),
  search: text(100).optional(),
  size: text(12).transform((s) => s.toUpperCase()).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  featured: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  sort: z.enum(['shuffle', 'newest', 'oldest', 'price_asc', 'price_desc', 'name']).optional(),
  seed: z.coerce.number().int().min(0).max(2_147_483_647).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  // Legacy parameter from the sneaker era, ignored.
  status: z.string().optional(),
})

const productBase = {
  name: text(200).min(2, 'Nom trop court'),
  description: optionalText(5000),
  price: money.refine((v) => v >= 100, 'Prix minimum : 100 FCFA'),
  compare_at_price: money.optional().nullable(),
  category: z.enum(CATEGORY_IDS as [(typeof CATEGORY_IDS)[number], ...(typeof CATEGORY_IDS)[number][]]),
  subcategory: optionalText(80),
  gender: z.enum(['men', 'women', 'unisex', 'kids']).optional().nullable(),
  status: z.enum(['available', 'unavailable', 'limited']).optional(),
  stock: z.coerce.number().int().min(0).max(1_000_000).optional(),
  sizes: z.array(z.union([z.string(), z.number()]).transform(String)).max(40).optional(),
  colors: z.array(text(40)).max(30).optional(),
  materials: optionalText(300),
  features: z.array(text(200)).max(30).optional(),
  tags: z.array(text(40)).max(30).optional(),
  is_featured: z.boolean().optional(),
  is_active: z.boolean().optional(),
  release_date: z.string().trim().max(30).optional().nullable(),
  series_size: z.coerce.number().int().min(1).max(100_000).optional().nullable(),
  preorder_goal: z.coerce.number().int().min(1).max(100_000).optional().nullable(),
  preorder_deadline: z.string().trim().max(40).optional().nullable(),
  brand_id: z.string().uuid().optional().nullable().or(z.literal('')),
  collection_id: z.string().uuid().optional().nullable().or(z.literal('')),
  spin_frames: z.array(z.string().trim().url().max(2048)).max(72).optional(),
  is_exclusive: z.boolean().optional(),
  exclusive_id: z.string().uuid().optional().nullable().or(z.literal('')),
  /** Not stored: email the subscribers about this piece (default yes, 15 minutes after it is published). */
  notify_subscribers: z.boolean().optional(),
}

export const productCreateSchema = z.object(productBase)
export const productUpdateSchema = z.object(productBase).partial()

export const brandSchema = z.object({
  name: text(50).min(2),
  description: optionalText(1000),
  logo_url: url.optional().nullable(),
  banner_url: url.optional().nullable(),
  is_active: z.boolean().optional(),
  sort_order: z.coerce.number().int().min(0).optional(),
})

export const collectionSchema = z.object({
  name: text(100).min(2),
  description: optionalText(1000),
  /** Kept for old data; the shop sells its own brand, so a collection no longer needs one. */
  brand_id: z.string().uuid().optional().nullable().or(z.literal('')),
  image_url: url.optional().nullable(),
  banner_url: url.optional().nullable(),
  is_active: z.boolean().optional(),
  sort_order: z.coerce.number().int().min(0).optional(),
})

export const exclusiveSchema = z.object({
  name: text(100).min(2),
  description: optionalText(1000),
  brand_id: z.string().uuid().optional().nullable().or(z.literal('')),
  image_url: url.optional().nullable(),
  banner_url: url.optional().nullable(),
  is_active: z.boolean().optional(),
  sort_order: z.coerce.number().int().min(0).optional(),
})

// ------------------------------------------------------------------ orders
export const createOrderSchema = z.object({
  customer: z.object({
    firstName: text(50).min(1, 'Prénom requis'),
    lastName: text(50).min(1, 'Nom requis'),
    phone,
    whatsapp: phone.optional().nullable().or(z.literal('').transform(() => null)),
    email: email.optional().nullable().or(z.literal('').transform(() => null)),
    city: text(100).min(1, 'Ville requise'),
    address: text(300).min(3, 'Adresse requise'),
    notes: optionalText(1000),
  }),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        size: z.union([z.string(), z.number()]).transform(String).optional().nullable(),
        color: optionalText(40),
        quantity: z.coerce.number().int().min(1).max(10),
      }),
    )
    .min(1, 'Panier vide')
    .max(30),
  payment_method: text(40).min(1).default('paystack'),
  promo_code: optionalText(40),
})

export const reviewSchema = z.object({
  product_id: z.string().uuid(),
  rating: z.coerce.number().int().min(1, 'Choisissez une note').max(5),
  title: optionalText(80),
  body: optionalText(1500),
  photo_url: z.string().url().max(500).optional().nullable().or(z.literal('').transform(() => null)),
})

export const reviewModerationSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  admin_reply: optionalText(800),
})

export const reviewQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
})

export const dropSchema = z.object({
  title: text(120).min(2, 'Titre requis'),
  description: text(1000).default(''),
  image_url: z.string().url().max(500).optional().nullable().or(z.literal('').transform(() => null)).default(null),
  starts_at: z.string().datetime({ offset: true }),
  product_ids: z.array(z.string().uuid()).max(24).default([]),
  location: text(160).default(''),
  is_published: z.boolean().default(true),
  preorders_open: z.boolean().default(true),
})

export const dropReminderSchema = z.object({ email })

export const promoQuoteSchema = z.object({
  promo_code: text(40).min(1, 'Code requis'),
  items: createOrderSchema.shape.items,
})

const dateOrNull = z
  .union([z.string().datetime({ offset: true }), z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(''), z.null()])
  .transform((v) => (v ? new Date(v).toISOString() : null))

const promoCodeText = text(30).regex(/^[A-Za-z0-9][A-Za-z0-9 -]{2,29}$/, 'Code : 3 à 30 lettres, chiffres ou tirets')

export const promoCodeSchema = z
  .object({
    code: promoCodeText,
    kind: z.enum(['percent', 'fixed']),
    value: z.coerce.number().int().positive('Valeur requise'),
    description: optionalText(200).transform((v) => v ?? ''),
    min_order: z.coerce.number().int().min(0).default(0),
    max_uses: z.union([z.coerce.number().int().positive(), z.literal(''), z.null()]).transform((v) => (v === '' ? null : v)).default(null),
    per_account_limit: z.coerce.number().int().min(1).max(100).default(1),
    starts_at: dateOrNull.default(null),
    ends_at: dateOrNull.default(null),
    is_active: z.boolean().default(true),
    first_order_only: z.boolean().default(false),
  })
  .refine((p) => p.kind !== 'percent' || p.value <= 100, { message: 'Un pourcentage ne dépasse pas 100', path: ['value'] })
  .refine((p) => !p.starts_at || !p.ends_at || p.starts_at < p.ends_at, { message: 'La fin doit suivre le début', path: ['ends_at'] })

export const promoCodePatchSchema = z.object({
  code: promoCodeText.optional(),
  kind: z.enum(['percent', 'fixed']).optional(),
  value: z.coerce.number().int().positive().optional(),
  description: text(200).optional(),
  min_order: z.coerce.number().int().min(0).optional(),
  max_uses: z.union([z.coerce.number().int().positive(), z.literal(''), z.null()]).transform((v) => (v === '' ? null : v)).optional(),
  per_account_limit: z.coerce.number().int().min(1).max(100).optional(),
  starts_at: dateOrNull.optional(),
  ends_at: dateOrNull.optional(),
  is_active: z.boolean().optional(),
  first_order_only: z.boolean().optional(),
})

export const orderQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional().or(z.literal('all').transform(() => undefined)),
  search: text(40).optional(),
  customerId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const updateOrderSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  admin_notes: optionalText(2000),
  adminNotes: optionalText(2000),
  estimated_delivery: z.string().trim().max(30).optional().nullable(),
  delivery_address: optionalText(300),
  delivery_city: optionalText(100),
  location: optionalText(200),
  notes: optionalText(2000),
  notify_customer: z.boolean().optional(),
})

export const orderNumberParam = z.object({ preorderNumber: text(20).min(5) })

// ---------------------------------------------------------------- payments
// Email and metadata come from the order and the account, never from the client
// (older clients still send them: unknown keys are dropped).
export const initializePaymentSchema = z.object({
  orderId: z.string().uuid(),
})

/** Money received outside the website, recorded by an admin. */
export const manualPaymentSchema = z.object({
  amount: z.coerce.number().int('Montant en FCFA, sans décimales').positive('Montant invalide').max(10_000_000),
  method: z.enum(MANUAL_PAYMENT_METHODS),
  note: optionalText(300),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis').max(200),
  newPassword: z.string().min(8, 'Au moins 8 caractères').max(128),
})

export const verifyPaymentSchema = z.object({ reference: text(80).min(5) })
export const paymentReferenceParam = z.object({ reference: text(80).min(5) })
export const rejectPaymentSchema = z.object({ reason: optionalText(300) })

export const paymentQuerySchema = z.object({
  status: z.enum(PAYMENT_STATUSES).optional(),
  orderId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// --------------------------------------------------------------- customers
export const customerUpdateSchema = z.object({
  first_name: text(50).min(2).optional(),
  last_name: text(50).min(2).optional(),
  phone: phone.optional(),
  whatsapp: phone.optional().nullable(),
  email: email.optional().nullable(),
  city: optionalText(100),
  address: optionalText(300),
  notes: optionalText(2000),
  is_active: z.boolean().optional(),
})

// ---------------------------------------------------------------- settings
const SETTING_VALUE_MAX = 20_000 // bytes of JSON per value
const settingEntry = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/, 'Clé invalide'),
  value: z.unknown().refine((v) => v !== undefined && JSON.stringify(v).length <= SETTING_VALUE_MAX, 'Valeur trop longue'),
})
const settingEntries = z.array(settingEntry).max(150)
// Accepted shapes: [{ key, value }], { key, value }, or { key: value, ... } — every key is validated.
export const settingsUpdateSchema = z.union([
  settingEntries,
  settingEntry.transform((e) => [e]),
  z
    .record(z.string(), z.unknown())
    .transform((obj) => Object.entries(obj).map(([key, value]) => ({ key, value })))
    .pipe(settingEntries),
])

// ------------------------------------------------------------- engagement
export const contactSchema = z.object({
  name: text(100).min(2, 'Nom requis'),
  email,
  phone: optionalText(30),
  subject: text(150).min(2, 'Sujet requis'),
  message: text(5000).min(10, 'Message trop court (10 caractères min.)'),
})

export const newsletterSchema = z.object({ email, source: text(40).optional() })

export const messageStatusSchema = z.object({ status: z.enum(['new', 'read', 'archived']) })

export const instagramPostSchema = z.object({
  image_url: url.optional().nullable(),
  caption: optionalText(2200),
  hashtags: optionalText(500),
  embed_code: optionalText(10000),
  post_url: url.optional().nullable(),
  permalink: url.optional().nullable(),
  post_id: optionalText(100),
  media_type: z.enum(['image', 'video', 'carousel']).optional(),
  is_published: z.boolean().optional(),
  customer_name: optionalText(60),
  customer_handle: optionalText(80),
  customer_city: optionalText(60),
  quote: optionalText(280),
  product_ids: z.array(z.string().uuid()).max(8).optional(),
  sort_order: z.coerce.number().int().min(0).max(10_000).optional(),
})

export const analyticsQuerySchema = z.object({
  days: z.coerce.number().int().refine((d) => [7, 30, 90, 365].includes(d), 'Période invalide').default(30),
})

// -------------------------------------------------------------- newsletter
/** https URL, a site path (/collection) or mailto: — never javascript:, data:… */
const campaignLink = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => /^https:\/\/[^\s]+$/i.test(v) || /^\/(?!\/)[^\s]*$/.test(v) || /^mailto:[^\s@]+@[^\s@]+$/i.test(v), 'Lien invalide (https://… ou /page)')
const campaignImage = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => /^https:\/\/[^\s]+$/i.test(v) || /^\/(?!\/)[^\s]*$/.test(v), 'Image invalide (https://…)')
const blockId = z.string().trim().min(1).max(64)

export const newsletterBlockSchema = z.discriminatedUnion('type', [
  z.object({ id: blockId, type: z.literal('heading'), text: text(200).min(1, 'Titre vide') }).strict(),
  z.object({ id: blockId, type: z.literal('text'), text: text(5000).min(1, 'Texte vide') }).strict(),
  z.object({ id: blockId, type: z.literal('image'), url: campaignImage, alt: text(200), link: campaignLink.optional().or(z.literal('')) }).strict(),
  z.object({ id: blockId, type: z.literal('video'), url: campaignLink, thumbnail: campaignImage.optional().or(z.literal('')), caption: text(200).optional() }).strict(),
  z.object({ id: blockId, type: z.literal('button'), label: text(60).min(1, 'Bouton sans texte'), url: campaignLink }).strict(),
  z.object({ id: blockId, type: z.literal('products'), title: text(120).optional(), productIds: z.array(z.string().uuid()).min(1, 'Choisissez au moins un produit').max(6) }).strict(),
  z.object({ id: blockId, type: z.literal('recommendations'), title: text(120).optional() }).strict(),
  z.object({ id: blockId, type: z.literal('divider') }).strict(),
])

const campaignFields = {
  title: text(120).min(2, 'Nom interne requis'),
  subject: text(150).min(2, 'Objet requis'),
  preheader: text(200).default(''),
  blocks: z.array(newsletterBlockSchema).max(40, '40 blocs maximum'),
  audience: z.enum(['all', 'buyers']).default('all'),
}

/** Only these fields can be written: status, counts and dates are server-managed. */
export const newsletterCampaignSchema = z.object(campaignFields).strict()
export const newsletterCampaignUpdateSchema = z.object(campaignFields).partial().strict()
export const newsletterPreviewSchema = z.object({ subject: campaignFields.subject, preheader: campaignFields.preheader, blocks: campaignFields.blocks }).strict()
export const newsletterScheduleSchema = z.object({ at: z.coerce.date() }).strict()
export const unsubscribeSchema = z.object({ e: email, t: z.string().trim().min(20).max(100) })
export const preferencesSchema = z.object({ marketingOptIn: z.boolean() }).strict()

// ------------------------------------------------------------- audience
const opaqueId = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/)
const utmValue = z.string().max(100).nullish()
export const pageViewSchema = z.object({
  path: z.string().min(1).max(300),
  referrer: z.string().max(500).nullish(),
  utm: z.object({ source: utmValue, medium: utmValue, campaign: utmValue }).nullish(),
  sessionId: opaqueId,
  visitorKey: opaqueId.nullish(),
  landing: z.boolean(),
})
export const audienceQuerySchema = z.object({
  range: z.enum(AUDIENCE_RANGES).default('7d'),
})
