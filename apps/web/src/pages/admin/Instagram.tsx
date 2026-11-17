import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { FaInstagram } from 'react-icons/fa'
import { HiPlus, HiTrash, HiPhoto, HiEye, HiEyeSlash, HiPencil, HiXMark, HiMagnifyingGlass } from 'react-icons/hi2'
import type { Product } from '@trs/shared'
import { engagementService, type InstagramPost } from '../../services/engagementService'
import { productsService } from '../../services/productsService'
import { mainImage } from '../../context/WishlistContext'
import { errorMessage } from '../../core/http'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'

const MAX_PIECES = 8

interface LookForm {
  image_url: string
  customer_name: string
  customer_handle: string
  customer_city: string
  quote: string
  post_url: string
  product_ids: string[]
  sort_order: string
  is_published: boolean
}

const EMPTY: LookForm = {
  image_url: '',
  customer_name: '',
  customer_handle: '',
  customer_city: '',
  quote: '',
  post_url: '',
  product_ids: [],
  sort_order: '0',
  is_published: true,
}

const toForm = (p: InstagramPost): LookForm => ({
  image_url: p.image_url ?? '',
  customer_name: p.customer_name ?? '',
  customer_handle: p.customer_handle ?? '',
  customer_city: p.customer_city ?? '',
  quote: p.quote ?? p.caption ?? '',
  post_url: p.post_url ?? p.permalink ?? '',
  product_ids: p.product_ids ?? [],
  sort_order: String(p.sort_order ?? 0),
  is_published: p.is_published,
})

/**
 * "Looks clients": loyal customers' best outfits with the pieces they wear.
 * On the storefront each look opens its Instagram post (or the shop's profile).
 * (Embeds are not rendered as raw HTML to avoid script injection.)
 */
export default function AdminInstagram() {
  const [posts, setPosts] = useState<InstagramPost[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<InstagramPost | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<LookForm>(EMPTY)
  const [pieceSearch, setPieceSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = () =>
    engagementService
      .instagramPosts()
      .then(setPosts)
      .catch((e) => toast.error(errorMessage(e)))
      .finally(() => setLoading(false))

  useEffect(() => {
    void load()
    productsService.getAll().then(setProducts).catch(() => setProducts([]))
  }, [])

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const pieceResults = useMemo(() => {
    const q = pieceSearch.trim().toLowerCase()
    if (!q) return []
    return products.filter((p) => !form.product_ids.includes(p.id) && p.name.toLowerCase().includes(q)).slice(0, 6)
  }, [pieceSearch, products, form.product_ids])

  const set = <K extends keyof LookForm>(key: K, value: LookForm[K]) => setForm((f) => ({ ...f, [key]: value }))

  const startCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setPieceSearch('')
    setOpen(true)
  }

  const startEdit = (post: InstagramPost) => {
    setEditing(post)
    setForm(toForm(post))
    setPieceSearch('')
    setOpen(true)
  }

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const { url } = await productsService.uploadFile(file, 'settings')
      set('image_url', url)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setUploading(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.image_url) return toast.error('Ajoutez la photo du look')
    if (!form.customer_name.trim()) return toast.error('Indiquez le prénom du client')
    setSaving(true)
    const payload = {
      image_url: form.image_url,
      customer_name: form.customer_name.trim(),
      customer_handle: form.customer_handle.trim() || null,
      customer_city: form.customer_city.trim() || null,
      quote: form.quote.trim() || null,
      caption: form.quote.trim(),
      post_url: form.post_url.trim() || null,
      permalink: form.post_url.trim() || null,
      product_ids: form.product_ids,
      sort_order: Number(form.sort_order) || 0,
      is_published: form.is_published,
    }
    try {
      if (editing) await engagementService.updateInstagramPost(editing.id, payload)
      else await engagementService.createInstagramPost(payload)
      toast.success(editing ? 'Look mis à jour' : 'Look ajouté')
      setOpen(false)
      void load()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const togglePublished = async (post: InstagramPost) => {
    try {
      await engagementService.updateInstagramPost(post.id, { is_published: !post.is_published })
      setPosts((p) => p.map((x) => (x.id === post.id ? { ...x, is_published: !x.is_published } : x)))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const remove = async (post: InstagramPost) => {
    if (!confirm('Supprimer ce look ?')) return
    try {
      await engagementService.deleteInstagramPost(post.id)
      setPosts((p) => p.filter((x) => x.id !== post.id))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Communauté · Instagram</p>
          <h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold">
            <FaInstagram className="text-gold" /> Looks clients
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            Les plus beaux looks de vos clients fidèles. Les 9 premiers (selon l'ordre) s'affichent sur l'accueil, tous sur la page Lookbook. Un clic sur un look ouvre sa
            publication Instagram, ou votre profil si aucun lien n'est renseigné.
          </p>
        </div>
        <Button icon={HiPlus} onClick={startCreate}>
          Nouveau look
        </Button>
      </div>

      {loading ? (
        <div className="py-20">
          <Spinner />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-20 text-center text-gray-500">
          <FaInstagram className="mx-auto mb-4 h-12 w-12" />
          Aucun look pour l'instant. Ajoutez la photo d'un client fidèle avec les pièces qu'il porte.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {posts.map((post) => (
            <div key={post.id} className={clsx('overflow-hidden rounded-2xl border bg-dark-800', post.is_published ? 'border-white/5' : 'border-dashed border-white/15 opacity-60')}>
              <button onClick={() => startEdit(post)} className="relative block aspect-[4/5] w-full bg-dark-700 text-left">
                {post.image_url ? <img src={post.image_url} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-xs text-gray-500">Sans image</span>}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3">
                  <span className="block truncate text-sm font-semibold">{post.customer_name || 'Sans nom'}</span>
                  <span className="block truncate text-xs text-gold">{post.customer_handle ? `@${post.customer_handle}` : post.customer_city || '—'}</span>
                </span>
                <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-gray-300">#{post.sort_order ?? 0}</span>
              </button>
              <div className="flex items-center justify-between gap-2 p-3">
                <p className="flex-1 text-xs text-gray-400">
                  {(post.product_ids ?? []).length} pièce{(post.product_ids ?? []).length > 1 ? 's' : ''}
                  {post.post_url ? ' · lien' : ''}
                </p>
                <button onClick={() => startEdit(post)} className="p-1.5 text-gray-400 hover:text-gold" aria-label="Modifier">
                  <HiPencil className="h-4 w-4" />
                </button>
                <button onClick={() => togglePublished(post)} className="p-1.5 text-gray-400 hover:text-gold" aria-label={post.is_published ? 'Masquer' : 'Publier'}>
                  {post.is_published ? <HiEye className="h-4 w-4" /> : <HiEyeSlash className="h-4 w-4" />}
                </button>
                <button onClick={() => remove(post)} className="p-1.5 text-gray-400 hover:text-red-400" aria-label="Supprimer">
                  <HiTrash className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Modifier le look' : 'Nouveau look'} size="xl">
        <form onSubmit={submit} className="grid gap-6 md:grid-cols-[260px_1fr]">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-gray-300">Photo du look *</p>
            <label className="flex aspect-[4/5] cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-dark-700 hover:border-gold">
              {uploading ? (
                <Spinner size="sm" />
              ) : form.image_url ? (
                <img src={form.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-2 px-4 text-center text-sm text-gray-500">
                  <HiPhoto className="h-8 w-8" /> Téléverser la photo (portrait de préférence)
                </span>
              )}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Prénom du client *" value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} placeholder="Awa" />
              <Input label="Instagram du client" value={form.customer_handle} onChange={(e) => set('customer_handle', e.target.value)} placeholder="@awa.style" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Ville" value={form.customer_city} onChange={(e) => set('customer_city', e.target.value)} placeholder="Abidjan" />
              <Input label="Ordre d'affichage" type="number" min={0} value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} hint="0 = en premier" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-[0.15em] text-gray-300">Son mot (citation)</label>
              <textarea rows={2} maxLength={280} value={form.quote} onChange={(e) => set('quote', e.target.value)} className="field resize-none" placeholder="Mes Ja 4 ne me quittent plus !" />
            </div>
            <Input
              label="Lien de la publication Instagram"
              placeholder="https://www.instagram.com/p/…"
              value={form.post_url}
              onChange={(e) => set('post_url', e.target.value)}
              hint="Optionnel : sans lien, le look ouvre votre profil Instagram"
            />

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-gray-300">
                Pièces portées <span className="normal-case tracking-normal text-gray-500">({form.product_ids.length}/{MAX_PIECES})</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {form.product_ids.map((id) => {
                  const p = productById.get(id)
                  return (
                    <span key={id} className="flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 py-1 pl-1 pr-2 text-xs">
                      {p && mainImage(p) ? <img src={mainImage(p)!} alt="" className="h-6 w-6 rounded-full object-cover" /> : <span className="h-6 w-6 rounded-full bg-dark-700" />}
                      {p?.name ?? 'Produit supprimé'}
                      <button type="button" onClick={() => set('product_ids', form.product_ids.filter((x) => x !== id))} aria-label="Retirer" className="text-gray-400 hover:text-red-400">
                        <HiXMark className="h-4 w-4" />
                      </button>
                    </span>
                  )
                })}
              </div>
              {form.product_ids.length < MAX_PIECES && (
                <div className="relative">
                  <HiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <input value={pieceSearch} onChange={(e) => setPieceSearch(e.target.value)} placeholder="Ajouter une pièce (nom du produit)…" className="field pl-9" />
                  {pieceResults.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-dark-800 shadow-2xl">
                      {pieceResults.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => {
                              set('product_ids', [...form.product_ids, p.id])
                              setPieceSearch('')
                            }}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-white/5"
                          >
                            {mainImage(p) ? <img src={mainImage(p)!} alt="" className="h-8 w-8 rounded object-cover" /> : <span className="h-8 w-8 rounded bg-dark-700" />}
                            <span className="flex-1 truncate">{p.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_published} onChange={(e) => set('is_published', e.target.checked)} className="h-4 w-4 accent-[#D4AF37]" />
              Publié sur le site
            </label>
            <Button type="submit" className="w-full" loading={saving}>
              {editing ? 'Enregistrer' : 'Ajouter le look'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
