import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import {
  HiArrowDown,
  HiArrowLeft,
  HiArrowUp,
  HiCalendarDays,
  HiComputerDesktop,
  HiDevicePhoneMobile,
  HiPaperAirplane,
  HiPhoto,
  HiSparkles,
  HiTrash,
  HiXMark,
  HiNoSymbol,
  HiBeaker,
} from 'react-icons/hi2'
import {
  NEWSLETTER_AUDIENCE_LABELS,
  NEWSLETTER_BLOCK_LABELS,
  NEWSLETTER_MAX_BLOCKS,
  NEWSLETTER_MAX_PRODUCTS,
  NEWSLETTER_STATUS_LABELS,
  videoThumbnail,
  type NewsletterAudience,
  type NewsletterBlock,
  type NewsletterBlockType,
  type NewsletterCampaign,
  type Product,
} from '@trs/shared'
import { newsletterService, type CampaignInput } from '../../services/newsletterService'
import { productsService } from '../../services/productsService'
import { errorMessage } from '../../core/http'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Spinner from '../../components/ui/Spinner'
import { STATUS_TONE, newBlock, recommendationTemplate } from './newsletterUi'

const PALETTE: NewsletterBlockType[] = ['heading', 'text', 'image', 'video', 'button', 'products', 'recommendations', 'divider']

const EMPTY: CampaignInput = { title: '', subject: '', preheader: '', blocks: [], audience: 'all' }

/** datetime-local value in Abidjan time (UTC) for a date. */
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)

function Uploader({ value, onChange, label, accept = 'image/*' }: { value: string; onChange: (url: string) => void; label: string; accept?: string }) {
  const [busy, setBusy] = useState(false)
  const pick = async (file: File) => {
    setBusy(true)
    try {
      onChange((await productsService.uploadFile(file, 'hero')).url)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex items-center gap-3">
      <label className="flex h-16 w-24 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-dark-700 hover:border-gold">
        {busy ? <Spinner size="sm" /> : value && accept.startsWith('image') ? <img src={value} alt="" className="h-full w-full object-cover" /> : <HiPhoto className="h-6 w-6 text-gray-500" />}
        <input type="file" accept={accept} className="hidden" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
      </label>
      <div className="min-w-0 flex-1 text-xs text-gray-500">
        <p className="text-gray-300">{label}</p>
        <p className="truncate">{value || 'Téléversez un fichier ou collez un lien ci-dessous.'}</p>
      </div>
    </div>
  )
}

function ProductChooser({ products, value, onChange }: { products: Product[]; value: string[]; onChange: (ids: string[]) => void }) {
  const [search, setSearch] = useState('')
  const found = products
    .filter((p) => p.is_active && !value.includes(p.id))
    .filter((p) => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))
    .slice(0, 8)
  const byId = new Map(products.map((p) => [p.id, p]))
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 rounded-full bg-gold/15 py-1 pl-3 pr-1 text-xs text-gold">
            {byId.get(id)?.name ?? 'Produit retiré'}
            <button onClick={() => onChange(value.filter((x) => x !== id))} className="rounded-full p-1 hover:bg-gold/20" aria-label="Retirer">
              <HiXMark className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      {value.length < NEWSLETTER_MAX_PRODUCTS && (
        <>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ajouter un produit…" className="field" />
          {search.trim() && (
            <ul className="max-h-48 overflow-y-auto rounded-xl border border-white/10">
              {found.map((p) => (
                <li key={p.id}>
                  <button onClick={() => (onChange([...value, p.id]), setSearch(''))} className="w-full px-3 py-2 text-left text-sm hover:bg-white/5">
                    {p.name}
                  </button>
                </li>
              ))}
              {found.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">Aucun résultat</li>}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function BlockFields({ block, onChange, products }: { block: NewsletterBlock; onChange: (b: NewsletterBlock) => void; products: Product[] }) {
  switch (block.type) {
    case 'heading':
      return <Input label="Titre" value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} maxLength={200} hint="{{prenom}} est remplacé par le prénom du destinataire." />
    case 'text':
      return (
        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-[0.15em] text-gray-300">Texte</label>
          <textarea rows={5} value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} maxLength={5000} className="field" />
          <p className="text-xs text-gray-500">Une ligne vide sépare deux paragraphes · {'{{prenom}}'} = prénom du destinataire.</p>
        </div>
      )
    case 'image':
      return (
        <div className="space-y-3">
          <Uploader value={block.url} onChange={(url) => onChange({ ...block, url })} label="Image (JPG, PNG, WebP — 10 Mo max)" />
          <Input label="Adresse de l’image" value={block.url} onChange={(e) => onChange({ ...block, url: e.target.value })} placeholder="https://…" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Description (accessibilité)" value={block.alt} onChange={(e) => onChange({ ...block, alt: e.target.value })} maxLength={200} />
            <Input label="Lien au clic (optionnel)" value={block.link ?? ''} onChange={(e) => onChange({ ...block, link: e.target.value })} placeholder="/collection ou https://…" />
          </div>
        </div>
      )
    case 'video': {
      const poster = videoThumbnail(block)
      return (
        <div className="space-y-3">
          <Input label="Lien de la vidéo" value={block.url} onChange={(e) => onChange({ ...block, url: e.target.value })} placeholder="https://youtube.com/… ou https://www.instagram.com/reel/…" hint="Les emails ne lisent pas les vidéos : une image avec ▶ renvoie vers la vidéo." />
          <Uploader value={/\.(mp4|webm|mov)(\?|$)/i.test(block.url) ? block.url : ''} onChange={(url) => onChange({ ...block, url })} label="Ou téléversez la vidéo (MP4, 100 Mo max)" accept="video/mp4,video/webm,video/quicktime" />
          <Uploader value={block.thumbnail ?? ''} onChange={(thumbnail) => onChange({ ...block, thumbnail })} label={poster && !block.thumbnail ? 'Miniature YouTube utilisée automatiquement — ou téléversez la vôtre' : 'Image de couverture (recommandée)'} />
          <Input label="Légende (optionnelle)" value={block.caption ?? ''} onChange={(e) => onChange({ ...block, caption: e.target.value })} maxLength={200} />
        </div>
      )
    }
    case 'button':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Texte du bouton" value={block.label} onChange={(e) => onChange({ ...block, label: e.target.value })} maxLength={60} />
          <Input label="Lien" value={block.url} onChange={(e) => onChange({ ...block, url: e.target.value })} placeholder="/collection ou https://…" />
        </div>
      )
    case 'products':
      return (
        <div className="space-y-3">
          <Input label="Titre de la section (optionnel)" value={block.title ?? ''} onChange={(e) => onChange({ ...block, title: e.target.value })} maxLength={120} />
          <ProductChooser products={products} value={block.productIds} onChange={(productIds) => onChange({ ...block, productIds })} />
        </div>
      )
    case 'recommendations':
      return (
        <div className="space-y-2">
          <Input label="Titre de la section" value={block.title ?? ''} onChange={(e) => onChange({ ...block, title: e.target.value })} maxLength={120} />
          <p className="text-xs text-gray-500">
            Pour chaque destinataire : 4 pièces proches de ses derniers achats (même collection, marque, catégorie), jamais ce qu’il possède déjà. Sans achat : nos coups de cœur.
          </p>
        </div>
      )
    case 'divider':
      return <p className="text-xs text-gray-500">Une fine ligne de séparation.</p>
  }
}

/** Admin → Newsletter → campaign editor with live preview. */
export default function NewsletterEditor() {
  const { id = 'new' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState<NewsletterCampaign | null>(null)
  const [form, setForm] = useState<CampaignInput>(EMPTY)
  const [products, setProducts] = useState<Product[]>([])
  const [audience, setAudience] = useState<Record<NewsletterAudience, number> | null>(null)
  const [loading, setLoading] = useState(id !== 'new')
  const [busy, setBusy] = useState<string | null>(null)
  const [preview, setPreview] = useState('')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [scheduleAt, setScheduleAt] = useState(() => toLocalInput(new Date(Date.now() + 3_600_000)))
  const [dirty, setDirty] = useState(false)
  const previewTimer = useRef<number>(0)

  const editable = !campaign || ['draft', 'scheduled', 'cancelled'].includes(campaign.status)

  useEffect(() => {
    productsService.getAll().then(setProducts).catch(() => undefined)
    newsletterService.audience().then(setAudience).catch(() => undefined)
    if (id === 'new') return
    newsletterService
      .get(id)
      .then((c) => {
        setCampaign(c)
        setForm({ title: c.title, subject: c.subject, preheader: c.preheader, blocks: c.blocks, audience: c.audience })
        if (c.scheduled_at) setScheduleAt(toLocalInput(new Date(c.scheduled_at)))
      })
      .catch((e) => toast.error(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [id])

  // Live preview (debounced), rendered by the API exactly as it will be sent
  useEffect(() => {
    window.clearTimeout(previewTimer.current)
    previewTimer.current = window.setTimeout(() => {
      newsletterService
        .preview({ subject: form.subject || 'Aperçu', preheader: form.preheader, blocks: form.blocks })
        .then((r) => setPreview(r.html))
        .catch(() => undefined) // incomplete blocks: keep the last valid preview
    }, 700)
    return () => window.clearTimeout(previewTimer.current)
  }, [form.subject, form.preheader, form.blocks])

  const set = <K extends keyof CampaignInput>(k: K, v: CampaignInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setDirty(true)
  }
  const setBlocks = (blocks: NewsletterBlock[]) => set('blocks', blocks)
  const updateBlock = (b: NewsletterBlock) => setBlocks(form.blocks.map((x) => (x.id === b.id ? b : x)))
  const moveBlock = (i: number, d: -1 | 1) => {
    const next = [...form.blocks]
    const j = i + d
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    setBlocks(next)
  }

  /** Saves and returns the campaign id (creating it the first time). */
  const save = async (quiet = false): Promise<string | null> => {
    if (form.title.trim().length < 2) return toast.error('Donnez un nom interne à la campagne'), null
    if (form.subject.trim().length < 2) return toast.error('L’objet de l’email est requis'), null
    try {
      const saved = campaign ? await newsletterService.update(campaign.id, form) : await newsletterService.create(form)
      setCampaign(saved)
      setDirty(false)
      if (!campaign) navigate(`/admin/newsletter/${saved.id}`, { replace: true })
      if (!quiet) toast.success('Campagne enregistrée')
      return saved.id
    } catch (e) {
      toast.error(errorMessage(e))
      return null
    }
  }

  const act = async (name: string, fn: () => Promise<void>) => {
    setBusy(name)
    try {
      await fn()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const recipients = audience?.[form.audience]

  const sendTest = () =>
    act('test', async () => {
      const cid = dirty || !campaign ? await save(true) : campaign.id
      if (!cid) return
      const r = await newsletterService.sendTest(cid)
      if (r.sent) toast.success(`Email de test envoyé à ${r.to}`)
      else toast.error(`Échec de l’envoi : ${r.error}`)
    })

  const schedule = () =>
    act('schedule', async () => {
      const cid = dirty || !campaign ? await save(true) : campaign.id
      if (!cid) return
      const at = new Date(scheduleAt)
      setCampaign(await newsletterService.schedule(cid, at))
      toast.success(`Programmée le ${at.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}`)
    })

  const sendNow = () =>
    act('send', async () => {
      if (!confirm(`Envoyer maintenant à ${recipients ?? 'tous les'} destinataire(s) ?`)) return
      const cid = dirty || !campaign ? await save(true) : campaign.id
      if (!cid) return
      setCampaign(await newsletterService.sendNow(cid))
      toast.success('Envoi lancé')
    })

  const cancel = () =>
    act('cancel', async () => {
      if (!campaign || !confirm('Annuler l’envoi de cette campagne ?')) return
      setCampaign(await newsletterService.cancel(campaign.id))
      toast.success('Envoi annulé')
    })

  const preheaderHint = useMemo(() => `${form.preheader.length}/200 · le court texte affiché après l’objet dans la boîte de réception`, [form.preheader])

  if (loading) return <Spinner />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/admin/newsletter" className="rounded-full border border-white/10 p-2 text-gray-400 hover:text-white" aria-label="Retour">
            <HiArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">{form.title || 'Nouvelle campagne'}</h1>
            {campaign && (
              <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                <span className={clsx('rounded-full px-2.5 py-0.5', STATUS_TONE[campaign.status])}>{NEWSLETTER_STATUS_LABELS[campaign.status]}</span>
                {campaign.status === 'scheduled' && campaign.scheduled_at && <>le {new Date(campaign.scheduled_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}</>}
                {campaign.recipients_count > 0 && (
                  <>
                    · {campaign.sent_count}/{campaign.recipients_count} envoyés{campaign.failed_count > 0 && ` · ${campaign.failed_count} échecs`}
                  </>
                )}
              </p>
            )}
          </div>
        </div>
        {editable && (
          <Button onClick={() => save()} variant="outline">
            Enregistrer
          </Button>
        )}
      </div>

      {!editable && (
        <p className="rounded-2xl border border-white/10 bg-dark-800 p-4 text-sm text-gray-400">
          Cette campagne est {campaign ? NEWSLETTER_STATUS_LABELS[campaign.status].toLowerCase() : ''} : elle ne peut plus être modifiée. Dupliquez-la depuis la liste pour la réutiliser.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Editor */}
        <fieldset disabled={!editable} className="min-w-0 space-y-5 disabled:opacity-60">
          <section className="space-y-4 rounded-2xl border border-white/5 bg-dark-800 p-5">
            <Input label="Nom interne" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex : Rentrée Air Jordan" maxLength={120} />
            <Input label="Objet de l’email" value={form.subject} onChange={(e) => set('subject', e.target.value)} placeholder="Ex : Les Air Jordan 4 sont arrivées ✨" maxLength={150} />
            <Input label="Texte d’aperçu" value={form.preheader} onChange={(e) => set('preheader', e.target.value)} maxLength={200} hint={preheaderHint} />
            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-[0.15em] text-gray-300">Destinataires</label>
              <select value={form.audience} onChange={(e) => set('audience', e.target.value as NewsletterAudience)} className="field">
                {(Object.keys(NEWSLETTER_AUDIENCE_LABELS) as NewsletterAudience[]).map((a) => (
                  <option key={a} value={a}>
                    {NEWSLETTER_AUDIENCE_LABELS[a]}
                    {audience ? ` — ${audience[a]}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">Seules les personnes ayant accepté les emails les reçoivent ; chaque email contient un lien de désinscription.</p>
            </div>
          </section>

          <section className="space-y-3">
            {form.blocks.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">
                Ajoutez des blocs ci-dessous, ou{' '}
                <button type="button" onClick={() => setBlocks(recommendationTemplate())} className="text-gold hover:underline">
                  partez du modèle « Recommandations selon les derniers achats »
                </button>
                .
              </div>
            )}
            {form.blocks.map((b, i) => (
              <div key={b.id} className="rounded-2xl border border-white/5 bg-dark-800 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-gold">{NEWSLETTER_BLOCK_LABELS[b.type]}</span>
                  <span className="flex-1" />
                  <button type="button" onClick={() => moveBlock(i, -1)} disabled={i === 0} className="rounded-full p-1.5 text-gray-400 hover:text-white disabled:opacity-30" aria-label="Monter">
                    <HiArrowUp className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => moveBlock(i, 1)} disabled={i === form.blocks.length - 1} className="rounded-full p-1.5 text-gray-400 hover:text-white disabled:opacity-30" aria-label="Descendre">
                    <HiArrowDown className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setBlocks(form.blocks.filter((x) => x.id !== b.id))} className="rounded-full p-1.5 text-gray-400 hover:text-red-400" aria-label="Supprimer le bloc">
                    <HiTrash className="h-4 w-4" />
                  </button>
                </div>
                <BlockFields block={b} onChange={updateBlock} products={products} />
              </div>
            ))}
            {form.blocks.length < NEWSLETTER_MAX_BLOCKS && (
              <div className="rounded-2xl border border-white/5 bg-dark-800 p-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-gray-400">Ajouter un bloc</p>
                <div className="flex flex-wrap gap-2">
                  {PALETTE.map((t) => (
                    <button key={t} type="button" onClick={() => setBlocks([...form.blocks, newBlock(t)])} className="rounded-full border border-white/10 px-3 py-1.5 text-xs hover:border-gold hover:text-gold">
                      + {NEWSLETTER_BLOCK_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        </fieldset>

        {/* Preview + sending */}
        <div className="min-w-0 space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-2xl border border-white/5 bg-dark-800 p-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-gray-400">Aperçu</p>
              <div className="flex gap-1">
                {(
                  [
                    ['desktop', HiComputerDesktop],
                    ['mobile', HiDevicePhoneMobile],
                  ] as const
                ).map(([d, Icon]) => (
                  <button key={d} onClick={() => setDevice(d)} className={clsx('rounded-full p-2', device === d ? 'bg-gold text-primary-black' : 'text-gray-400 hover:text-white')} aria-label={d === 'desktop' ? 'Ordinateur' : 'Mobile'}>
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-center rounded-xl bg-black">
              {/* sandbox="": the preview can't run scripts or reach the admin session */}
              <iframe title="Aperçu de l’email" sandbox="" srcDoc={preview} className={clsx('h-[640px] rounded-xl bg-black transition-all', device === 'desktop' ? 'w-full' : 'w-[375px]')} />
            </div>
          </div>

          {editable && (
            <div className="space-y-4 rounded-2xl border border-white/5 bg-dark-800 p-5">
              <Button variant="outline" icon={HiBeaker} onClick={sendTest} loading={busy === 'test'} className="w-full">
                M’envoyer un test
              </Button>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <Input label="Programmer pour (heure d’Abidjan)" type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
                <Button icon={HiCalendarDays} onClick={schedule} loading={busy === 'schedule'} variant="outline">
                  Programmer
                </Button>
              </div>
              <Button icon={HiPaperAirplane} onClick={sendNow} loading={busy === 'send'} className="w-full">
                Envoyer maintenant{recipients !== undefined ? ` (${recipients})` : ''}
              </Button>
              {campaign?.status === 'scheduled' && (
                <Button icon={HiNoSymbol} variant="ghost" onClick={cancel} loading={busy === 'cancel'} className="w-full">
                  Annuler la programmation
                </Button>
              )}
              <p className="flex gap-2 text-xs text-gray-500">
                <HiSparkles className="h-4 w-4 flex-shrink-0 text-gold" /> Les envois partent par lots, sans jamais envoyer deux fois le même email à la même personne.
              </p>
            </div>
          )}
          {campaign?.status === 'sending' && (
            <Button icon={HiNoSymbol} variant="ghost" onClick={cancel} loading={busy === 'cancel'} className="w-full">
              Arrêter l’envoi en cours
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
