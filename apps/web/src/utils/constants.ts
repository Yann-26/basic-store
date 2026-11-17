import { BRAND as SHARED_BRAND } from '@trs/shared'

export const BRAND = {
  ...SHARED_BRAND,
  social: {
    ...SHARED_BRAND.social,
    whatsapp: `https://wa.me/${SHARED_BRAND.whatsapp}`,
  },
} as const

export const IVORIAN_CITIES = [
  'Abidjan - Abobo', 'Abidjan - Adjamé', 'Abidjan - Attécoubé', 'Abidjan - Cocody', 'Abidjan - Koumassi',
  'Abidjan - Marcory', 'Abidjan - Plateau', 'Abidjan - Port-Bouët', 'Abidjan - Treichville', 'Abidjan - Yopougon',
  'Abidjan - Bingerville', 'Abidjan - Songon', 'Abidjan - Anyama', 'Assinie', 'Bassam', 'Bouaké', 'Daloa',
  'Korhogo', 'Man', 'San-Pédro', 'Yamoussoukro', 'Autre ville',
] as const

/** Builds a wa.me link from a phone setting ("+225 07…") with an optional message. */
export function whatsappLink(phone: string | undefined | null, text?: string): string {
  const digits = (phone || SHARED_BRAND.whatsapp).replace(/\D/g, '')
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

/** Accepts either a full URL or a bare handle stored in settings. */
export function socialUrl(network: 'instagram' | 'facebook' | 'tiktok' | 'snapchat', value?: string | null): string {
  if (!value) return ''
  if (/^https?:\/\//.test(value)) return value
  const handle = value.replace(/^@/, '')
  const base = { instagram: 'https://instagram.com/', facebook: 'https://facebook.com/', tiktok: 'https://tiktok.com/@', snapchat: 'https://snapchat.com/add/' }[network]
  return base + handle
}
