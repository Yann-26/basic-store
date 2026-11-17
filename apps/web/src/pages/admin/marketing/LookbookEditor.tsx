import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { HiArrowDown, HiArrowUp, HiCamera, HiPhoto, HiTrash } from 'react-icons/hi2'
import type { Product } from '@trs/shared'
import { useSettings } from '../../../context/SettingsContext'
import { settingsService } from '../../../services/settingsService'
import { productsService } from '../../../services/productsService'
import { errorMessage } from '../../../core/http'
import type { Lookbook, LookbookShoot } from '../../../services/marketing'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import Section from './Section'

const newId = () => `look-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** Lookbook of the home page: the shooting photos, each with the pieces worn in it. */
export default function LookbookEditor({ products }: { products: Product[] }) {
  const { settings, refreshSettings } = useSettings()
  const [draft, setDraft] = useState<Lookbook>(settings.lookbook)
  const [uploading, setUploading] = useState(0)
  const [saving, setSaving] = useState(false)
  useEffect(() => setDraft(settings.lookbook), [settings.lookbook])

  const setShoot = (id: string, patch: Partial<LookbookShoot>) => setDraft((d) => ({ ...d, shoots: d.shoots.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))
  const move = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const shoots = [...d.shoots]
      const j = i + dir
      if (j < 0 || j >= shoots.length) return d
      ;[shoots[i], shoots[j]] = [shoots[j]!, shoots[i]!]
      return { ...d, shoots }
    })

  const addPhotos = async (files: FileList) => {
    const list = [...files]
    setUploading(list.length)
    const added: LookbookShoot[] = []
    for (const file of list) {
      try {
        const { url } = await productsService.uploadFile(file, 'hero')
        added.push({ id: newId(), image: url, title: '', caption: '', product_ids: [] })
      } catch (e) {
        toast.error(`${file.name} : ${errorMessage(e)}`)
      }
      setUploading((n) => n - 1)
    }
    setDraft((d) => ({ ...d, shoots: [...d.shoots, ...added] }))
  }

  const save = async () => {
    setSaving(true)
    try {
      await settingsService.updateMany({ lookbook: draft })
      await refreshSettings()
      toast.success('Lookbook publié')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section
      icon={HiCamera}
      title="Lookbook — le shooting"
      hint="Les photos de vos shootings, sur l'accueil, après les nouveautés : une photo seule s'affiche en grand, plusieurs côte à côte. Indiquez les pièces portées : elles deviennent des liens vers leur fiche."
      actions={
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))} className="h-4 w-4 accent-[var(--color-gold)]" />
          Afficher sur l'accueil
        </label>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Input label="Titre" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
        <Input label="Sous-titre" value={draft.subtitle} onChange={(e) => setDraft((d) => ({ ...d, subtitle: e.target.value }))} />
      </div>

      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gold/60 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-gold hover:bg-gold hover:text-primary-black">
        <HiPhoto className="h-4 w-4" /> {uploading > 0 ? `Envoi… (${uploading} restantes)` : 'Ajouter des photos'}
        <input type="file" accept="image/*" multiple className="hidden" disabled={uploading > 0} onChange={(e) => e.target.files && void addPhotos(e.target.files)} />
      </label>

      {draft.shoots.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-gray-500">Aucune photo : la section reste cachée sur l'accueil.</p>
      ) : (
        <ol className="space-y-4">
          {draft.shoots.map((s, i) => (
            <li key={s.id} className="grid gap-4 rounded-2xl bg-dark-700 p-4 md:grid-cols-[8rem_1fr_auto]">
              <img src={s.image} alt="" className="aspect-[3/4] w-32 rounded-xl object-cover" />
              <div className="min-w-0 space-y-3">
                <input value={s.title} onChange={(e) => setShoot(s.id, { title: e.target.value })} placeholder={`Look ${String(i + 1).padStart(2, '0')} — titre`} className="field" aria-label="Titre du look" />
                <textarea value={s.caption} onChange={(e) => setShoot(s.id, { caption: e.target.value })} placeholder="Une phrase sur le look (lieu, occasion…)" rows={2} className="field resize-none" aria-label="Légende" />
                <div>
                  <p className="mb-2 text-[11px] uppercase tracking-[0.15em] text-gray-400">Pièces portées</p>
                  <div className="flex flex-wrap gap-2">
                    {products.map((p) => {
                      const on = s.product_ids.includes(p.id)
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setShoot(s.id, { product_ids: on ? s.product_ids.filter((x) => x !== p.id) : [...s.product_ids, p.id] })}
                          className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? 'border-gold bg-gold/15 text-gold' : 'border-white/10 text-gray-400 hover:border-white/30'}`}
                          aria-pressed={on}
                        >
                          {p.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="flex gap-1 md:flex-col">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-full p-2 text-gray-400 hover:text-white disabled:opacity-30" aria-label="Monter">
                  <HiArrowUp className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === draft.shoots.length - 1} className="rounded-full p-2 text-gray-400 hover:text-white disabled:opacity-30" aria-label="Descendre">
                  <HiArrowDown className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setDraft((d) => ({ ...d, shoots: d.shoots.filter((x) => x.id !== s.id) }))} className="rounded-full p-2 text-gray-400 hover:text-red-400" aria-label="Retirer">
                  <HiTrash className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>
          Publier le lookbook
        </Button>
      </div>
    </Section>
  )
}
