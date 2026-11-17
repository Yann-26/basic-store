import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { HiArchiveBox, HiEnvelope, HiEnvelopeOpen, HiArrowUturnLeft } from 'react-icons/hi2'
import { engagementService, type ContactMessage } from '../../services/engagementService'
import { errorMessage } from '../../core/http'
import Spinner from '../../components/ui/Spinner'

const FILTERS: { id: ContactMessage['status'] | ''; label: string }[] = [
  { id: 'new', label: 'Nouveaux' },
  { id: 'read', label: 'Lus' },
  { id: 'archived', label: 'Archivés' },
  { id: '', label: 'Tous' },
]

export default function AdminMessages() {
  const [filter, setFilter] = useState<ContactMessage['status'] | ''>('new')
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [selected, setSelected] = useState<ContactMessage | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setMessages(await engagementService.messages(filter || undefined))
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  const setStatus = async (m: ContactMessage, status: ContactMessage['status']) => {
    try {
      await engagementService.setMessageStatus(m.id, status)
      setMessages((list) => (filter && filter !== status ? list.filter((x) => x.id !== m.id) : list.map((x) => (x.id === m.id ? { ...x, status } : x))))
      setSelected((s) => (s?.id === m.id ? (filter && filter !== status ? null : { ...s, status }) : s))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const open = (m: ContactMessage) => {
    setSelected(m)
    if (m.status === 'new') void setStatus(m, 'read')
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Relation client</p>
        <h1 className="mt-2 text-3xl font-semibold">Messages</h1>
      </div>
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id || 'all'}
            onClick={() => {
              setFilter(f.id)
              setSelected(null)
            }}
            className={clsx('rounded-full px-4 py-1.5 text-xs', filter === f.id ? 'bg-gold text-primary-black' : 'border border-white/10 text-gray-400')}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-dark-800">
          {loading ? (
            <div className="py-20">
              <Spinner />
            </div>
          ) : messages.length === 0 ? (
            <p className="p-10 text-center text-sm text-gray-500">Aucun message.</p>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-white/5 overflow-y-auto">
              {messages.map((m) => (
                <li key={m.id}>
                  <button onClick={() => open(m)} className={clsx('w-full p-4 text-left hover:bg-white/[0.03]', selected?.id === m.id && 'bg-gold/5')}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={clsx('truncate text-sm', m.status === 'new' ? 'font-semibold text-white' : 'text-gray-300')}>{m.name}</span>
                      <span className="flex-shrink-0 text-[11px] text-gray-500">{new Date(m.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-gold">{m.subject}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-gray-500">{m.message}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-white/5 bg-dark-800 p-6">
          {!selected ? (
            <div className="flex h-full min-h-60 flex-col items-center justify-center text-gray-500">
              <HiEnvelope className="h-10 w-10" />
              <p className="mt-3 text-sm">Sélectionnez un message</p>
            </div>
          ) : (
            <article>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/5 pb-5">
                <div>
                  <h2 className="text-2xl">{selected.subject}</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    {selected.name} · <a href={`mailto:${selected.email}`} className="text-gold">{selected.email}</a>
                    {selected.phone && ` · ${selected.phone}`}
                  </p>
                  <p className="text-xs text-gray-500">{new Date(selected.created_at).toLocaleString('fr-FR')}</p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={`mailto:${selected.email}?subject=${encodeURIComponent(`Re: ${selected.subject}`)}`}
                    className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-primary-black"
                  >
                    <HiArrowUturnLeft className="h-4 w-4" /> Répondre
                  </a>
                  {selected.status !== 'archived' ? (
                    <button onClick={() => setStatus(selected, 'archived')} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs text-gray-300">
                      <HiArchiveBox className="h-4 w-4" /> Archiver
                    </button>
                  ) : (
                    <button onClick={() => setStatus(selected, 'read')} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs text-gray-300">
                      <HiEnvelopeOpen className="h-4 w-4" /> Désarchiver
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-6 whitespace-pre-line leading-relaxed text-gray-200">{selected.message}</p>
            </article>
          )}
        </div>
      </div>
    </div>
  )
}
