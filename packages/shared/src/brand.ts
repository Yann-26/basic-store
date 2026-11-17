/**
 * Brand identity shared by every app of the monorepo.
 * Runtime-editable values (contact, socials…) live in the `settings` table;
 * these are the defaults and the values that must never drift between apps.
 */
export const BRAND = {
  name: 'Basic Store',
  shortName: 'BS',
  tagline: 'La qualité à bon prix.',
  slogan: 'Le style, sans se ruiner.',
  description:
    "Boutique de mode à Abidjan (Angré Nouveau CHU, Djorogobité 1) : vêtements, chaussures et accessoires de qualité à bon prix. Commandez en ligne, on livre partout en Côte d'Ivoire.",
  email: 'contact@basicstore.ci',
  phone: '+225 07 19 19 19 09',
  whatsapp: '2250719191909',
  address: "Angré Nouveau CHU, Djorogobité 1 — Abidjan, Côte d'Ivoire",
  website: 'https://basicstore.ci',
  mapsUrl: 'https://maps.app.goo.gl/WxVjzGNrFPwsw9nd9',
  social: {
    instagram: 'https://instagram.com/basicstoreci',
    facebook: '',
    tiktok: '',
    snapchat: '',
  },
  colors: {
    /** Kept under their old names so every component keeps working: "gold" is now the brand ink. */
    gold: '#0A0A0A',
    goldLight: '#3A3A3A',
    goldDark: '#000000',
    black: '#0A0A0A',
    white: '#FFFFFF',
    cream: '#F4F1EA',
  },
} as const

/** Prefix for human-readable preorder numbers (e.g. BS-2026-7KQ4M2XA). */
export const ORDER_NUMBER_PREFIX = 'BS'
/** Prefix for payment references (online payments, payments recorded by hand). */
export const PAYMENT_REFERENCE_PREFIX = 'BS'
/** Prefixes issued before the rebrand — still accepted for lookups. */
export const LEGACY_PREFIXES = ['SC', 'TRS'] as const

