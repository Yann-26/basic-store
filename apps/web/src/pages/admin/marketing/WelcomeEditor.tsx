import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { HiHandRaised, HiHeart, HiPhoto } from 'react-icons/hi2'
import { useSettings } from '../../../context/SettingsContext'
import { settingsService } from '../../../services/settingsService'
import { productsService } from '../../../services/productsService'
import { removeKey } from '../../../core/storage'
import { errorMessage } from '../../../core/http'
import type { ThankYouCard, WelcomeCard } from '../../../services/marketing'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import Section from './Section'

const LINKS = [
  { to: '/collection', label: 'Boutique' },
  { to: '/collection?sort=newest', label: 'Nouveautés' },
  { to: '/collection?gender=women', label: 'Femme' },
  { to: '/collection?gender=men', label: 'Homme' },
  { to: '/about', label: 'La Maison' },
]

/** Back-office → Marketing → Accueil: the first-visit welcome card and the thank-you after a payment. */
export default function WelcomeEditor() {
  const { settings, refreshSettings } = useSettings()
  const [welcome, setWelcome] = useState<WelcomeCard>(settings.welcome_card)
  const [thanks, setThanks] = useState<ThankYouCard>(settings.thank_you)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => setWelcome(settings.welcome_card), [settings.welcome_card])
  useEffect(() => setThanks(settings.thank_you), [settings.thank_you])

  const w = <K extends keyof WelcomeCard>(k: K, v: WelcomeCard[K]) => setWelcome((d) => ({ ...d, [k]: v }))
  const t = <K extends keyof ThankYouCard>(k: K, v: ThankYouCard[K]) => setThanks((d) => ({ ...d, [k]: v }))

  const upload = async (f?: File) => {
    if (!f) return
    setUploading(true)
    try {
      w('image', (await productsService.uploadFile(f, 'hero')).url)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      await settingsService.updateMany({ welcome_card: welcome, thank_you: thanks })
      await refreshSettings()
      toast.success('Messages enregistrés')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  /** Forget that this browser saw the card, then open the shop to see it as a new visitor. */
  const preview = () => {
    removeKey('welcome_card_seen')
    window.open('/', '_blank', 'noopener')
  }

  return (
    <div className="space-y-6">
      <Section
        icon={HiHandRaised}
        title="Carte de bienvenue"
        hint="Montrée une seule fois à un nouveau visiteur, quelques secondes après son arrivée (jamais pendant un achat, ni aux clients connectés)."
        actions={
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={welcome.enabled} onChange={(e) => w('enabled', e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" />
            Active
          </label>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Petit titre" value={welcome.eyebrow} onChange={(e) => w('eyebrow', e.target.value)} maxLength={60} placeholder="Bienvenue" />
          <Input label="Titre" value={welcome.title} onChange={(e) => w('title', e.target.value)} maxLength={90} />
        </div>
        <label className="block space-y-2">
          <span className="text-sm font-medium uppercase tracking-wider text-gray-300">Texte</span>
          <textarea className="field min-h-24" value={welcome.text} onChange={(e) => w('text', e.target.value)} maxLength={400} />
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Bouton" value={welcome.cta_label} onChange={(e) => w('cta_label', e.target.value)} maxLength={40} placeholder="Découvrir la collection" />
          <div>
            <Input label="Lien du bouton" value={welcome.cta_link} onChange={(e) => w('cta_link', e.target.value)} placeholder="/collection ou https://…" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {LINKS.map((l) => (
                <button key={l.to} type="button" onClick={() => w('cta_link', l.to)} className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-gray-300 hover:border-gold hover:text-gold">
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {welcome.image ? (
            <img src={welcome.image} alt="" className="h-28 w-24 rounded-xl object-cover" />
          ) : (
            <span className="flex h-28 w-24 items-center justify-center rounded-xl border border-dashed border-white/20 text-gray-500">
              <HiPhoto className="h-6 w-6" />
            </span>
          )}
          <Button size="sm" variant="outline" loading={uploading} onClick={() => file.current?.click()}>
            {welcome.image ? "Changer l'image" : 'Ajouter une image'}
          </Button>
          {welcome.image && (
            <button type="button" onClick={() => w('image', '')} className="text-xs text-gray-400 hover:text-red-400">
              Retirer
            </button>
          )}
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={welcome.newsletter} onChange={(e) => w('newsletter', e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" />
            Proposer l'inscription aux nouveautés
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-gray-300">Apparaît après {welcome.delay} s</span>
            <input type="range" min={0} max={20} value={welcome.delay} onChange={(e) => w('delay', Number(e.target.value))} className="w-full accent-[var(--color-gold)]" />
          </label>
        </div>
      </Section>

      <Section icon={HiHeart} title="Carte de remerciement" hint="Affichée dès qu'un paiement est confirmé. {prenom} est remplacé par le prénom du client.">
        <Input label="Titre" value={thanks.title} onChange={(e) => t('title', e.target.value)} maxLength={90} placeholder="Merci, {prenom}" />
        <label className="block space-y-2">
          <span className="text-sm font-medium uppercase tracking-wider text-gray-300">Message</span>
          <textarea className="field min-h-24" value={thanks.text} onChange={(e) => t('text', e.target.value)} maxLength={400} />
        </label>
        <Input label="Signature" value={thanks.signature} onChange={(e) => t('signature', e.target.value)} maxLength={60} placeholder={`La Maison ${settings.store_name}`} />
      </Section>

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" onClick={preview}>
          Revoir la carte de bienvenue
        </Button>
        <Button onClick={save} loading={saving}>
          Enregistrer
        </Button>
      </div>
    </div>
  )
}
