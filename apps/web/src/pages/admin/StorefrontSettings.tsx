import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { HiPhoto, HiSparkles, HiMagnifyingGlass, HiMegaphone, HiRectangleGroup, HiChatBubbleLeftEllipsis } from 'react-icons/hi2'
import { useSettings } from '../../context/SettingsContext'
import { settingsService } from '../../services/settingsService'
import { productsService } from '../../services/productsService'
import { errorMessage } from '../../core/http'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import SpotlightEditor from './SpotlightEditor'

const KEYS = [
  'storefront_theme',
  'announcement_text',
  'hero_title',
  'hero_subtitle',
  'hero_cta_primary',
  'hero_cta_secondary',
  'hero_background_desktop',
  'hero_background_mobile',
  'seo_title',
  'seo_description',
  'seo_keywords',
  'hero_ad_enabled',
  'hero_ad_desktop',
  'hero_ad_mobile',
  'hero_ad_link',
  'hero_ad_alt',
  'hero_ad_position',
  'founder_name',
  'founder_role',
  'founder_photo',
  'founder_message',
] as const

const founderDraft = (store: string) => `Quand j’ai créé ${store}, je voulais que chacun puisse porter, ici en Côte d’Ivoire, les pièces qu’il voyait ailleurs : authentiques, choisies avec soin, sans compromis.

Chaque paire, chaque vêtement passe entre nos mains avant d’arriver chez vous. Vous nous faites confiance, et cette confiance, nous la méritons à chaque commande.

Merci de faire partie du Cercle. Ensemble, faisons briller votre style.`
type Key = (typeof KEYS)[number]

function Card({ icon: Icon, title, children }: { icon: typeof HiPhoto; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5 rounded-2xl border border-white/5 bg-dark-800 p-6 md:p-8">
      <h2 className="flex items-center gap-3 font-sans text-sm font-semibold uppercase tracking-[0.15em]">
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/40">
          <Icon className="h-4 w-4 text-gold" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}

/** Hero, announcement bar and SEO — everything a merchandiser changes weekly. */
export default function StorefrontSettings() {
  const { settings, refreshSettings } = useSettings()
  const [values, setValues] = useState<Record<Key, string>>(() => Object.fromEntries(KEYS.map((k) => [k, String(settings[k] ?? '')])) as Record<Key, string>)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<Key | null>(null)

  useEffect(() => {
    setValues(Object.fromEntries(KEYS.map((k) => [k, String(settings[k] ?? '')])) as Record<Key, string>)
  }, [settings])

  const set = (k: Key) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((v) => ({ ...v, [k]: e.target.value }))

  const upload = async (k: Key, file: File) => {
    setUploading(k)
    try {
      const { url } = await productsService.uploadFile(file, k === 'founder_photo' ? 'settings' : 'hero')
      setValues((v) => ({ ...v, [k]: url }))
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setUploading(null)
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      await settingsService.updateMany(values)
      await refreshSettings()
      toast.success('Vitrine mise à jour')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const imageField = (k: Key, label: string) => (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-gray-300">{label}</p>
      <label className="flex aspect-video cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-dark-700 hover:border-gold">
        {uploading === k ? (
          <Spinner size="sm" />
        ) : values[k] ? (
          <img src={values[k]} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-xs text-gray-500">
            <HiPhoto className="h-7 w-7" /> Téléverser
          </span>
        )}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(k, e.target.files[0])} />
      </label>
      {values[k] && (
        <button onClick={() => setValues((v) => ({ ...v, [k]: '' }))} className="mt-2 text-xs text-gray-500 hover:text-red-400">
          Retirer l'image
        </button>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <Card icon={HiSparkles} title="Style de la boutique">
        <fieldset>
          <legend className="mb-3 text-sm text-gray-400">Le style de toutes les pages de la boutique (le tableau de bord ne change pas).</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { id: 'dark', name: 'Noir et or', hint: 'La charte de la marque : fond noir, accents or.' },
              { id: 'light', name: 'Clair', hint: 'Noir sur blanc, accents noirs, très épuré.' },
            ].map((t) => (
              <label key={t.id} className={`cursor-pointer rounded-2xl border p-4 transition ${values.storefront_theme === t.id ? 'border-gold bg-dark-700' : 'border-white/10 hover:border-gold/50'}`}>
                <input type="radio" name="storefront-theme" value={t.id} checked={values.storefront_theme === t.id} onChange={() => setValues((v) => ({ ...v, storefront_theme: t.id }))} className="sr-only" />
                <span className="block text-sm font-semibold">{t.name}</span>
                <span className="block text-xs text-gray-400">{t.hint}</span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">Pensez à enregistrer en bas de la page.</p>
        </fieldset>
      </Card>

      <SpotlightEditor />

      <Card icon={HiMegaphone} title="Bandeau d'annonce">
        <Input label="Texte défilant" value={values.announcement_text} onChange={set('announcement_text')} hint="Laissez vide pour masquer le bandeau." />
      </Card>

      <Card icon={HiSparkles} title="Hero de la page d'accueil">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-[0.15em] text-gray-300">Titre</label>
          <textarea rows={2} value={values.hero_title} onChange={set('hero_title')} className="field resize-none" />
          <p className="text-xs text-gray-500">La 2ᵉ ligne s'affiche en or italique.</p>
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-[0.15em] text-gray-300">Sous-titre</label>
          <textarea rows={2} value={values.hero_subtitle} onChange={set('hero_subtitle')} className="field resize-none" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Bouton principal" value={values.hero_cta_primary} onChange={set('hero_cta_primary')} />
          <Input label="Bouton secondaire" value={values.hero_cta_secondary} onChange={set('hero_cta_secondary')} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {imageField('hero_background_desktop', 'Visuel (ordinateur)')}
          {imageField('hero_background_mobile', 'Visuel (mobile, optionnel)')}
        </div>
      </Card>

      <Card icon={HiRectangleGroup} title="Publicité du hero">
        <p className="text-sm text-gray-400">
          Un visuel publicitaire (promo, nouvelle collection…) affiché en plein écran en haut de l’accueil. Formats conseillés : 1920 × 1080 px pour ordinateur et 1080 × 1920 px pour téléphone. Un visuel d’un autre format est rogné sur les bords pour remplir l’écran : gardez le texte vers le centre.
        </p>
        <label className="flex cursor-pointer items-center justify-between rounded-xl bg-dark-700 p-4">
          <span>
            <span className="block text-sm font-medium">Afficher la publicité</span>
            <span className="block text-xs text-gray-400">Désactivée : les visuels restent enregistrés mais ne s’affichent pas sur la boutique.</span>
          </span>
          <input
            type="checkbox"
            checked={values.hero_ad_enabled === 'true'}
            onChange={(e) => setValues((v) => ({ ...v, hero_ad_enabled: e.target.checked ? 'true' : 'false' }))}
            className="h-5 w-5 accent-[var(--color-gold)]"
          />
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          {imageField('hero_ad_desktop', 'Visuel publicitaire (ordinateur)')}
          {imageField('hero_ad_mobile', 'Visuel publicitaire (mobile, optionnel)')}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Lien au clic (optionnel)" value={values.hero_ad_link} onChange={set('hero_ad_link')} placeholder="/exclusivites ou https://…" hint="Une page du site (/collection…) ou une adresse https." />
          <Input label="Texte alternatif" value={values.hero_ad_alt} onChange={set('hero_ad_alt')} placeholder="Ex : -20 % sur les Air Jordan" hint="Lu par les lecteurs d’écran et Google." />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-[0.15em] text-gray-300">Emplacement</label>
          <select value={values.hero_ad_position || 'above'} onChange={(e) => setValues((v) => ({ ...v, hero_ad_position: e.target.value }))} className="field">
            <option value="above">Au-dessus du hero (le hero reste affiché)</option>
            <option value="replace">À la place du hero</option>
          </select>
        </div>
      </Card>

      <Card icon={HiChatBubbleLeftEllipsis} title="Mot du fondateur">
        <p className="text-sm text-gray-400">Affiché sur la page À propos dès que le message est rempli.</p>
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          {imageField('founder_photo', 'Votre photo (portrait)')}
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Input label="Votre nom" value={values.founder_name} onChange={set('founder_name')} placeholder="Ex : Yann Assiri" />
              <Input label="Titre" value={values.founder_role} onChange={set('founder_role')} placeholder="Fondateur" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium uppercase tracking-[0.15em] text-gray-300">Votre message</label>
                {!values.founder_message && (
                  <button type="button" onClick={() => setValues((v) => ({ ...v, founder_message: founderDraft(settings.store_name) }))} className="text-xs text-gold hover:underline">
                    Partir d’un brouillon
                  </button>
                )}
              </div>
              <textarea rows={9} value={values.founder_message} onChange={set('founder_message')} className="field" placeholder="Votre histoire, votre vision, votre promesse aux clients…" />
              <p className="text-xs text-gray-500">Laissez une ligne vide entre deux paragraphes. Section masquée tant que le message est vide.</p>
            </div>
          </div>
        </div>
      </Card>

      <Card icon={HiMagnifyingGlass} title="Référencement (SEO)">
        <Input label="Titre de la page d'accueil" value={values.seo_title} onChange={set('seo_title')} maxLength={70} hint={`${values.seo_title.length}/70`} />
        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-[0.15em] text-gray-300">Description</label>
          <textarea rows={3} value={values.seo_description} onChange={set('seo_description')} className="field resize-none" maxLength={160} />
          <p className="text-xs text-gray-500">{values.seo_description.length}/160</p>
        </div>
        <Input label="Mots-clés" value={values.seo_keywords} onChange={set('seo_keywords')} />
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>
          Enregistrer la vitrine
        </Button>
      </div>
    </div>
  )
}
