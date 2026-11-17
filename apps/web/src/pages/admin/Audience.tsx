import { useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import type { IconType } from 'react-icons'
import { FaWhatsapp } from 'react-icons/fa'
import toast from 'react-hot-toast'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts'
import {
  HiArrowPath,
  HiArrowTrendingDown,
  HiArrowTrendingUp,
  HiCheck,
  HiDeviceTablet,
  HiComputerDesktop,
  HiDevicePhoneMobile,
  HiDocumentDuplicate,
  HiEye,
  HiInformationCircle,
  HiUserGroup,
  HiCursorArrowRays,
} from 'react-icons/hi2'
import { WHATSAPP_LINKS, whatsappLinkLabel, type AudienceRange, type AudienceStats } from '@trs/shared'
import { audienceService } from '../../services/audienceService'
import { errorMessage } from '../../core/http'
import { excludeDeviceByDefault, isExcludedDevice, setExcludedDevice } from '../../analytics/pageViews'
import Spinner from '../../components/ui/Spinner'
import { countryName, DEVICE_LABELS, fillSeries, flag, pageLabel, sourceIcon, sourceLabel, timeAgo, trend } from './audienceUi'

const GOLD = '#D4AF37'
const GRID = 'rgba(255,255,255,0.06)'
const AXIS = '#6B6B6B'
const REFRESH_MS = 60_000
const RANGES: { id: AudienceRange; label: string }[] = [
  { id: 'today', label: "Aujourd'hui" },
  { id: '7d', label: '7 j' },
  { id: '30d', label: '30 j' },
  { id: '90d', label: '90 j' },
]
const DEVICE_ICONS = { mobile: HiDevicePhoneMobile, tablet: HiDeviceTablet, desktop: HiComputerDesktop } as const

function Panel({ title, hint, children, className }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx('min-w-0 rounded-2xl border border-white/5 bg-dark-800 p-5 md:p-6', className)}>
      <h2 className="font-display text-lg text-white">{title}</h2>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Trend({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-emerald-400">nouveau</span>
  if (value === 0) return <span className="text-xs text-gray-500">= période préc.</span>
  const up = value > 0
  return (
    <span className={clsx('inline-flex items-center gap-1 text-xs font-medium', up ? 'text-emerald-400' : 'text-red-400')}>
      {up ? <HiArrowTrendingUp className="h-4 w-4" /> : <HiArrowTrendingDown className="h-4 w-4" />}
      {up ? '+' : ''}
      {value}%
    </span>
  )
}

function Kpi({ label, value, previous, icon: Icon, hint }: { label: string; value: number; previous: number; icon: typeof HiEye; hint: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-dark-800 p-5" title={hint}>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{label}</p>
        <Icon className="h-5 w-5 text-gold" />
      </div>
      <p className="mt-3 font-display text-3xl text-white">{value.toLocaleString('fr-FR')}</p>
      <div className="mt-1">
        <Trend value={trend(value, previous)} />
      </div>
    </div>
  )
}

/** Ranked rows with a proportional bar (one hue: the label carries identity). */
function BarList({ rows, total, empty }: { rows: { key: string; label: React.ReactNode; value: number }[]; total: number; empty: string }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-gray-500">{empty}</p>
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="relative overflow-hidden rounded-lg px-3 py-2">
          <span aria-hidden className="absolute inset-y-0 left-0 rounded-lg bg-gold/15" style={{ width: `${(r.value / max) * 100}%` }} />
          <span className="relative flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-gray-200">{r.label}</span>
            <span className="shrink-0 tabular-nums text-white">
              {r.value.toLocaleString('fr-FR')}
              <span className="ml-2 text-xs text-gray-500">{total ? Math.round((r.value / total) * 100) : 0}%</span>
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function ChartTooltip({ active, payload, label, hourly }: TooltipProps<number, string> & { hourly: boolean }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-gold/30 bg-primary-black/95 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 text-gray-400">{fmtTick(String(label), hourly, true)}</p>
      {payload.map((p) => (
        <p key={p.dataKey as string} className="text-white">
          {p.name} : <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

function fmtTick(iso: string, hourly: boolean, long = false) {
  const d = new Date(iso)
  if (hourly) return `${String(d.getUTCHours()).padStart(2, '0')}h${long ? '–' + String((d.getUTCHours() + 1) % 24).padStart(2, '0') + 'h' : ''}`
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC', ...(long ? { weekday: 'short' } : {}) })
}

function CopyRow({ link, label, icon: Icon, primary }: { link: string; label?: string; icon?: IconType; primary?: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success('Lien copié')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Copie impossible, sélectionnez le lien à la main')
    }
  }
  return (
    <div className={clsx('flex items-center gap-3', primary ? 'rounded-xl border border-white/10 bg-primary-black/40 p-2 pl-4' : 'py-2.5')}>
      {Icon && <Icon className="h-5 w-5 shrink-0 text-gold" aria-hidden />}
      <div className="min-w-0 flex-1">
        {label && <p className="text-sm text-white">{label}</p>}
        <p className={clsx('truncate font-mono', primary ? 'text-sm text-white' : 'text-xs text-gray-500')}>{link}</p>
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        className={clsx(
          'inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors',
          primary ? 'bg-gold text-primary-black hover:opacity-90' : 'border border-gold/40 text-gold hover:bg-gold hover:text-primary-black',
        )}
      >
        {copied ? <HiCheck className="h-4 w-4" /> : <HiDocumentDuplicate className="h-4 w-4" />}
        {copied ? 'Copié' : 'Copier'}
      </button>
    </div>
  )
}

/**
 * One general link for every network (where it is clicked is detected
 * automatically), plus WhatsApp links: WhatsApp alone never says whether a
 * click came from a status, a discussion or a group, nor anything on iPhone.
 */
function ShareLinks() {
  const home = `${window.location.origin}/`
  const whatsappLink = (medium: string) => `${home}?utm_source=whatsapp&utm_medium=${medium}`
  const detected: [string, string][] = [
    ['instagram', 'Instagram (posts, stories, bio, messages)'],
    ['facebook', 'Facebook et Messenger'],
    ['tiktok', 'TikTok'],
    ['snapchat', 'Snapchat, Telegram, Gmail'],
    ['google', 'Google'],
  ]

  return (
    <Panel title="Liens à partager">
      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Lien général · tous les réseaux</p>
      <div className="mt-2">
        <CopyRow link={home} primary />
      </div>
      <p className="mt-2 text-xs text-gray-500">La boutique reconnaît toute seule d'où vient le clic. Un lien vers un produit marche aussi : copiez l'adresse de sa page.</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {detected.map(([source, label]) => {
          const Icon = sourceIcon(source)
          return (
            <li key={source} className="flex items-center gap-2 text-sm text-gray-300">
              <Icon className="h-4 w-4 shrink-0 text-gold" aria-hidden /> {label}
            </li>
          )
        })}
      </ul>

      <p className="mt-6 text-xs uppercase tracking-[0.2em] text-gray-500">Liens WhatsApp</p>
      <p className="mt-1 text-xs text-gray-500">
        WhatsApp ne dit jamais si le clic vient d'un statut, d'une discussion ou d'un groupe, et sur iPhone il ne dit rien du tout. Utilisez ces liens
        sur WhatsApp pour le savoir.
      </p>
      <div className="mt-2 divide-y divide-white/5">
        {WHATSAPP_LINKS.map((w) => (
          <CopyRow key={w.medium} link={whatsappLink(w.medium)} label={w.label} icon={FaWhatsapp} />
        ))}
      </div>
      <p className="mt-3 flex gap-2 rounded-xl bg-white/5 p-3 text-xs text-gray-400">
        <HiInformationCircle className="h-4 w-4 shrink-0 text-gold" />
        <span>Pas de risque d'erreur : si un lien WhatsApp est collé sur Instagram ou Facebook, la visite est comptée pour le réseau où le lien a été cliqué.</span>
      </p>
    </Panel>
  )
}

export default function Audience() {
  const [range, setRange] = useState<AudienceRange>('7d')
  const [stats, setStats] = useState<AudienceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // The layout applies the default too, but its effect runs after this page's first render.
  const [excluded, setExcluded] = useState(() => {
    excludeDeviceByDefault()
    return isExcludedDevice()
  })

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await audienceService.getStats(range, signal)
        setStats(data)
        setError(null)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError(errorMessage(e, 'Impossible de charger les visites'))
      } finally {
        setLoading(false)
      }
    },
    [range],
  )

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    void load(ctrl.signal)
    // Live figures: refresh every minute while the page is open
    const timer = window.setInterval(() => void load(), REFRESH_MS)
    return () => {
      ctrl.abort()
      window.clearInterval(timer)
    }
  }, [load])

  const series = useMemo(() => (stats ? fillSeries(stats) : []), [stats])
  const totalSessions = stats?.visits ?? 0

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow mb-2">Boutique</p>
          <h1 className="font-display text-3xl text-white">Audience</h1>
          <p className="mt-1 text-sm text-gray-400">Qui visite la boutique, d'où viennent les visiteurs et ce qu'ils regardent.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-white/10 bg-dark-800 p-1" role="tablist" aria-label="Période">
            {RANGES.map((r) => (
              <button
                key={r.id}
                role="tab"
                aria-selected={range === r.id}
                onClick={() => setRange(r.id)}
                className={clsx('rounded-full px-4 py-1.5 text-sm transition-colors', range === r.id ? 'bg-gold text-primary-black' : 'text-gray-400 hover:text-white')}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={() => void load()} className="rounded-full border border-white/10 p-2.5 text-gray-400 hover:border-gold hover:text-gold" aria-label="Actualiser">
            <HiArrowPath className={clsx('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
      </header>

      {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

      {!stats ? (
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/15 to-transparent p-5" title="Visites actives ces 5 dernières minutes">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400">En ce moment</p>
                <span className="relative flex h-3 w-3">
                  {stats.live > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
                  <span className={clsx('relative inline-flex h-3 w-3 rounded-full', stats.live > 0 ? 'bg-emerald-400' : 'bg-gray-600')} />
                </span>
              </div>
              <p className="mt-3 font-display text-3xl text-white">{stats.live}</p>
              <p className="mt-1 text-xs text-gray-400">{stats.live === 1 ? 'personne sur la boutique' : 'personnes sur la boutique'}</p>
            </div>
            <Kpi label="Visiteurs" value={stats.visitors} previous={stats.previous.visitors} icon={HiUserGroup} hint="Personnes différentes (comptées par jour)" />
            <Kpi label="Visites" value={stats.visits} previous={stats.previous.visits} icon={HiCursorArrowRays} hint="Une visite = une personne qui arrive sur la boutique" />
            <Kpi label="Pages vues" value={stats.pageviews} previous={stats.previous.pageviews} icon={HiEye} hint="Toutes les pages ouvertes pendant les visites" />
          </div>

          <Panel title={stats.hourly ? "Visites aujourd'hui, heure par heure" : 'Visites par jour'} hint="Heure de Côte d'Ivoire (GMT)">
            {stats.visits === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">Aucune visite sur cette période pour l'instant.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="audienceFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="t" tickFormatter={(v) => fmtTick(String(v), stats.hourly)} stroke={AXIS} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis stroke={AXIS} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip hourly={stats.hourly} />} cursor={{ stroke: GOLD, strokeOpacity: 0.4 }} />
                    <Area type="monotone" dataKey="visits" name="Visites" stroke={GOLD} strokeWidth={2} fill="url(#audienceFill)" activeDot={{ r: 5, stroke: '#111', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="D'où viennent-ils ?" hint="Réseau ou site d'où vient chaque visite">
              <BarList
                total={totalSessions}
                empty="Aucune visite pour l'instant."
                rows={stats.sources.map((s) => {
                  const Icon = sourceIcon(s.key)
                  return {
                    key: s.key,
                    value: s.visits,
                    label: (
                      <span className="inline-flex items-center gap-2">
                        <Icon className="h-4 w-4 text-gold" aria-hidden /> {sourceLabel(s.key)}
                      </span>
                    ),
                  }
                })}
              />
              {stats.whatsapp.length > 0 && (
                <div className="mt-5 border-t border-white/5 pt-4">
                  <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gray-500">
                    <FaWhatsapp className="h-4 w-4 text-gold" aria-hidden /> Détail WhatsApp
                  </p>
                  <BarList
                    total={stats.whatsapp.reduce((sum, w) => sum + w.visits, 0)}
                    empty=""
                    rows={stats.whatsapp.map((w) => ({ key: w.key || 'general', value: w.visits, label: whatsappLinkLabel(w.key) }))}
                  />
                </div>
              )}
              <p className="mt-4 flex gap-2 rounded-xl bg-white/5 p-3 text-xs text-gray-400">
                <HiInformationCircle className="h-4 w-4 shrink-0 text-gold" />
                Détecté automatiquement, quel que soit le lien partagé. Sur iPhone, seuls les liens WhatsApp ci-dessous permettent de reconnaître WhatsApp : sinon la visite apparaît en « Direct / non identifié ».
              </p>
            </Panel>

            <Panel title="Pays">
              <BarList
                total={totalSessions}
                empty="Aucune visite pour l'instant."
                rows={stats.countries.map((c) => ({
                  key: c.key || 'unknown',
                  value: c.visits,
                  label: (
                    <span>
                      <span className="mr-2">{flag(c.key)}</span>
                      {countryName(c.key)}
                    </span>
                  ),
                }))}
              />
            </Panel>

            <Panel title="Villes">
              <BarList
                total={totalSessions}
                empty="Les villes s'affichent dès les premières visites."
                rows={stats.cities.map((c) => ({
                  key: `${c.key}-${c.country}`,
                  value: c.visits,
                  label: (
                    <span>
                      <span className="mr-2">{flag(c.country)}</span>
                      {c.key}
                    </span>
                  ),
                }))}
              />
            </Panel>

            <Panel title="Pages les plus vues">
              <BarList
                total={stats.pageviews}
                empty="Aucune page vue pour l'instant."
                rows={stats.pages.map((p) => ({ key: p.key, value: p.views, label: <span title={p.key}>{pageLabel(p.key)}</span> }))}
              />
            </Panel>

            <Panel title="Appareils">
              <BarList
                total={totalSessions}
                empty="Aucune visite pour l'instant."
                rows={stats.devices.map((dv) => {
                  const Icon = DEVICE_ICONS[dv.key as keyof typeof DEVICE_ICONS] ?? HiComputerDesktop
                  return {
                    key: dv.key,
                    value: dv.visits,
                    label: (
                      <span className="inline-flex items-center gap-2">
                        <Icon className="h-4 w-4 text-gold" aria-hidden /> {DEVICE_LABELS[dv.key] ?? dv.key}
                      </span>
                    ),
                  }
                })}
              />
            </Panel>

            <Panel title="Dernières visites" hint="Les 30 dernières arrivées sur la boutique, en direct">
              {stats.recent.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">Les visites apparaîtront ici dès qu'un visiteur ouvrira la boutique.</p>
              ) : (
                <ul className="max-h-80 divide-y divide-white/5 overflow-y-auto pr-1">
                  {stats.recent.map((r, i) => {
                    const Icon = sourceIcon(r.source)
                    return (
                      <li key={`${r.at}-${i}`} className="flex items-center gap-3 py-2.5 text-sm">
                        <Icon className="h-4 w-4 shrink-0 text-gold" aria-label={sourceLabel(r.source)} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-gray-200">
                            {flag(r.country)} {r.city ?? countryName(r.country)}
                            <span className="text-gray-500"> · {sourceLabel(r.source)}</span>
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {pageLabel(r.path)} · {DEVICE_LABELS[r.device ?? ''] ?? ''}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-gray-500">{timeAgo(r.at)}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ShareLinks />
            <Panel title="Mes propres visites">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={excluded}
                  onChange={(e) => {
                    setExcludedDevice(e.target.checked)
                    setExcluded(e.target.checked)
                  }}
                  className="mt-1 h-4 w-4 accent-[#D4AF37]"
                />
                <span className="text-sm text-gray-300">
                  Ne pas compter mes visites sur cet appareil
                  <span className="mt-1 block text-xs text-gray-500">
                    Activé automatiquement sur les appareils où vous ouvrez le back-office. Ouvrez-le une fois sur votre téléphone pour l'exclure aussi.
                  </span>
                </span>
              </label>
              <p className="mt-5 text-xs leading-relaxed text-gray-500">
                Confidentialité : aucune adresse IP ni aucun compte client n'est enregistré. La ville est estimée à partir du réseau (elle peut être approximative) et
                les données sont effacées après 13 mois. Les robots (aperçus de liens WhatsApp, Facebook…) ne sont pas comptés.
              </p>
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}
