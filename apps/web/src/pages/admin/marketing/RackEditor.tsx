import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { HiArrowDown, HiArrowUp, HiPhoto, HiRectangleStack, HiTrash } from 'react-icons/hi2'
import type { Product } from '@trs/shared'
import { useSettings } from '../../../context/SettingsContext'
import { settingsService } from '../../../services/settingsService'
import { productsService } from '../../../services/productsService'
import { errorMessage } from '../../../core/http'
import type { Rack, RackItem } from '../../../services/marketing'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import Section from './Section'

const MAX_ITEMS = 12
const newId = () => `rack-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/**
 * "Le portant" of the home page, set by hand: the photos hung on the rail (cut out on a white or
 * transparent background), each with the piece it opens on click, and an optional back view.
 */
export default function RackEditor({ products }: { products: Product[] }) {
  const { settings, refreshSettings } = useSettings()
  const [draft, setDraft] = useState<Rack>(settings.rack)
  const [uploading, setUploading] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => setDraft(settings.rack), [settings.rack])

  const setItem = (id: string, patch: Partial<RackItem>) => setDraft((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }))
  const move = (index: number, dir: -1 | 1) =>
    setDraft((d) => {
      const items = [...d.items]
      const j = index + dir
      if (j < 0 || j >= items.length) return d
      ;[items[index], items[j]] = [items[j]!, items[index]!]
      return { ...d, items }
    })

  const addPhotos = async (files: FileList) => {
    const list = [...files].slice(0, MAX_ITEMS - draft.items.length)
    if (list.length === 0) return toast.error(`${MAX_ITEMS} pièces maximum sur le portant`)
    setUploading('new')
    const added: RackItem[] = []
    for (const file of list) {
      try {
        const { url } = await productsService.uploadFile(file, 'hero')
        added.push({ id: newId(), image: url, back_image: '', product_id: '' })
      } catch (e) {
        toast.error(`${file.name} : ${errorMessage(e)}`)
      }
    }
    setUploading(null)
    setDraft((d) => ({ ...d, items: [...d.items, ...added] }))
  }

  const uploadBack = async (id: string, file: File) => {
    setUploading(id)
    try {
      const { url } = await productsService.uploadFile(file, 'hero')
      setItem(id, { back_image: url })
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setUploading(null)
    }
  }

  const save = async () => {
    const unlinked = draft.items.filter((i) => !i.product_id).length
    if (unlinked > 0) return toast.error(`Choisissez la pièce liée à ${unlinked > 1 ? `${unlinked} photos` : 'chaque photo'}`)
    setSaving(true)
    try {
      await settingsService.updateMany({ rack: draft })
      await refreshSettings()
      toast.success('Portant publié')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section
      icon={HiRectangleStack}
      title="Le portant"
      hint="Les pièces suspendues sur le portant de l'accueil. Téléversez une photo par pièce, détourée sur fond blanc ou transparent, cadrée de la même façon (le crochet en haut), et choisissez la pièce qui s'ouvre au clic. Ajoutez une photo de dos pour le bouton Face / Dos. Sans photo ici, le portant montre les dernières pièces avec leur photo principale."
      actions={
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))} className="h-4 w-4 accent-[var(--color-gold)]" />
          Afficher sur l'accueil
        </label>
      }
    >
      <Input label="Titre" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} maxLength={60} />

      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gold/60 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-gold hover:bg-gold hover:text-primary-black">
        <HiPhoto className="h-4 w-4" /> {uploading === 'new' ? 'Envoi…' : 'Ajouter des photos'}
        <input type="file" accept="image/*" multiple className="hidden" disabled={uploading !== null} onChange={(e) => e.target.files && void addPhotos(e.target.files)} />
      </label>

      {draft.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-gray-500">
          Aucune photo : le portant montre les dernières pièces de la boutique.
        </p>
      ) : (
        <ol className="space-y-4">
          {draft.items.map((item, i) => (
            <li key={item.id} className="grid gap-4 rounded-2xl bg-dark-700 p-4 md:grid-cols-[7rem_7rem_1fr_auto]">
              <figure>
                <img src={item.image} alt="" className="aspect-[3/4] w-28 rounded-xl bg-white object-contain" />
                <figcaption className="mt-1 text-center text-[10px] uppercase tracking-[0.15em] text-gray-500">Face</figcaption>
              </figure>
              <figure>
                <label className="flex aspect-[3/4] w-28 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-white/5 hover:border-gold">
                  {item.back_image ? (
                    <img src={item.back_image} alt="" className="h-full w-full bg-white object-contain" />
                  ) : (
                    <span className="px-2 text-center text-[11px] text-gray-500">{uploading === item.id ? 'Envoi…' : '+ Dos (optionnel)'}</span>
                  )}
                  <input type="file" accept="image/*" className="hidden" disabled={uploading !== null} onChange={(e) => e.target.files?.[0] && void uploadBack(item.id, e.target.files[0])} />
                </label>
                <figcaption className="mt-1 text-center text-[10px] uppercase tracking-[0.15em] text-gray-500">
                  {item.back_image ? (
                    <button type="button" onClick={() => setItem(item.id, { back_image: '' })} className="hover:text-red-400">
                      Retirer le dos
                    </button>
                  ) : (
                    'Dos'
                  )}
                </figcaption>
              </figure>
              <div className="min-w-0 space-y-1.5">
                <label htmlFor={`rack-product-${item.id}`} className="block text-[11px] uppercase tracking-[0.15em] text-gray-400">
                  Pièce ouverte au clic
                </label>
                <select
                  id={`rack-product-${item.id}`}
                  value={item.product_id}
                  onChange={(e) => setItem(item.id, { product_id: e.target.value })}
                  className={`field ${item.product_id ? '' : 'border-amber-400/60'}`}
                >
                  <option value="">— Choisir une pièce —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">Nom, prix, tailles et ajout au panier viennent de cette pièce. Seules les pièces actives sont proposées.</p>
              </div>
              <div className="flex gap-1 md:flex-col">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-full p-2 text-gray-400 hover:text-white disabled:opacity-30" aria-label="Monter">
                  <HiArrowUp className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === draft.items.length - 1} className="rounded-full p-2 text-gray-400 hover:text-white disabled:opacity-30" aria-label="Descendre">
                  <HiArrowDown className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setDraft((d) => ({ ...d, items: d.items.filter((x) => x.id !== item.id) }))} className="rounded-full p-2 text-gray-400 hover:text-red-400" aria-label="Retirer">
                  <HiTrash className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>
          Publier le portant
        </Button>
      </div>
    </Section>
  )
}
