import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { HiChatBubbleLeftRight, HiCheck, HiNoSymbol, HiTrash } from 'react-icons/hi2'
import type { ProductReview, ReviewStatus } from '@trs/shared'
import { reviewsService } from '../../../services/reviewsService'
import { errorMessage } from '../../../core/http'
import Stars from '../../../components/reviews/Stars'
import Spinner from '../../../components/ui/Spinner'
import Section from './Section'

const FILTERS: { id: ReviewStatus; label: string }[] = [
  { id: 'pending', label: 'À valider' },
  { id: 'approved', label: 'Publiés' },
  { id: 'rejected', label: 'Refusés' },
]

/** Back-office → Marketing → Avis: publish, answer or refuse the customers' reviews. */
export default function ReviewsModeration() {
  const [status, setStatus] = useState<ReviewStatus>('pending')
  const [items, setItems] = useState<ProductReview[] | null>(null)
  const [replies, setReplies] = useState<Record<string, string>>({})

  const load = useCallback(() => {
    setItems(null)
    reviewsService
      .list({ status, limit: 100 })
      .then((r) => {
        setItems(r.items)
        setReplies(Object.fromEntries(r.items.map((i) => [i.id, i.admin_reply ?? ''])))
      })
      .catch((e) => {
        setItems([])
        toast.error(errorMessage(e, 'Impossible de charger les avis'))
      })
  }, [status])
  useEffect(load, [load])

  const act = async (r: ProductReview, patch: { status?: ReviewStatus; admin_reply?: string | null }, done: string) => {
    try {
      await reviewsService.moderate(r.id, patch)
      toast.success(done)
      load()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const remove = async (r: ProductReview) => {
    if (!window.confirm('Supprimer définitivement cet avis ?')) return
    try {
      await reviewsService.remove(r.id)
      load()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <Section
      icon={HiChatBubbleLeftRight}
      title="Avis clients"
      hint="Seuls les clients dont la commande a été livrée peuvent noter une pièce ; ils sont invités par email à la livraison. Un avis n’apparaît sur la boutique qu’une fois publié ici."
    >
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setStatus(f.id)}
            className={clsx('rounded-full px-4 py-2 text-xs', status === f.id ? 'bg-gold text-primary-black' : 'border border-white/15 text-gray-300 hover:border-gold')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {items === null ? (
        <Spinner />
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">{status === 'pending' ? 'Aucun avis en attente.' : 'Aucun avis ici.'}</p>
      ) : (
        <ul className="space-y-4">
          {items.map((r) => (
            <li key={r.id} className="rounded-2xl border border-white/10 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <Stars value={r.rating} />
                    <span className="text-sm">{r.author_name}</span>
                    <span className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                  {r.product && (
                    <Link to={`/product/${r.product.slug}#avis`} target="_blank" className="mt-1 block text-xs text-gold hover:underline">
                      {r.product.name}
                    </Link>
                  )}
                  {r.title && <p className="mt-3 font-medium">{r.title}</p>}
                  {r.body && <p className="mt-1 whitespace-pre-line text-sm text-gray-300">{r.body}</p>}
                </div>
                {r.photo_url && (
                  <a href={r.photo_url} target="_blank" rel="noopener noreferrer" className="h-28 w-24 flex-none overflow-hidden rounded-xl">
                    <img src={r.photo_url} alt="Photo du client" className="h-full w-full object-cover" />
                  </a>
                )}
              </div>

              <div className="mt-4 flex flex-col gap-3 md:flex-row">
                <input
                  className="field flex-1"
                  value={replies[r.id] ?? ''}
                  onChange={(e) => setReplies((x) => ({ ...x, [r.id]: e.target.value }))}
                  maxLength={800}
                  placeholder="Réponse publique de la Maison (facultatif)"
                  aria-label="Réponse"
                />
                <div className="flex flex-wrap gap-2">
                  {(replies[r.id] ?? '') !== (r.admin_reply ?? '') && (
                    <button type="button" onClick={() => act(r, { admin_reply: replies[r.id] ?? '' }, 'Réponse enregistrée')} className="rounded-xl border border-white/15 px-4 py-2 text-xs hover:border-gold">
                      Enregistrer la réponse
                    </button>
                  )}
                  {r.status !== 'approved' && (
                    <button type="button" onClick={() => act(r, { status: 'approved', admin_reply: replies[r.id] ?? '' }, 'Avis publié')} className="inline-flex items-center gap-1 rounded-xl bg-gold px-4 py-2 text-xs font-semibold text-primary-black">
                      <HiCheck className="h-4 w-4" /> Publier
                    </button>
                  )}
                  {r.status !== 'rejected' && (
                    <button type="button" onClick={() => act(r, { status: 'rejected' }, 'Avis refusé')} className="inline-flex items-center gap-1 rounded-xl border border-white/15 px-4 py-2 text-xs text-gray-300 hover:border-red-400 hover:text-red-400">
                      <HiNoSymbol className="h-4 w-4" /> {r.status === 'approved' ? 'Retirer' : 'Refuser'}
                    </button>
                  )}
                  <button type="button" onClick={() => remove(r)} className="rounded-xl p-2 text-gray-500 hover:text-red-400" aria-label="Supprimer">
                    <HiTrash className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
