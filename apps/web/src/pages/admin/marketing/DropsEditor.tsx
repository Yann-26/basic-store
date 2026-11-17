import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { HiCalendarDays, HiPlus, HiPencil, HiTrash, HiPhoto } from 'react-icons/hi2'
import { dropState, type Drop } from '@trs/shared'
import { dropsService, type DropInput } from '../../../services/reviewsService'
import { productsService } from '../../../services/productsService'
import { errorMessage } from '../../../core/http'
import Button from '../../../components/ui/Button'
import Spinner from '../../../components/ui/Spinner'
import ShowcasePicker from '../ShowcasePicker'
import Section from './Section'

const STATE = {
  upcoming: { label: 'À venir', tone: 'bg-gold/15 text-gold' },
  live: { label: 'Ouvert', tone: 'bg-emerald-500/10 text-emerald-400' },
  past: { label: 'Passé', tone: 'bg-white/5 text-gray-500' },
} as const

/** <input type="datetime-local"> works in local time; the API stores ISO (UTC). */
const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const nextFriday = () => {
  const d = new Date()
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7))
  d.setHours(19, 0, 0, 0)
  return d.toISOString()
}

const EMPTY = (): DropInput => ({ title: '', description: '', image_url: null, starts_at: nextFriday(), product_ids: [], location: '', is_published: true, preorders_open: true })

/** Back-office → Marketing → Calendrier des drops: plan the releases; people who asked are emailed at the opening. */
export default function DropsEditor() {
  const [drops, setDrops] = useState<Drop[] | null>(null)
  const [form, setForm] = useState<DropInput | null>(null)
  const [editing, setEditing] = useState<Drop | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    dropsService
      .list()
      .then(setDrops)
      .catch((e) => {
        setDrops([])
        toast.error(errorMessage(e, 'Impossible de charger le calendrier'))
      })
  }, [])
  useEffect(load, [load])

  const set = <K extends keyof DropInput>(key: K, value: DropInput[K]) => setForm((f) => (f ? { ...f, [key]: value } : f))

  const open = (d?: Drop) => {
    setEditing(d ?? null)
    setForm(d ? { title: d.title, description: d.description, image_url: d.image_url, starts_at: d.starts_at, product_ids: d.product_ids, location: d.location, is_published: d.is_published, preorders_open: d.preorders_open !== false } : EMPTY())
  }

  const upload = async (f?: File) => {
    if (!f) return
    setUploading(true)
    try {
      set('image_url', (await productsService.uploadFile(f, 'hero')).url)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    if (!form) return
    setSaving(true)
    try {
      if (editing) await dropsService.update(editing.id, form)
      else await dropsService.create(form)
      toast.success(editing ? 'Drop mis à jour' : 'Drop ajouté au calendrier')
      setForm(null)
      setEditing(null)
      load()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (d: Drop) => {
    if (!window.confirm(`Supprimer « ${d.title} » du calendrier ?${d.reminders ? ` ${d.reminders} personne(s) attendent un rappel.` : ''}`)) return
    try {
      await dropsService.remove(d.id)
      load()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <Section
      icon={HiCalendarDays}
      title="Calendrier des drops"
      hint="Les drops publiés s’affichent sur l’accueil (le prochain, avec son compte à rebours) et sur la page Calendrier. Les visiteurs laissent leur email : ils reçoivent un message à l’heure d’ouverture."
      actions={
        !form && (
          <Button size="sm" icon={HiPlus} onClick={() => open()}>
            Nouveau drop
          </Button>
        )
      }
    >
      {form && (
        <div className="space-y-5 rounded-2xl border border-gold/20 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.15em] text-gray-400">Titre</span>
              <input className="field" value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={120} placeholder="Capsule 02 — Noir & or" />
            </label>
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.15em] text-gray-400">Ouverture</span>
              <input className="field" type="datetime-local" value={toLocalInput(form.starts_at)} onChange={(e) => e.target.value && set('starts_at', new Date(e.target.value).toISOString())} />
            </label>
          </div>
          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-[0.15em] text-gray-400">Description</span>
            <textarea className="field min-h-24" value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={1000} placeholder="Six pièces en série limitée, numérotées…" />
          </label>
          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-[0.15em] text-gray-400">Lieu (facultatif : pop-up, showroom…)</span>
            <input className="field" value={form.location} onChange={(e) => set('location', e.target.value)} maxLength={160} placeholder="Showroom, Cocody — Abidjan" />
          </label>

          <div className="flex flex-wrap items-center gap-4">
            {form.image_url ? (
              <img src={form.image_url} alt="" className="h-28 w-24 rounded-xl object-cover" />
            ) : (
              <span className="flex h-28 w-24 items-center justify-center rounded-xl border border-dashed border-white/20 text-gray-500">
                <HiPhoto className="h-6 w-6" />
              </span>
            )}
            <div className="space-x-2">
              <Button size="sm" variant="outline" loading={uploading} onClick={() => file.current?.click()}>
                {form.image_url ? 'Changer le visuel' : 'Ajouter un visuel'}
              </Button>
              {form.image_url && (
                <button type="button" onClick={() => set('image_url', null)} className="text-xs text-gray-400 hover:text-red-400">
                  Retirer
                </button>
              )}
            </div>
            <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          </div>

          <ShowcasePicker
            value={form.product_ids}
            onChange={(ids) => set('product_ids', ids)}
            label="Pièces du drop"
            max={24}
            emptyHint="Aucune pièce : le visuel seul est montré. Avant l’ouverture, les pièces apparaissent floutées."
            minAdvice={null}
          />

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={form.preorders_open} onChange={(e) => set('preorders_open', e.target.checked)} className="mt-1 accent-[var(--color-gold)]" />
            <span>
              Précommandes ouvertes avant la sortie
              <span className="block text-xs text-gray-500">
                Coché : les clients réservent dès maintenant en payant l’acompte, la date est celle de la sortie. Décoché : les pièces ne sont commandables qu’à la date, avec l’accès anticipé pour les inscrits.
              </span>
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_published} onChange={(e) => set('is_published', e.target.checked)} className="accent-[var(--color-gold)]" />
            Publié (visible sur la boutique)
          </label>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => (setForm(null), setEditing(null))}>
              Annuler
            </Button>
            <Button onClick={save} loading={saving} disabled={form.title.trim().length < 2}>
              {editing ? 'Enregistrer' : 'Ajouter au calendrier'}
            </Button>
          </div>
        </div>
      )}

      {drops === null ? (
        <Spinner />
      ) : drops.length === 0 ? (
        <p className="text-sm text-gray-500">Aucun drop planifié.</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {[...drops].reverse().map((d) => {
            const st = STATE[dropState(d.starts_at)]
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-4 py-4">
                {d.image_url ? <img src={d.image_url} alt="" className="h-14 w-12 rounded-lg object-cover" /> : <span className="h-14 w-12 rounded-lg bg-dark-700" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{d.title}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(d.starts_at).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })} · {d.product_ids.length} pièce(s) · {d.reminders ?? 0} rappel(s)
                  </p>
                </div>
                <span className={clsx('rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.15em]', d.is_published ? st.tone : 'bg-white/5 text-gray-500')}>{d.is_published ? st.label : 'Brouillon'}</span>
                <button type="button" onClick={() => open(d)} className="rounded-lg p-2 text-gray-400 hover:text-gold" aria-label={`Modifier ${d.title}`}>
                  <HiPencil className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => remove(d)} className="rounded-lg p-2 text-gray-400 hover:text-red-400" aria-label={`Supprimer ${d.title}`}>
                  <HiTrash className="h-4 w-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}
