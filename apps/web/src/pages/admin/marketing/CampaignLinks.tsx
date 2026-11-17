import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import toast from 'react-hot-toast'
import { HiArrowDownTray, HiClipboard, HiQrCode } from 'react-icons/hi2'
import type { Product } from '@trs/shared'
import Section from './Section'

const SOURCES = [
  { id: 'affiche', label: 'Affiche' },
  { id: 'flyer', label: 'Flyer' },
  { id: 'popup', label: 'Pop-up store' },
  { id: 'emballage', label: 'Carte dans le colis' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'influenceur', label: 'Influenceur' },
] as const

const slug = (v: string) =>
  v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

/**
 * Tracked links and QR codes for each campaign (poster, pop-up, influencer…).
 * Visits arriving through them show up in Audience under their source, so the
 * shop knows which action brings visitors.
 */
export default function CampaignLinks({ products }: { products: Product[] }) {
  const [target, setTarget] = useState('/')
  const [source, setSource] = useState<string>('affiche')
  const [campaign, setCampaign] = useState('capsule-01')
  const [qr, setQr] = useState('')
  const [dark, setDark] = useState(true)

  const url = useMemo(() => {
    const u = new URL(target, window.location.origin)
    u.searchParams.set('utm_source', source)
    u.searchParams.set('utm_medium', ['instagram', 'tiktok', 'whatsapp', 'influenceur'].includes(source) ? 'social' : 'print')
    if (slug(campaign)) u.searchParams.set('utm_campaign', slug(campaign))
    return u.toString()
  }, [target, source, campaign])

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 2, width: 720, errorCorrectionLevel: 'M', color: dark ? { dark: '#D4AF37', light: '#0A0A0A' } : { dark: '#0A0A0A', light: '#FFFFFF' } })
      .then(setQr)
      .catch(() => setQr(''))
  }, [url, dark])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Lien copié')
    } catch {
      toast.error('Copie impossible')
    }
  }

  return (
    <Section
      icon={HiQrCode}
      title="Liens de campagne & QR codes"
      hint="Un lien et un QR code par action (affiche, pop-up, influenceur…). Les visites qui en viennent apparaissent dans Audience sous leur source : vous savez ce qui marche."
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_16rem]">
        <div className="space-y-5">
          <div>
            <label htmlFor="cl-target" className="mb-1 block text-sm font-medium uppercase tracking-wider text-gray-300">
              Destination
            </label>
            <select id="cl-target" value={target} onChange={(e) => setTarget(e.target.value)} className="field">
              <option value="/">Accueil</option>
              <option value="/collection">Boutique</option>
              <option value="/collection?sort=newest">Nouveautés</option>
              <option value="/exclusivites">Exclusivités</option>
              {products.map((p) => (
                <option key={p.id} value={`/product/${p.slug}`}>
                  Pièce : {p.name}
                </option>
              ))}
            </select>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium uppercase tracking-wider text-gray-300">Où sera-t-il diffusé ?</legend>
            <div className="flex flex-wrap gap-2">
              {SOURCES.map((s) => (
                <button key={s.id} type="button" onClick={() => setSource(s.id)} aria-pressed={source === s.id} className={`rounded-full border px-4 py-2 text-xs transition-colors ${source === s.id ? 'border-gold bg-gold/15 text-gold' : 'border-white/10 text-gray-400 hover:border-white/30'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="cl-campaign" className="mb-1 block text-sm font-medium uppercase tracking-wider text-gray-300">
              Nom de la campagne
            </label>
            <input id="cl-campaign" value={campaign} onChange={(e) => setCampaign(e.target.value)} className="field" placeholder="capsule-01, popup-riviera…" />
          </div>
          <div>
            <p className="mb-1 text-sm font-medium uppercase tracking-wider text-gray-300">Lien</p>
            <div className="flex gap-2">
              <code className="field block min-w-0 flex-1 truncate !py-3 text-xs">{url}</code>
              <button type="button" onClick={copy} className="flex items-center gap-2 rounded-xl border border-white/10 px-4 text-xs hover:border-gold hover:text-gold">
                <HiClipboard className="h-4 w-4" /> Copier
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {qr && <img src={qr} alt="QR code du lien" className="w-full rounded-xl" />}
          <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-400">
            <input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} className="accent-[var(--color-gold)]" /> Or sur noir (sinon noir sur blanc)
          </label>
          {qr && (
            <a href={qr} download={`qr-${source}-${slug(campaign) || 'lien'}.png`} className="flex items-center justify-center gap-2 rounded-full bg-gold py-3 text-xs font-semibold uppercase tracking-[0.15em] text-primary-black">
              <HiArrowDownTray className="h-4 w-4" /> Télécharger
            </a>
          )}
        </div>
      </div>
    </Section>
  )
}
