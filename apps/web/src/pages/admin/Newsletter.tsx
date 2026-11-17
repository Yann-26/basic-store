import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { HiEnvelopeOpen, HiPlus, HiTrash, HiUsers, HiPencil, HiDocumentDuplicate } from 'react-icons/hi2'
import { NEWSLETTER_STATUS_LABELS, type NewsletterCampaign } from '@trs/shared'
import { newsletterService, type NewsletterSubscriber } from '../../services/newsletterService'
import { errorMessage } from '../../core/http'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import { STATUS_TONE } from './newsletterUi'

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Abidjan' }) : '—'

function Campaigns() {
  const [campaigns, setCampaigns] = useState<NewsletterCampaign[] | null>(null)
  const navigate = useNavigate()

  const load = () =>
    newsletterService
      .list()
      .then(setCampaigns)
      .catch((e) => {
        toast.error(errorMessage(e))
        setCampaigns([])
      })
  useEffect(() => {
    void load()
  }, [])

  const remove = async (c: NewsletterCampaign) => {
    if (!confirm(`Supprimer la campagne « ${c.title} » ?`)) return
    try {
      await newsletterService.remove(c.id)
      toast.success('Campagne supprimée')
      void load()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const duplicate = async (c: NewsletterCampaign) => {
    try {
      const copy = await newsletterService.create({ title: `${c.title} (copie)`, subject: c.subject, preheader: c.preheader, blocks: c.blocks, audience: c.audience })
      navigate(`/admin/newsletter/${copy.id}`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  if (!campaigns) return <Spinner />
  if (campaigns.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 py-20 text-center">
        <HiEnvelopeOpen className="mx-auto h-10 w-10 text-gold" />
        <p className="mt-4 font-display text-2xl">Votre première campagne</p>
        <p className="mt-2 text-sm text-gray-500">Images, vidéos, produits, recommandations personnalisées… envoyée tout de suite ou à l’heure de votre choix.</p>
        <Link to="/admin/newsletter/new" className="mt-6 inline-block">
          <Button icon={HiPlus}>Créer une campagne</Button>
        </Link>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/5 bg-dark-800">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500">
            <th className="p-4 font-medium">Campagne</th>
            <th className="p-4 font-medium">Statut</th>
            <th className="p-4 font-medium">Envoi</th>
            <th className="p-4 font-medium">Destinataires</th>
            <th className="p-4 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id} className="border-t border-white/5 hover:bg-white/[0.02]">
              <td className="p-4">
                <Link to={`/admin/newsletter/${c.id}`} className="font-medium hover:text-gold">
                  {c.title}
                </Link>
                <p className="truncate text-xs text-gray-500">{c.subject}</p>
              </td>
              <td className="p-4">
                <span className={clsx('rounded-full px-3 py-1 text-xs', STATUS_TONE[c.status])}>{NEWSLETTER_STATUS_LABELS[c.status]}</span>
              </td>
              <td className="p-4 text-gray-400">{c.status === 'sent' ? when(c.finished_at) : when(c.scheduled_at)}</td>
              <td className="p-4 text-gray-400">
                {c.recipients_count > 0 ? (
                  <>
                    {c.sent_count}/{c.recipients_count} envoyés{c.failed_count > 0 && <span className="text-red-300"> · {c.failed_count} échecs</span>}
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td className="p-4">
                <div className="flex justify-end gap-1">
                  <Link to={`/admin/newsletter/${c.id}`} className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white" aria-label="Ouvrir">
                    <HiPencil className="h-4 w-4" />
                  </Link>
                  <button onClick={() => duplicate(c)} className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white" aria-label="Dupliquer">
                    <HiDocumentDuplicate className="h-4 w-4" />
                  </button>
                  {c.status !== 'sending' && (
                    <button onClick={() => remove(c)} className="rounded-lg p-2 text-gray-400 hover:bg-red-500/10 hover:text-red-400" aria-label="Supprimer">
                      <HiTrash className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Subscribers() {
  const [rows, setRows] = useState<NewsletterSubscriber[] | null>(null)
  const [counts, setCounts] = useState<{ all: number; buyers: number } | null>(null)
  const load = () => {
    newsletterService.subscribers().then(setRows).catch(() => setRows([]))
    newsletterService.audience().then(setCounts).catch(() => undefined)
  }
  useEffect(load, [])

  const remove = async (s: NewsletterSubscriber) => {
    if (!confirm(`Retirer ${s.email} de la liste ?`)) return
    try {
      await newsletterService.removeSubscriber(s.id)
      load()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  if (!rows) return <Spinner />
  return (
    <div className="space-y-4">
      {counts && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/5 bg-dark-800 p-5">
            <p className="text-xs uppercase tracking-widest text-gray-500">Destinataires (tous)</p>
            <p className="mt-1 font-display text-3xl text-gold">{counts.all}</p>
            <p className="text-xs text-gray-500">Inscrits à la newsletter + clients ayant accepté les emails, sans les désinscrits.</p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-dark-800 p-5">
            <p className="text-xs uppercase tracking-widest text-gray-500">Dont clients ayant commandé</p>
            <p className="mt-1 font-display text-3xl text-gold">{counts.buyers}</p>
            <p className="text-xs text-gray-500">Idéal pour les recommandations « Pour vous ».</p>
          </div>
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-dark-800">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500">
              <th className="p-4 font-medium">Email</th>
              <th className="p-4 font-medium">Origine</th>
              <th className="p-4 font-medium">Inscrit le</th>
              <th className="p-4 font-medium">Statut</th>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  Aucun inscrit pour l’instant.
                </td>
              </tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-white/5">
                <td className="p-4">{s.email}</td>
                <td className="p-4 text-gray-400">{s.source ?? '—'}</td>
                <td className="p-4 text-gray-400">{new Date(s.created_at).toLocaleDateString('fr-FR')}</td>
                <td className="p-4">{s.unsubscribed_at ? <span className="text-xs text-gray-500">Désinscrit</span> : <span className="text-xs text-green-300">Actif</span>}</td>
                <td className="p-4 text-right">
                  <button onClick={() => remove(s)} className="rounded-lg p-2 text-gray-400 hover:bg-red-500/10 hover:text-red-400" aria-label={`Retirer ${s.email}`}>
                    <HiTrash className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Admin → Newsletter: campaigns and subscribers. */
export default function AdminNewsletter() {
  const [tab, setTab] = useState<'campaigns' | 'subscribers'>('campaigns')
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Boutique</p>
          <h1 className="mt-2 text-3xl font-semibold">Newsletter</h1>
          <p className="mt-1 text-sm text-gray-400">Campagnes riches, envoi programmé et recommandations selon les achats de chaque client.</p>
        </div>
        <Link to="/admin/newsletter/new">
          <Button icon={HiPlus}>Nouvelle campagne</Button>
        </Link>
      </div>
      <div className="flex gap-2">
        {(
          [
            ['campaigns', 'Campagnes', HiEnvelopeOpen],
            ['subscribers', 'Abonnés', HiUsers],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx('flex items-center gap-2 rounded-full px-5 py-2.5 text-sm', tab === id ? 'bg-gold text-primary-black' : 'border border-white/10 text-gray-300 hover:border-gold/50')}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      {tab === 'campaigns' ? <Campaigns /> : <Subscribers />}
    </div>
  )
}
