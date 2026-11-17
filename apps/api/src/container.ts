/**
 * Composition root — the only place where concrete adapters are wired
 * into the use-cases. Route handlers import `useCases` from here.
 */
import { env } from '@/config/env'
import { makeAccountNotifications } from '@/application/notifications'
import { makeAuthUseCases } from '@/application/use-cases/auth'
import { makeAccountUseCases } from '@/application/use-cases/account'
import { makeCatalogUseCases } from '@/application/use-cases/catalog'
import { makeCustomerUseCases } from '@/application/use-cases/customers'
import { makeDashboardUseCases } from '@/application/use-cases/dashboard'
import { makeEngagementUseCases } from '@/application/use-cases/engagement'
import { makeOrderUseCases } from '@/application/use-cases/orders'
import { makePaymentUseCases } from '@/application/use-cases/payments'
import { makeProductAdminUseCases } from '@/application/use-cases/products'
import { makeSettingsUseCases } from '@/application/use-cases/settings'
import { makeUploadUseCases } from '@/application/use-cases/uploads'
import { makeUserAdminUseCases } from '@/application/use-cases/users'
import { makeEmailUseCases } from '@/application/use-cases/email'
import { makeNewsletterUseCases } from '@/application/use-cases/newsletter'
import { SupabaseNewsletterRepository } from '@/infrastructure/supabase/repositories/newsletter.repository'
import { HmacUnsubscribeTokens } from '@/infrastructure/security/unsubscribe-tokens'
import { makeSocialAuthUseCases } from '@/application/use-cases/social'
import { configuredProviders } from '@/infrastructure/oauth/providers'
import { createMailer, senderAddress } from '@/infrastructure/email'
import { defer } from '@/infrastructure/background'
import { PaystackGateway } from '@/infrastructure/payments/paystack.gateway'
import { JwtTokenService } from '@/infrastructure/security/jwt-token.service'
import { GoogleRecaptchaVerifier } from '@/infrastructure/security/recaptcha.verifier'
import { TotpTwoFactorCrypto } from '@/infrastructure/security/totp'
import { SupabaseBrandRepository, SupabaseCollectionRepository, SupabaseExclusiveRepository } from '@/infrastructure/supabase/repositories/catalog.repository'
import { SupabaseContactRepository } from '@/infrastructure/supabase/repositories/contact.repository'
import { SupabaseCustomerRepository } from '@/infrastructure/supabase/repositories/customer.repository'
import { SupabaseInstagramRepository } from '@/infrastructure/supabase/repositories/instagram.repository'
import { SupabaseOrderRepository } from '@/infrastructure/supabase/repositories/order.repository'
import { SupabasePaymentRepository } from '@/infrastructure/supabase/repositories/payment.repository'
import { SupabaseProductRepository } from '@/infrastructure/supabase/repositories/product.repository'
import { SupabaseSettingsRepository } from '@/infrastructure/supabase/repositories/settings.repository'
import { SupabaseUserRepository } from '@/infrastructure/supabase/repositories/user.repository'
import { SupabaseAuthTokenRepository } from '@/infrastructure/supabase/repositories/auth-token.repository'
import { newPkce, RandomOneTimeTokens } from '@/infrastructure/security/one-time-tokens'
import { SupabaseIdentityRepository } from '@/infrastructure/supabase/repositories/identity.repository'
import { SupabaseUserAdminRepository } from '@/infrastructure/supabase/repositories/user-admin.repository'
import { SupabaseFileStorage } from '@/infrastructure/supabase/storage'
import { SupabaseAuditLogRepository } from '@/infrastructure/supabase/repositories/audit.repository'
import { SupabaseVisitRepository } from '@/infrastructure/supabase/repositories/visit.repository'
import { hashVisitor } from '@/infrastructure/security/visitor-hash'
import { makeAudienceUseCases } from '@/application/use-cases/audience'
import { makePromoUseCases } from '@/application/use-cases/promo'
import { SupabasePromoRepository } from '@/infrastructure/supabase/repositories/promo.repository'
import { makeReviewUseCases } from '@/application/use-cases/reviews'
import { makeDropUseCases } from '@/application/use-cases/drops'
import { SupabaseReviewRepository } from '@/infrastructure/supabase/repositories/review.repository'
import { SupabaseDropRepository } from '@/infrastructure/supabase/repositories/drop.repository'

export const repos = {
  products: new SupabaseProductRepository(),
  brands: new SupabaseBrandRepository(),
  collections: new SupabaseCollectionRepository(),
  exclusives: new SupabaseExclusiveRepository(),
  customers: new SupabaseCustomerRepository(),
  orders: new SupabaseOrderRepository(),
  payments: new SupabasePaymentRepository(),
  settings: new SupabaseSettingsRepository(),
  users: new SupabaseUserRepository(),
  userAdmin: new SupabaseUserAdminRepository(),
  authTokens: new SupabaseAuthTokenRepository(),
  identities: new SupabaseIdentityRepository(),
  newsletter: new SupabaseNewsletterRepository(),
  contact: new SupabaseContactRepository(),
  instagram: new SupabaseInstagramRepository(),
  visits: new SupabaseVisitRepository(),
  promos: new SupabasePromoRepository(),
  reviews: new SupabaseReviewRepository(),
  drops: new SupabaseDropRepository(),
}

export const services = {
  tokens: new JwtTokenService(),
  captcha: new GoogleRecaptchaVerifier(),
  twoFactor: new TotpTwoFactorCrypto(),
  mailer: createMailer(),
  gateway: new PaystackGateway(),
  storage: new SupabaseFileStorage(),
  audit: new SupabaseAuditLogRepository(),
}

const config = { appUrl: env.appUrl, adminEmail: env.adminNotificationEmail }
const notify = makeAccountNotifications({
  mailer: services.mailer,
  defer,
  // Replies go to the admin inbox, else to the (verified, so real) sender address.
  config: { appUrl: env.appUrl, contactEmail: env.adminNotificationEmail ?? senderAddress(services.mailer) },
})

const oneTimeTokens = new RandomOneTimeTokens()
const account = makeAccountUseCases({ ...repos, oneTimeTokens, tokens: services.tokens, notify })

const newsletterUseCases = makeNewsletterUseCases({
  newsletter: repos.newsletter,
  purchases: repos.newsletter,
  products: repos.products,
  mailer: services.mailer,
  unsubscribe: new HmacUnsubscribeTokens(),
  config: { appUrl: env.appUrl },
})

const promo = makePromoUseCases({ ...repos, mailer: services.mailer, config })
const reviews = makeReviewUseCases({ ...repos, mailer: services.mailer, config: { ...config, supabaseUrl: env.supabaseUrl } })

export const useCases = {
  promo,
  reviews,
  drops: makeDropUseCases({ ...repos, mailer: services.mailer, config }),
  account,
  audience: makeAudienceUseCases({ visits: repos.visits, hashVisitor }),
  auth: makeAuthUseCases({ users: repos.users, tokens: services.tokens, twoFactor: services.twoFactor, notify, verificationToken: account.newVerificationToken }),
  catalog: makeCatalogUseCases(repos),
  products: makeProductAdminUseCases({ products: repos.products, storage: services.storage, announce: (p) => newsletterUseCases.announceProduct(p), config: { supabaseUrl: env.supabaseUrl } }),
  orders: makeOrderUseCases({ ...repos, mailer: services.mailer, config, promo, reviews }),
  payments: makePaymentUseCases({ ...repos, gateway: services.gateway, mailer: services.mailer, config }),
  customers: makeCustomerUseCases(repos),
  settings: makeSettingsUseCases(repos),
  dashboard: makeDashboardUseCases(repos),
  engagement: makeEngagementUseCases({ ...repos, mailer: services.mailer, config }),
  users: makeUserAdminUseCases({ ...repos, notify }),
  email: makeEmailUseCases({ mailer: services.mailer }),
  newsletter: newsletterUseCases,
  social: makeSocialAuthUseCases({
    ...repos,
    providers: configuredProviders(),
    oneTimeTokens,
    tokens: services.tokens,
    notify,
    pkce: newPkce,
    verificationToken: account.newVerificationToken,
    config: { appUrl: env.appUrl, callbackBase: env.oauth.callbackBase ?? `${env.appUrl.replace(/\/$/, '')}/api` },
  }),
  uploads: makeUploadUseCases({ storage: services.storage, products: repos.products }),
}
