import FramesField from './FramesField'
import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  HiPlus,
  HiPencil,
  HiCube,
  HiTrash,
  HiMagnifyingGlass,
  HiPhoto,
  HiStar,
  HiXMark,
  HiArrowLeft,
  HiArrowRight,
  HiVideoCamera,
  HiSparkles,
} from 'react-icons/hi2'
import {
  GENDERS,
  PRODUCT_CATEGORIES,
  SIZE_SYSTEMS,
  discountPercent,
  formatCurrency,
  getCategory,
  type Collection,
  type Exclusive,
  type Gender,
  type Product,
  type ProductCategoryId,
  type ProductStatus,
  sameColor,
} from '@trs/shared'
import { productsService, type ProductPayload } from '../../services/productsService'
import { catalogService } from '../../services/catalogService'
import { errorMessage } from '../../core/http'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'

interface MediaDraft {
  /** Server id for existing media, local id for new files. */
  id: string
  file: File | null
  preview: string
  type: 'image' | 'video'
  isMain: boolean
  /** Colour this photo shows (null: every colour). */
  color: string | null
  /** As saved on the server, to only send changes. */
  savedColor: string | null
}

/** An ISO date as the value of a datetime-local field, in the browser's time zone. */
function toLocalInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface FormState {
  name: string
  description: string
  price: string
  compare_at_price: string
  category: ProductCategoryId
  subcategory: string
  gender: Gender
  collection_id: string
  is_exclusive: boolean
  exclusive_id: string
  status: ProductStatus
  stock: string
  sizes: string[]
  colors: string[]
  materials: string
  features: string[]
  tags: string[]
  is_featured: boolean
  is_active: boolean
  /** Email the subscribers when the piece is published. */
  notify_subscribers: boolean
  /** Turntable photos: the storefront lets the visitor turn the piece. */
  spin_frames: string[]
  release_date: string
  /** Pieces to sell before the series is made; empty: no gauge. */
  series_size: string
  preorder_goal: string
  /** datetime-local value (the admin's time zone). */
  preorder_deadline: string
  media: MediaDraft[]
}

const EMPTY: FormState = {
  name: '',
  description: '',
  price: '',
  compare_at_price: '',
  category: 'clothing',
  subcategory: '',
  gender: 'unisex',
  collection_id: '',
  is_exclusive: false,
  exclusive_id: '',
  status: 'available',
  stock: '0',
  sizes: [],
  colors: [],
  materials: '',
  features: [],
  tags: [],
  is_featured: false,
  is_active: true,
  notify_subscribers: true,
  spin_frames: [],
  release_date: '',
  series_size: '',
  preorder_goal: '',
  preorder_deadline: '',
  media: [],
}

const STATUS_LABELS: Record<ProductStatus, string> = { available: 'Disponible', limited: 'Édition limitée', unavailable: 'Indisponible' }
const STEPS = ['Informations', 'Variantes', 'Médias', 'Détails']
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

/** Photos not linked to one of the product's colours (only matters with 2+ colours). */
const untaggedPhotos = (colors: string[], media: { color?: string | null }[]) =>
  colors.length > 1 ? media.filter((m) => !colors.some((c) => sameColor(c, m.color))).length : 0

const sameColorOrBothEmpty = (a: string | null, b: string | null) => (!a && !b) || sameColor(a, b)

function toForm(p: Product): FormState {
  return {
    name: p.name,
    description: p.description ?? '',
    price: String(p.price),
    compare_at_price: p.compare_at_price ? String(p.compare_at_price) : '',
    category: p.category,
    subcategory: p.subcategory ?? '',
    gender: p.gender ?? 'unisex',
    collection_id: p.collection_id ?? '',
    is_exclusive: !!p.is_exclusive,
    exclusive_id: p.exclusive_id ?? '',
    status: p.status,
    stock: String(p.stock ?? 0),
    sizes: p.sizes,
    colors: p.colors,
    materials: p.materials ?? '',
    features: p.features,
    tags: p.tags ?? [],
    is_featured: !!p.is_featured,
    is_active: p.is_active,
    notify_subscribers: true,
    spin_frames: p.spin_frames ?? [],
    release_date: p.release_date ?? '',
    series_size: p.series_size ? String(p.series_size) : '',
    preorder_goal: p.preorder_goal ? String(p.preorder_goal) : '',
    preorder_deadline: toLocalInput(p.preorder_deadline),
    media: (p.product_media ?? []).map((m) => ({ id: m.id, file: null, preview: m.file_path, type: m.media_type, isMain: m.is_main, color: m.color ?? null, savedColor: m.color ?? null })),
  }
}

function ChipsInput({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const v = draft.trim()
    if (v && !values.includes(v)) onChange([...values, v])
    setDraft('')
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-[0.15em] text-gray-300">{label}</p>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
          className="field"
        />
        <Button variant="outline" size="sm" onClick={add}>
          Ajouter
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-xs">
              {v}
              <button onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Retirer ${v}`} className="text-gray-500 hover:text-red-400">
                <HiXMark className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [exclusives, setExclusives] = useState<Exclusive[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'' | ProductCategoryId>('')
  const [editing, setEditing] = useState<Product | null>(null)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [customSize, setCustomSize] = useState('')
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    try {
      setProducts(await productsService.getAll())
    } catch (e) {
      toast.error(errorMessage(e, 'Erreur de chargement des produits'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    Promise.all([catalogService.getAllCollections(), catalogService.getAllExclusives()])
      .then(([c, x]) => {
        setCollections(c)
        setExclusives(x)
      })
      .catch(() => undefined)
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter(
      (p) =>
        (!categoryFilter || p.category === categoryFilter) &&
        (!q || p.name.toLowerCase().includes(q) || (p.subcategory ?? '').toLowerCase().includes(q) || (p.collection?.name ?? '').toLowerCase().includes(q)),
    )
  }, [products, search, categoryFilter])

  const category = getCategory(form.category)!
  const sizeSystem = SIZE_SYSTEMS[category.sizeSystem]
  const suggestedSizes = form.gender === 'kids' && category.sizeSystem === 'apparel' ? SIZE_SYSTEMS.kids.sizes : sizeSystem.sizes
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const startCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setStep(0)
    setOpen(true)
  }

  const startEdit = (p: Product, atStep = 0) => {
    setEditing(p)
    setForm(toForm(p))
    setStep(atStep)
    setOpen(true)
  }

  const addFiles = (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const isImage = IMAGE_TYPES.includes(file.type)
      const isVideo = VIDEO_TYPES.includes(file.type)
      if (!isImage && !isVideo) {
        toast.error(`${file.name} : format non supporté`)
        continue
      }
      if (file.size > (isVideo ? 100 : 10) * 1024 * 1024) {
        toast.error(`${file.name} : fichier trop lourd`)
        continue
      }
      setForm((f) => ({
        ...f,
        media: [
          ...f.media,
          {
            id: `local-${crypto.randomUUID()}`,
            file,
            preview: URL.createObjectURL(file),
            type: isVideo ? 'video' : 'image',
            isMain: isImage && !f.media.some((m) => m.isMain),
            color: null,
            savedColor: null,
          },
        ],
      }))
    }
  }

  const removeMedia = async (m: MediaDraft) => {
    if (!m.file) {
      if (!confirm('Supprimer définitivement ce média ?')) return
      try {
        await productsService.deleteMedia(m.id)
      } catch (e) {
        return toast.error(errorMessage(e))
      }
    }
    setForm((f) => {
      const media = f.media.filter((x) => x.id !== m.id)
      if (m.isMain) {
        const next = media.find((x) => x.type === 'image')
        if (next) next.isMain = true
      }
      return { ...f, media }
    })
  }

  const setMediaColor = (m: MediaDraft, color: string | null) => setForm((f) => ({ ...f, media: f.media.map((x) => (x.id === m.id ? { ...x, color } : x)) }))

  const makeMain = (m: MediaDraft) => setForm((f) => ({ ...f, media: f.media.map((x) => ({ ...x, isMain: x.id === m.id })) }))

  const validate = (): string | null => {
    if (form.name.trim().length < 2) return 'Nom requis (2 caractères min.)'
    if (!(Number(form.price) >= 100)) return 'Prix invalide (min. 100 FCFA)'
    if (form.compare_at_price && Number(form.compare_at_price) <= Number(form.price)) return 'Le prix barré doit être supérieur au prix de vente'
    return null
  }

  const save = async () => {
    const problem = validate()
    if (problem) {
      toast.error(problem)
      setStep(0)
      return
    }
    setSaving(true)
    try {
      const payload: ProductPayload = {
        name: form.name.trim(),
        description: form.description,
        price: Number(form.price),
        compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
        category: form.category,
        subcategory: form.subcategory || null,
        gender: form.gender,
        collection_id: form.collection_id || null,
        is_exclusive: form.is_exclusive,
        exclusive_id: form.is_exclusive ? form.exclusive_id || null : null,
        status: form.status,
        stock: Number(form.stock) || 0,
        sizes: category.sizeSystem === 'one-size' && form.sizes.length === 0 ? [] : form.sizes,
        colors: form.colors,
        materials: form.materials || null,
        features: form.features,
        tags: form.tags,
        is_featured: form.is_featured,
        is_active: form.is_active,
        release_date: form.release_date || null,
        series_size: Number(form.series_size) > 0 ? Math.round(Number(form.series_size)) : null,
        preorder_goal: Number(form.preorder_goal) > 0 ? Math.round(Number(form.preorder_goal)) : null,
        preorder_deadline: form.preorder_deadline ? new Date(form.preorder_deadline).toISOString() : null,
        notify_subscribers: form.notify_subscribers,
        // Only sent when used, so shops that never turn a piece keep working before the column exists.
        ...(form.spin_frames.length > 0 || editing?.spin_frames?.length ? { spin_frames: form.spin_frames } : {}),
      }
      const saved = editing ? await productsService.update(editing.id, payload) : await productsService.create(payload)

      // Upload new files, then sync the main image choice.
      let mainId = form.media.find((m) => m.isMain && !m.file)?.id
      // A colour removed from the product frees its photos (shown for every colour).
      const colorOf = (m: MediaDraft) => (m.color && form.colors.some((c) => sameColor(c, m.color)) ? m.color : null)
      for (const m of form.media.filter((x) => x.file)) {
        const res = await productsService.uploadMedia(saved.id, m.file!, m.type, m.isMain, colorOf(m))
        if (m.isMain && res.mediaId) mainId = res.mediaId
      }
      for (const m of form.media.filter((x) => !x.file && !sameColorOrBothEmpty(colorOf(x), x.savedColor))) {
        await productsService.setMediaColor(m.id, colorOf(m))
      }
      const originalMain = editing?.product_media?.find((m) => m.is_main)?.id
      if (mainId && mainId !== originalMain && !form.media.find((m) => m.isMain)?.file) {
        await productsService.setMainImage(saved.id, mainId)
      }

      toast.success(editing ? 'Produit mis à jour' : 'Produit créé')
      setOpen(false)
      void load()
    } catch (e) {
      toast.error(errorMessage(e, 'Erreur lors de la sauvegarde'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (p: Product) => {
    if (!confirm(`Supprimer « ${p.name} » ?`)) return
    try {
      const res = await productsService.delete(p.id)
      toast.success(res?.message ?? 'Produit supprimé')
      void load()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const quickToggle = async (p: Product, patch: ProductPayload) => {
    try {
      const updated = await productsService.update(p.id, patch)
      setProducts((list) => list.map((x) => (x.id === p.id ? updated : x)))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1 className="mt-2 text-3xl font-semibold">Produits</h1>
          <p className="mt-1 text-sm text-gray-400">
            {products.length} produit{products.length > 1 ? 's' : ''} · {products.filter((p) => p.is_active).length} en ligne
          </p>
        </div>
        <Button icon={HiPlus} onClick={startCreate}>
          Nouveau produit
        </Button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <HiMagnifyingGlass className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un produit, une marque…" className="field pl-12" />
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {[{ id: '' as const, label: 'Tous' }, ...PRODUCT_CATEGORIES].map((c) => (
            <button
              key={c.id || 'all'}
              onClick={() => setCategoryFilter(c.id)}
              className={clsx('whitespace-nowrap rounded-full px-4 py-2 text-xs', categoryFilter === c.id ? 'bg-gold text-primary-black' : 'border border-white/10 text-gray-400')}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/5 bg-dark-800">
        {loading ? (
          <div className="py-20">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-20 text-center text-sm text-gray-500">Aucun produit.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500">
                  <th className="p-4 font-medium">Produit</th>
                  <th className="p-4 font-medium">Catégorie</th>
                  <th className="p-4 font-medium">Prix</th>
                  <th className="p-4 font-medium">Tailles</th>
                  <th className="p-4 font-medium">Stock</th>
                  <th className="p-4 font-medium">Statut</th>
                  <th className="p-4 font-medium">En ligne</th>
                  <th className="p-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const img = p.product_media?.find((m) => m.is_main && m.media_type === 'image') ?? p.product_media?.find((m) => m.media_type === 'image')
                  return (
                    <tr key={p.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-14 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-dark-700">{img && <img src={img.file_path} alt="" className="h-full w-full object-cover" />}</div>
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate font-medium">
                              {p.is_featured && <HiStar className="h-4 w-4 flex-shrink-0 text-gold" aria-label="Mis en avant" />}
                              {p.name}
                              {p.is_exclusive && (
                                <span className="flex-shrink-0 rounded-full bg-gold-gradient px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-black" title={p.exclusive ? `Exclu ${p.exclusive.name}` : 'Exclu'}>
                                  Exclu
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500">{p.collection?.name ?? getCategory(p.category)?.label ?? '—'}</p>
                            {untaggedPhotos(p.colors, p.product_media ?? []) > 0 && (
                              <button
                                onClick={() => startEdit(p, 2)}
                                className="mt-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300 hover:bg-amber-500/20"
                              >
                                {untaggedPhotos(p.colors, p.product_media ?? [])} photo(s) sans couleur
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-gray-400">
                        {getCategory(p.category)?.label}
                        {p.subcategory && <span className="block text-xs text-gray-600">{p.subcategory}</span>}
                      </td>
                      <td className="p-4">
                        <span className="font-medium">{formatCurrency(p.price)}</span>
                        {discountPercent(p.price, p.compare_at_price) > 0 && <span className="block text-xs text-red-400">-{discountPercent(p.price, p.compare_at_price)}%</span>}
                      </td>
                      <td className="max-w-[140px] truncate p-4 text-xs text-gray-400">{p.sizes.length ? p.sizes.join(', ') : 'TU'}</td>
                      <td className="p-4">
                        <span className={clsx(p.stock === 0 ? 'text-red-400' : p.stock <= 3 ? 'text-amber-400' : 'text-gray-300')}>{p.stock}</span>
                      </td>
                      <td className="p-4 text-xs text-gray-400">{STATUS_LABELS[p.status]}</td>
                      <td className="p-4">
                        <button
                          onClick={() => quickToggle(p, { is_active: !p.is_active })}
                          role="switch"
                          aria-checked={p.is_active}
                          aria-label="En ligne"
                          className={clsx('relative h-6 w-11 rounded-full transition-colors', p.is_active ? 'bg-gold' : 'bg-white/10')}
                        >
                          <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all', p.is_active ? 'left-[22px]' : 'left-0.5')} />
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => quickToggle(p, { is_featured: !p.is_featured })} className={clsx('rounded-lg p-2 hover:bg-white/5', p.is_featured ? 'text-gold' : 'text-gray-500')} aria-label="Mettre en avant">
                            <HiSparkles className="h-4 w-4" />
                          </button>
                          <Link
                            to={`/admin/products/${p.id}/3d`}
                            className={clsx('rounded-lg p-2 hover:bg-white/5', p.model_3d ? 'text-gold' : 'text-gray-500 hover:text-white')}
                            aria-label="Vue 3D"
                            title={p.model_3d ? 'Vue 3D (en place)' : 'Ajouter une vue 3D'}
                          >
                            <HiCube className="h-4 w-4" />
                          </Link>
                          <button onClick={() => startEdit(p)} className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white" aria-label="Modifier">
                            <HiPencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => remove(p)} className="rounded-lg p-2 text-gray-400 hover:bg-red-500/10 hover:text-red-400" aria-label="Supprimer">
                            <HiTrash className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => !saving && setOpen(false)} title={editing ? `Modifier « ${editing.name} »` : 'Nouveau produit'} size="xl">
        <ol className="mb-8 grid grid-cols-4 gap-2">
          {STEPS.map((label, i) => (
            <li key={label}>
              <button onClick={() => setStep(i)} className="w-full text-left">
                <span className={clsx('mb-2 block h-1 rounded-full', i <= step ? 'bg-gold' : 'bg-white/10')} />
                <span className={clsx('text-[11px] uppercase tracking-widest', i === step ? 'text-gold' : 'text-gray-500')}>{label}</span>
              </button>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="space-y-5">
            <Input label="Nom" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex : Robe portefeuille en satin" />
            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-[0.15em] text-gray-300">Description</label>
              <textarea rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} className="field resize-none" />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-gray-300">Catégorie</p>
              <div className="flex flex-wrap gap-2">
                {PRODUCT_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setForm((f) => ({ ...f, category: c.id, subcategory: '', sizes: c.id === f.category ? f.sizes : [] }))}
                    className={clsx('rounded-full px-4 py-2 text-sm', form.category === c.id ? 'bg-gold text-primary-black' : 'border border-white/10 text-gray-300')}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium uppercase tracking-[0.15em] text-gray-300">Type</label>
                <input list="subcategories" value={form.subcategory} onChange={(e) => set('subcategory', e.target.value)} className="field" placeholder="Choisir ou saisir…" />
                <datalist id="subcategories">
                  {category.subcategories.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium uppercase tracking-[0.15em] text-gray-300">Pour</label>
                <select value={form.gender} onChange={(e) => set('gender', e.target.value as Gender)} className="field">
                  {GENDERS.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <Input label="Prix (FCFA)" required type="number" min={100} value={form.price} onChange={(e) => set('price', e.target.value)} />
              <Input label="Prix barré" type="number" value={form.compare_at_price} onChange={(e) => set('compare_at_price', e.target.value)} hint="Optionnel — affiche une promo" />
              <Input label="Stock" type="number" min={0} value={form.stock} onChange={(e) => set('stock', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="product-collection" className="block text-xs font-medium uppercase tracking-[0.15em] text-gray-300">
                Collection
              </label>
              <select id="product-collection" value={form.collection_id} onChange={(e) => set('collection_id', e.target.value)} className="field">
                <option value="">{collections.length ? 'Aucune' : 'Aucune collection : créez-en une dans Marques & collections'}</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={clsx('rounded-2xl border p-4 transition-colors', form.is_exclusive ? 'border-gold/60 bg-gold/5' : 'border-white/10')}>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.is_exclusive}
                  onChange={(e) => setForm((f) => ({ ...f, is_exclusive: e.target.checked, exclusive_id: e.target.checked ? f.exclusive_id : '' }))}
                  className="mt-1 h-4 w-4 accent-[#D4AF37]"
                />
                <span>
                  <span className="block text-sm font-semibold uppercase tracking-[0.15em] text-gold">Exclu</span>
                  <span className="text-xs text-gray-400">
                    Pièce rare : affichée uniquement sur la page Exclusivités (pas sur l'accueil ni dans la boutique), mais toujours accessible par son lien et la recherche.
                  </span>
                </span>
              </label>
              {form.is_exclusive && (
                <div className="mt-4 space-y-1.5">
                  <label className="block text-xs font-medium uppercase tracking-[0.15em] text-gray-300">Exclusivité</label>
                  <select value={form.exclusive_id} onChange={(e) => set('exclusive_id', e.target.value)} className="field">
                    <option value="">{exclusives.length ? 'Autres exclusivités (sans groupe)' : 'Créez une exclusivité dans Catalogue → Exclusivités'}</option>
                    {exclusives.map((x) => (
                      <option key={x.id} value={x.id}>
                        Exclu {x.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-8">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-[0.15em] text-gray-300">
                  {sizeSystem.label}s disponibles <span className="normal-case tracking-normal text-gray-500">({form.sizes.length || 'taille unique'})</span>
                </p>
                <div className="flex gap-3 text-xs">
                  <button onClick={() => set('sizes', suggestedSizes.filter((s) => s !== 'TU'))} className="text-gold hover:underline">
                    Tout sélectionner
                  </button>
                  <button onClick={() => set('sizes', [])} className="text-gray-500 hover:underline">
                    Taille unique
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {[...new Set([...suggestedSizes.filter((s) => s !== 'TU'), ...form.sizes])].map((s) => (
                  <button
                    key={s}
                    onClick={() => set('sizes', form.sizes.includes(s) ? form.sizes.filter((x) => x !== s) : [...form.sizes, s])}
                    className={clsx('min-w-12 rounded-xl border px-3 py-2 text-sm', form.sizes.includes(s) ? 'border-gold bg-gold text-primary-black' : 'border-white/10 text-gray-300')}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex max-w-xs gap-2">
                <input value={customSize} onChange={(e) => setCustomSize(e.target.value.toUpperCase())} placeholder="Taille personnalisée (ex : 52, 90B)" className="field" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (customSize && !form.sizes.includes(customSize)) set('sizes', [...form.sizes, customSize])
                    setCustomSize('')
                  }}
                >
                  +
                </Button>
              </div>
            </div>
            <ChipsInput label="Couleurs" values={form.colors} onChange={(v) => set('colors', v)} placeholder="Ex : Noir, Or, Ivoire…" />
            {untaggedPhotos(form.colors, form.media) > 0 && (
              <p className="-mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-200">
                Pour que le choix de couleur change les photos sur la boutique, indiquez la couleur de chaque photo.
                <button type="button" onClick={() => setStep(2)} className="font-semibold text-amber-300 underline">
                  Associer les photos →
                </button>
              </p>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium uppercase tracking-[0.15em] text-gray-300">Disponibilité</label>
                <select value={form.status} onChange={(e) => set('status', e.target.value as ProductStatus)} className="field">
                  {(Object.keys(STATUS_LABELS) as ProductStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <Input label="Date de sortie" type="date" value={form.release_date?.slice(0, 10)} onChange={(e) => set('release_date', e.target.value)} />
            </div>
            <div className="rounded-2xl border border-white/10 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-gray-300">Série numérotée</p>
              <p className="mt-1 text-xs text-gray-500">
                Nombre total de pièces de la série. Chaque pièce reçoit son numéro (« N° 27 / 50 ») dès l’acompte payé : il s’affiche au client et sur la commande, à reporter sur l’étiquette. Quand
                tous les numéros sont attribués, la pièce reste visible, marquée « Épuisée — série complète ». Laissez vide pour une pièce non numérotée.
              </p>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <Input label="Pièces dans la série" type="number" min={1} inputMode="numeric" value={form.series_size} onChange={(e) => set('series_size', e.target.value)} placeholder="Ex : 50" />
                {editing?.series_size ? (
                  <p className="self-end pb-3 text-sm text-gray-400">
                    Déjà numérotées : <span className="text-white">{editing.pieces_numbered ?? 0}</span> / {editing.series_size}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-gray-300">Jauge de précommandes</p>
              <p className="mt-1 text-xs text-gray-500">
                La série est fabriquée quand ce nombre de pièces est payé. La fiche produit affiche « 14 / 30 pièces » et la date de clôture. Laissez vide pour ne pas afficher de jauge.
              </p>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <Input label="Objectif (pièces)" type="number" min={1} inputMode="numeric" value={form.preorder_goal} onChange={(e) => set('preorder_goal', e.target.value)} placeholder="Ex : 30" />
                <Input label="Clôture des précommandes" type="datetime-local" value={form.preorder_deadline} onChange={(e) => set('preorder_deadline', e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            {untaggedPhotos(form.colors, form.media) > 0 && (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                <strong>{untaggedPhotos(form.colors, form.media)} photo(s) sans couleur.</strong> Choisissez la couleur sous chaque photo (menu « Toutes couleurs »),
                puis <strong>Enregistrer</strong> : sur la boutique, cliquer sur « {form.colors[form.colors.length - 1]} » affichera alors ses photos.
              </p>
            )}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                addFiles(e.dataTransfer.files)
              }}
              onClick={() => fileInput.current?.click()}
              className={clsx('flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed py-12 text-center transition-colors', dragging ? 'border-gold bg-gold/5' : 'border-white/10 hover:border-gold/50')}
            >
              <div className="flex gap-3 text-gold">
                <HiPhoto className="h-8 w-8" />
                <HiVideoCamera className="h-8 w-8" />
              </div>
              <p className="mt-3 text-sm">Glissez vos images et vidéos ici, ou cliquez pour parcourir</p>
              <p className="mt-1 text-xs text-gray-500">JPG, PNG, WebP, AVIF (10 Mo) · MP4, WebM, MOV (100 Mo)</p>
              <input ref={fileInput} type="file" multiple accept={[...IMAGE_TYPES, ...VIDEO_TYPES].join(',')} className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
            </div>
            {form.media.length > 0 && (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {form.media.map((m) => (
                  <div key={m.id} className="space-y-2">
                    <div className={clsx('group relative aspect-[3/4] overflow-hidden rounded-xl border-2 bg-dark-700', m.isMain ? 'border-gold' : 'border-transparent')}>
                      {m.type === 'video' ? <video src={m.preview} className="h-full w-full object-cover" muted /> : <img src={m.preview} alt="" className="h-full w-full object-cover" />}
                      {m.isMain && <span className="absolute left-2 top-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-primary-black">Principale</span>}
                      {m.file && <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px]">Nouveau</span>}
                      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                        {m.type === 'image' && !m.isMain && (
                          <button onClick={() => makeMain(m)} className="rounded-full bg-gold p-2 text-primary-black" aria-label="Définir comme principale">
                            <HiStar className="h-4 w-4" />
                          </button>
                        )}
                        <button onClick={() => removeMedia(m)} className="rounded-full bg-red-600 p-2 text-white" aria-label="Supprimer">
                          <HiTrash className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {form.colors.length > 1 && (
                      <select
                        value={form.colors.find((c) => sameColor(c, m.color)) ?? ''}
                        onChange={(e) => setMediaColor(m, e.target.value || null)}
                        className={clsx(
                          'w-full rounded-lg border bg-dark-800 px-2 py-1.5 text-xs text-gray-200 focus:border-gold focus:outline-none',
                          form.colors.some((c) => sameColor(c, m.color)) ? 'border-white/10' : 'border-amber-500/60',
                        )}
                        aria-label="Couleur montrée sur ce média"
                      >
                        <option value="">Toutes couleurs</option>
                        {form.colors.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            )}
            {form.colors.length > 1 && form.media.length > 0 && (
              <p className="text-xs text-gray-500">
                Associez chaque photo à sa couleur : quand le client choisit « {form.colors[0]} », seules ses photos (et celles « Toutes couleurs ») s’affichent.
              </p>
            )}
            <div className="border-t border-white/10 pt-6">
              <FramesField frames={form.spin_frames} onChange={(frames) => set('spin_frames', frames)} folder="products" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <Input label="Matières & composition" value={form.materials} onChange={(e) => set('materials', e.target.value)} placeholder="Ex : 100% coton bio, doublure viscose" />
            <ChipsInput label="Points forts" values={form.features} onChange={(v) => set('features', v)} placeholder="Ex : Coupe ajustée, fermeture YKK…" />
            <ChipsInput label="Mots-clés (recherche)" values={form.tags} onChange={(v) => set('tags', v)} placeholder="Ex : soirée, été, mariage…" />
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { key: 'is_active' as const, label: 'En ligne', hint: 'Visible dans la boutique' },
                { key: 'is_featured' as const, label: 'Mettre en avant', hint: 'Badge « Coup de cœur »' },
              ].map((opt) => (
                <label key={opt.key} className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/10 p-4">
                  <span>
                    <span className="block text-sm">{opt.label}</span>
                    <span className="text-xs text-gray-500">{opt.hint}</span>
                  </span>
                  <input type="checkbox" checked={form[opt.key]} onChange={(e) => set(opt.key, e.target.checked)} className="h-5 w-5 accent-[#D4AF37]" />
                </label>
              ))}
            </div>
            {/* Only a piece that is about to be published for the first time can be announced. */}
            {form.is_active && (!editing || !editing.is_active) && (
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-gold/30 bg-gold/5 p-4">
                <span>
                  <span className="block text-sm">Prévenir les abonnés par email</span>
                  <span className="text-xs text-gray-400">
                    Un email « Nouveauté » part environ 15 minutes après la mise en ligne, le temps d'ajouter les photos. Les pièces publiées ensemble partagent le même email. Seuls les abonnés qui ont accepté le reçoivent.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={form.notify_subscribers}
                  onChange={(e) => set('notify_subscribers', e.target.checked)}
                  className="h-5 w-5 flex-shrink-0 accent-[#D4AF37]"
                />
              </label>
            )}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-6">
          <Button variant="ghost" icon={HiArrowLeft} onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            Précédent
          </Button>
          <div className="flex gap-2">
            {step < STEPS.length - 1 && (
              <Button variant="outline" icon={HiArrowRight} iconPosition="right" onClick={() => setStep((s) => s + 1)}>
                Suivant
              </Button>
            )}
            <Button onClick={save} loading={saving}>
              {editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
