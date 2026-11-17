import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { HiCamera, HiStar, HiXMark } from 'react-icons/hi2'
import type { ProductReview } from '@trs/shared'
import { useAuth } from '../../context/AuthContext'
import { reviewsService, type ProductReviews as Data } from '../../services/reviewsService'
import { errorMessage } from '../../core/http'
import Button from '../ui/Button'
import Stars from './Stars'

const LABELS = ['', 'Décevant', 'Moyen', 'Bien', 'Très bien', 'Exceptionnel']

/** "Avis clients": the summary, the approved reviews (with the customers' photos) and the form for verified buyers. */
export default function ProductReviews({ productId, slug, name }: { productId: string; slug: string; name: string }) {
  const { user } = useAuth()
  const [data, setData] = useState<Data | null>(null)
  const [mine, setMine] = useState<{ can_review: boolean; review: ProductReview | null } | null>(null)
  const [open, setOpen] = useState(false)
  const [zoom, setZoom] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    reviewsService
      .forProduct(slug)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData({ summary: { count: 0, average: 0, distribution: [0, 0, 0, 0, 0] }, reviews: [] }))
    return () => {
      alive = false
    }
  }, [slug])

  useEffect(() => {
    if (!user) return setMine(null)
    let alive = true
    reviewsService
      .mine(productId)
      .then((m) => alive && setMine(m))
      .catch(() => alive && setMine(null))
    return () => {
      alive = false
    }
  }, [user, productId])

  if (!data) return null
  const { summary, reviews } = data
  const photos = reviews.filter((r) => r.photo_url)

  return (
    <section id="avis" aria-labelledby="avis-title" className="scroll-mt-24 border-t border-white/5 py-20">
      <div className="container-custom">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-20">
          <div>
            <p className="eyebrow mb-3">Avis clients</p>
            <h2 id="avis-title" className="text-3xl md:text-4xl">
              Ils la portent
            </h2>
            {summary.count > 0 ? (
              <div className="mt-8">
                <div className="flex items-end gap-4">
                  <span className="font-display text-6xl leading-none text-gold">{summary.average.toLocaleString('fr-FR')}</span>
                  <div className="pb-1">
                    <Stars value={summary.average} size="h-5 w-5" />
                    <p className="mt-1 text-xs text-gray-400">
                      {summary.count} avis vérifié{summary.count > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <ul className="mt-6 space-y-2" aria-label="Répartition des notes">
                  {[5, 4, 3, 2, 1].map((n) => {
                    const count = summary.distribution[n - 1] ?? 0
                    return (
                      <li key={n} className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="w-3 tabular-nums">{n}</span>
                        <HiStar className="h-3 w-3 text-gold" aria-hidden />
                        <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                          <span className="block h-full rounded-full bg-gold" style={{ width: `${summary.count ? (count / summary.count) * 100 : 0}%` }} />
                        </span>
                        <span className="w-5 text-right tabular-nums">{count}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : (
              <p className="mt-6 text-sm leading-relaxed text-gray-400">Aucun avis pour le moment. Les clients qui ont reçu cette pièce peuvent être les premiers à la noter.</p>
            )}

            <div className="mt-8">
              {mine?.can_review ? (
                <Button variant="outline" onClick={() => setOpen((v) => !v)}>
                  {mine.review ? 'Modifier mon avis' : 'Donner mon avis'}
                </Button>
              ) : user ? (
                <p className="text-xs leading-relaxed text-gray-500">Vous pourrez donner votre avis dès que votre commande de cette pièce vous aura été livrée.</p>
              ) : (
                <p className="text-xs leading-relaxed text-gray-500">
                  Vous avez reçu cette pièce ?{' '}
                  <Link to="/login" className="text-gold underline-offset-4 hover:underline">
                    Connectez-vous
                  </Link>{' '}
                  pour donner votre avis.
                </p>
              )}
              {mine?.review && mine.review.status !== 'approved' && (
                <p className="mt-3 text-xs text-gray-500">{mine.review.status === 'pending' ? 'Votre avis est en cours de validation.' : 'Votre avis n’a pas été publié.'}</p>
              )}
            </div>
          </div>

          <div className="min-w-0">
            {open && mine?.can_review && (
              <ReviewForm
                productId={productId}
                name={name}
                existing={mine.review}
                onDone={(review) => {
                  setMine({ can_review: true, review })
                  setOpen(false)
                }}
              />
            )}

            {photos.length > 0 && (
              <div className="no-scrollbar -mx-4 mb-10 flex gap-3 overflow-x-auto px-4 lg:mx-0 lg:px-0">
                {photos.map((r) => (
                  <button key={r.id} type="button" onClick={() => setZoom(r.photo_url)} className="h-40 w-32 flex-none overflow-hidden rounded-2xl bg-dark-700" aria-label={`Photo de ${r.author_name}`}>
                    <img src={r.photo_url!} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 hover:scale-105" />
                  </button>
                ))}
              </div>
            )}

            {reviews.length > 0 && (
              <ul className="divide-y divide-white/5">
                {reviews.map((r) => (
                  <li key={r.id} className="py-7 first:pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Stars value={r.rating} />
                      <span className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
                    </div>
                    {r.title && <p className="mt-3 font-display text-xl">{r.title}</p>}
                    {r.body && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-300">{r.body}</p>}
                    <div className="mt-4 flex items-center gap-4">
                      {r.photo_url && (
                        <button type="button" onClick={() => setZoom(r.photo_url)} className="h-16 w-14 overflow-hidden rounded-xl bg-dark-700" aria-label="Agrandir la photo">
                          <img src={r.photo_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                        </button>
                      )}
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                        {r.author_name} <span className="text-gold">· Achat vérifié</span>
                      </p>
                    </div>
                    {r.admin_reply && (
                      <div className="mt-4 border-l border-gold/40 pl-4 text-sm text-gray-400">
                        <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-gold">Réponse de la Maison</p>
                        {r.admin_reply}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {zoom && (
        <div role="dialog" aria-modal="true" aria-label="Photo du client" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-6" onClick={() => setZoom(null)}>
          <img src={zoom} alt="" className="max-h-full max-w-full rounded-2xl object-contain" />
          <button type="button" className="absolute right-5 top-5 rounded-full p-2 text-white hover:text-gold" aria-label="Fermer">
            <HiXMark className="h-7 w-7" />
          </button>
        </div>
      )}
    </section>
  )
}

function ReviewForm({ productId, name, existing, onDone }: { productId: string; name: string; existing: ProductReview | null; onDone: (r: ProductReview) => void }) {
  const [rating, setRating] = useState(existing?.rating ?? 0)
  const [hover, setHover] = useState(0)
  const [title, setTitle] = useState(existing?.title ?? '')
  const [body, setBody] = useState(existing?.body ?? '')
  const [photo, setPhoto] = useState<string | null>(existing?.photo_url ?? null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  const upload = async (f: File | undefined) => {
    if (!f) return
    if (f.size > 5 * 1024 * 1024) return toast.error('Photo trop lourde (5 Mo maximum)')
    setUploading(true)
    try {
      setPhoto((await reviewsService.uploadPhoto(f)).url)
    } catch (e) {
      toast.error(errorMessage(e, 'Envoi de la photo impossible'))
    } finally {
      setUploading(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating) return toast.error('Choisissez une note')
    setSaving(true)
    try {
      const review = await reviewsService.submit({ product_id: productId, rating, title, body, photo_url: photo })
      toast.success('Merci ! Votre avis sera publié après validation.')
      onDone(review)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const shown = hover || rating
  return (
    <form onSubmit={submit} className="mb-12 space-y-5 rounded-3xl border border-gold/20 p-6">
      <p className="text-sm text-gray-300">Votre avis sur « {name} »</p>
      <fieldset>
        <legend className="sr-only">Note</legend>
        <div className="flex items-center gap-4">
          <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="cursor-pointer" onMouseEnter={() => setHover(n)}>
                <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="sr-only" />
                <HiStar className={`h-8 w-8 transition-colors ${n <= shown ? 'text-gold' : 'text-white/15'}`} aria-hidden />
                <span className="sr-only">{n} étoile{n > 1 ? 's' : ''}</span>
              </label>
            ))}
          </div>
          <span className="text-xs uppercase tracking-[0.2em] text-gray-400">{LABELS[shown]}</span>
        </div>
      </fieldset>
      <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="En un mot (facultatif)" aria-label="Titre" />
      <textarea className="field min-h-28" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1500} placeholder="La coupe, la matière, comment vous la portez…" aria-label="Votre avis" />
      <div className="flex flex-wrap items-center gap-4">
        {photo ? (
          <div className="relative h-24 w-20 overflow-hidden rounded-xl">
            <img src={photo} alt="Votre photo" className="h-full w-full object-cover" />
            <button type="button" onClick={() => setPhoto(null)} className="absolute right-1 top-1 rounded-full bg-black/70 p-1" aria-label="Retirer la photo">
              <HiXMark className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => file.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs hover:border-gold hover:text-gold disabled:opacity-50">
            <HiCamera className="h-4 w-4" /> {uploading ? 'Envoi…' : 'Ajouter une photo portée'}
          </button>
        )}
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={saving} disabled={!rating || uploading}>
          Publier mon avis
        </Button>
      </div>
    </form>
  )
}
