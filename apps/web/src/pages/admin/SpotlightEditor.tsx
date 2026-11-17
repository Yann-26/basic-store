import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { HiSparkles } from 'react-icons/hi2'
import type { Product } from '@trs/shared'
import { useSettings } from '../../context/SettingsContext'
import { settingsService } from '../../services/settingsService'
import { productsService } from '../../services/productsService'
import { errorMessage } from '../../core/http'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import ImageUpload from './ImageUpload'

/** ISO date ⇄ the value of an <input type="datetime-local"> (local time). */
const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const fromLocalInput = (value: string) => {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

const LAYOUTS = [
  { id: 'maison', name: 'Maison', hint: 'La pièce plein écran, sobre et lumineuse.' },
  { id: 'launch', name: 'Lancement', hint: 'Compte à rebours avant la sortie, pour les précommandes.' },
] as const

/** "Pièce à l'honneur": the exclusive piece shown full screen on top of the home page. */
export default function SpotlightEditor() {
  const { settings, refreshSettings } = useSettings()
  const [enabled, setEnabled] = useState(settings.spotlight_enabled)
  const [layout, setLayout] = useState(settings.spotlight_layout)
  const [slug, setSlug] = useState(settings.spotlight_product_slug)
  const [eyebrow, setEyebrow] = useState(settings.spotlight_eyebrow)
  const [title, setTitle] = useState(settings.spotlight_title)
  const [text, setText] = useState(settings.spotlight_text)
  const [cta, setCta] = useState(settings.spotlight_cta_label)
  const [launchAt, setLaunchAt] = useState(settings.spotlight_launch_at)
  const [photo, setPhoto] = useState(settings.spotlight_photo)
  const [products, setProducts] = useState<Product[] | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    productsService.getAll().then(setProducts).catch(() => setProducts([]))
  }, [])

  const save = async () => {
    if (enabled && !slug) {
      toast.error('Choisissez la pièce à exposer')
      return
    }
    setSaving(true)
    try {
      await settingsService.updateMany({
        spotlight_enabled: enabled,
        spotlight_layout: layout,
        spotlight_product_slug: slug,
        spotlight_eyebrow: eyebrow,
        spotlight_title: title,
        spotlight_text: text,
        spotlight_cta_label: cta,
        spotlight_launch_at: launchAt,
        spotlight_photo: photo,
      })
      await refreshSettings()
      toast.success('Pièce à l’honneur publiée')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-6 rounded-2xl border border-gold/30 bg-dark-800 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-3 font-sans text-sm font-semibold uppercase tracking-[0.15em]">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/40">
            <HiSparkles className="h-4 w-4 text-gold" />
          </span>
          Pièce à l'honneur (première page)
        </h2>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" />
          Afficher sur l'accueil
        </label>
      </div>
      <p className="text-sm text-gray-400">
        Une pièce exposée en grand quand le client ouvre la boutique : il peut la faire tourner, puis défiler vers la collection. Désactivé, l'accueil classique s'affiche.
      </p>

      <fieldset>
        <legend className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-gray-300">Mise en page</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {LAYOUTS.map((l) => (
            <label key={l.id} className={`cursor-pointer rounded-2xl border p-4 transition ${layout === l.id ? 'border-gold bg-dark-700' : 'border-white/10 hover:border-gold/50'}`}>
              <input type="radio" name="spotlight-layout" value={l.id} checked={layout === l.id} onChange={() => setLayout(l.id)} className="sr-only" />
              <span className="block text-sm font-semibold">{l.name}</span>
              <span className="block text-xs text-gray-400">{l.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="spotlight-product" className="mb-2 block text-xs font-medium uppercase tracking-[0.15em] text-gray-300">
          Pièce exposée
        </label>
        {products ? (
          <select id="spotlight-product" value={slug} onChange={(e) => setSlug(e.target.value)} className="field">
            <option value="">— Choisir un produit —</option>
            {products.filter((p) => p.is_active).map((p) => (
              <option key={p.id} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        ) : (
          <Spinner size="sm" />
        )}
        <p className="mt-2 text-xs text-gray-500">Le nom, le prix et le lien viennent de la fiche produit.</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Input label="Surtitre" value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} />
        <Input label="Texte du bouton" value={cta} onChange={(e) => setCta(e.target.value)} />
        <Input label="Titre (sinon : nom du produit)" value={title} onChange={(e) => setTitle(e.target.value)} />
        {layout === 'launch' && (
          <div>
            <label htmlFor="spotlight-launch" className="mb-1 block text-sm font-medium uppercase tracking-wider text-gray-300">
              Date du lancement
            </label>
            <input id="spotlight-launch" type="datetime-local" value={toLocalInput(launchAt)} onChange={(e) => setLaunchAt(fromLocalInput(e.target.value))} className="field" />
          </div>
        )}
      </div>
      <div>
        <label htmlFor="spotlight-text" className="mb-1 block text-xs font-medium uppercase tracking-[0.15em] text-gray-300">
          Texte de présentation (sinon : description du produit)
        </label>
        <textarea id="spotlight-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} className="field resize-none" />
      </div>

      <ImageUpload label="Photo d’ouverture" value={photo} onChange={setPhoto} hint="Une photo en largeur, plein écran en haut de l’accueil. Sinon : photo principale du produit." folder="hero" />

      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>
          Publier
        </Button>
      </div>
    </section>
  )
}
