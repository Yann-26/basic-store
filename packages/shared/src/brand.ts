/**
 * Brand identity shared by every app of the monorepo.
 * Runtime-editable values (contact, socials…) live in the `settings` table;
 * these are the defaults and the values that must never drift between apps.
 */
export const BRAND = {
  name: 'SCION CARON',
  shortName: 'SC',
  tagline: 'Élégance. Sobriété. Qualité.',
  slogan: 'Élevez votre style.',
  description:
    "Marque de vêtements ivoirienne : un luxe sobre inspiré de l'héritage africain, des pièces simples et bien coupées, fabriquées à Abidjan en séries limitées.",
  email: 'hello@therisingstar.ci',
  phone: '+225 07 99 51 22 37',
  whatsapp: '2250799512237',
  address: "Abidjan, Côte d'Ivoire",
  website: 'https://therisingstar.ci',
  social: {
    instagram: 'https://instagram.com/therisingstar.ci',
    facebook: 'https://facebook.com/therisingstar',
    tiktok: 'https://tiktok.com/@therisingstar',
    snapchat: 'https://snapchat.com/add/therisingstar',
  },
  colors: {
    gold: '#D4AF37',
    goldLight: '#F1D98A',
    goldDark: '#A8841F',
    black: '#0A0A0A',
    white: '#FFFFFF',
  },
} as const

/** Prefix for human-readable preorder numbers (e.g. SC-2026-7KQ4M2XA). */
export const ORDER_NUMBER_PREFIX = 'SC'
/** Prefix for payment references (online payments, payments recorded by hand). */
export const PAYMENT_REFERENCE_PREFIX = 'SC'
/** Prefixes issued before the rebrand — still accepted for lookups. */
export const LEGACY_PREFIXES = ['CTL', 'TRS'] as const

